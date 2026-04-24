import { fromSupabaseError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  madridDateToUtcDayRange,
  madridLocalDateTimeToUtcDate,
  madridLocalDateTimeToUtcIso,
  madridSlotBucketIndexFromIso,
  utcDateToMadridTimeHHmm,
} from "@/lib/datetime";
import {
  addMinutes,
  findBestCandidateForSlot,
  isBookingWithinOpeningWindows,
  resolveDurationByPartySize,
  suggestNearbyTimes,
  type DurationRule,
} from "@/modules/reservations/domain/availability-rules";
import type {
  AdminBlockCreateInput,
  AdminCalendarQueryInput,
  AdminCalendarMonthQueryInput,
  AdminCreateReservationInput,
  AdminListReservationsInput,
  AdminUpdateReservationInput,
  AvailabilityRequest,
  CreatePublicReservationInput,
  AdminSettingsUpdateInput,
  AdminBlacklistCreateInput,
  AdminBlacklistListInput,
  AdminBlacklistUpdateInput,
  AdminContactListInput,
  AdminContactDeleteInput,
} from "@/modules/reservations/application/reservation.schemas";

type Candidate = {
  id: string;
  tableIds: string[];
  maxCapacity: number;
  tableCount: number;
};

type AvailabilityResult = {
  date: string;
  partySize: number;
  slots: { time: string; available: boolean }[];
  suggestions: string[];
  message?: string;
};

type CreatedReservationRow = {
  reservation_id: string;
  reservation_code: string;
  status: "pending" | "confirmed" | "cancelled" | "seated" | "finished" | "no_show";
  start_at: string;
};

type CancelledReservationRow = {
  id: string;
  reservation_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_comment: string | null;
  party_size: number;
  start_at: string;
};

function parseTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  return { h, m };
}

function buildDateTimeISO(date: string, time: string) {
  return madridLocalDateTimeToUtcDate(date, time);
}


export class ReservationsRepository {
  private supabase = createSupabaseAdminClient();

  private async getRules(restaurantId: string) {
    const [{ data: rules, error: rulesError }, { data: durations, error: durationError }] =
      await Promise.all([
        this.supabase
          .from("reservation_rules")
          .select(
            "slot_interval_minutes, default_buffer_before_minutes, default_buffer_after_minutes, max_reservations_per_slot",
          )
          .eq("restaurant_id", restaurantId)
          .eq("is_active", true)
          .is("deleted_at", null)
          .single(),
        this.supabase
          .from("reservation_duration_rules")
          .select("min_party_size, max_party_size, duration_minutes")
          .eq("restaurant_id", restaurantId)
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("min_party_size", { ascending: true }),
      ]);

    if (rulesError || !rules) {
      throw fromSupabaseError(
        rulesError ?? { message: "Rules not found" },
        "No se pudieron cargar las reglas de reserva.",
      );
    }
    if (durationError || !durations || durations.length === 0) {
      throw fromSupabaseError(
        durationError ?? { message: "Duration rules not found" },
        "No se pudieron cargar las reglas de duracion.",
      );
    }

    return { rules, durations };
  }

  async getAvailability(input: AvailabilityRequest): Promise<AvailabilityResult> {
    const { rules, durations } = await this.getRules(input.restaurantId);
    const rulesRow = rules as {
      slot_interval_minutes: number;
      default_buffer_before_minutes: number;
      default_buffer_after_minutes: number;
      max_reservations_per_slot?: number | null;
    };
    const maxPerSlot = Math.min(
      100,
      Math.max(1, Number(rulesRow.max_reservations_per_slot) || 3),
    );

    const dayRange = madridDateToUtcDayRange(input.date);
    const { data: dayReservations, error: dayResErr } = await this.supabase
      .from("reservations")
      .select("start_at")
      .eq("restaurant_id", input.restaurantId)
      .gte("start_at", dayRange.startUtcIso)
      .lte("start_at", dayRange.endUtcIso)
      .in("status", ["pending", "confirmed", "seated"]);
    if (dayResErr) {
      throw fromSupabaseError(dayResErr, "No se pudo comprobar el cupo de reservas.");
    }

    const bucketCounts = new Map<number, number>();
    for (const row of dayReservations ?? []) {
      if (!row.start_at) continue;
      const b = madridSlotBucketIndexFromIso(row.start_at, rulesRow.slot_interval_minutes);
      if (b < 0) continue;
      bucketCounts.set(b, (bucketCounts.get(b) ?? 0) + 1);
    }

    const durationRules: DurationRule[] = durations.map((rule) => ({
      minPartySize: rule.min_party_size,
      maxPartySize: rule.max_party_size,
      durationMinutes: rule.duration_minutes,
    }));
    const duration = resolveDurationByPartySize(durationRules, input.partySize);

    const weekday = new Date(`${input.date}T00:00:00`).getDay() || 7;

    const [
      { data: openingHours, error: openingError },
      { data: closures, error: closureError },
      { data: tables, error: tableError },
      { data: combinations, error: comboError },
      { data: existing, error: existingError },
      { data: blocks, error: blocksError },
    ] = await Promise.all([
      this.supabase
        .from("opening_hours")
        .select("open_time, close_time")
        .eq("restaurant_id", input.restaurantId)
        .eq("weekday", weekday)
        .eq("is_active", true)
        .is("deleted_at", null),
      this.supabase
        .from("special_closures")
        .select("closure_date, starts_at, ends_at, is_full_day")
        .eq("restaurant_id", input.restaurantId)
        .eq("is_active", true)
        .is("deleted_at", null),
      this.supabase
        .from("tables")
        .select("id, min_capacity, max_capacity")
        .eq("restaurant_id", input.restaurantId)
        .eq("is_active", true)
        .is("deleted_at", null),
      this.supabase
        .from("table_combinations")
        .select("id, table_1_id, table_2_id")
        .eq("restaurant_id", input.restaurantId)
        .eq("is_active", true)
        .is("deleted_at", null),
      this.supabase
        .from("reservation_tables")
        .select("table_id, occupancy_start_at, occupancy_end_at, reservation_status")
        .gte("occupancy_end_at", `${input.date}T00:00:00+00:00`)
        .lte("occupancy_start_at", `${input.date}T23:59:59+00:00`)
        .in("reservation_status", ["pending", "confirmed", "seated"]),
      this.supabase
        .from("blocked_slots")
        .select("table_id, starts_at, ends_at")
        .eq("restaurant_id", input.restaurantId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .gte("ends_at", `${input.date}T00:00:00+00:00`)
        .lte("starts_at", `${input.date}T23:59:59+00:00`),
    ]);

    const anyError =
      openingError || closureError || tableError || comboError || existingError || blocksError;
    if (anyError) {
      throw fromSupabaseError(anyError, "No se pudo calcular la disponibilidad.");
    }

    const openRanges = (openingHours ?? []).flatMap((window) => {
      const open = parseTime(window.open_time.slice(0, 5));
      const close = parseTime(window.close_time.slice(0, 5));
      const start = buildDateTimeISO(
        input.date,
        `${String(open.h).padStart(2, "0")}:${String(open.m).padStart(2, "0")}`,
      );
      const end = buildDateTimeISO(
        input.date,
        `${String(close.h).padStart(2, "0")}:${String(close.m).padStart(2, "0")}`,
      );
      return [{ start, end }];
    });

    const isFullDayClosed = (closures ?? []).some(
      (closure) => closure.is_full_day && closure.closure_date === input.date,
    );

    if (isFullDayClosed || openRanges.length === 0) {
      return {
        date: input.date,
        partySize: input.partySize,
        slots: [],
        suggestions: [],
        message: "No hay servicio disponible ese dia.",
      };
    }

    const tableById = new Map((tables ?? []).map((table) => [table.id, table]));
    const candidates: Candidate[] = [];

    for (const table of tables ?? []) {
      if (input.partySize >= table.min_capacity && input.partySize <= table.max_capacity) {
        candidates.push({
          id: `single-${table.id}`,
          tableIds: [table.id],
          maxCapacity: table.max_capacity,
          tableCount: 1,
        });
      }
    }

    for (const combo of combinations ?? []) {
      const t1 = tableById.get(combo.table_1_id);
      const t2 = tableById.get(combo.table_2_id);
      if (!t1 || !t2) continue;
      const maxCapacity = t1.max_capacity + t2.max_capacity;
      const minCapacity = t1.min_capacity + t2.min_capacity;
      if (input.partySize >= minCapacity && input.partySize <= maxCapacity) {
        candidates.push({
          id: `combo-${combo.id}`,
          tableIds: [combo.table_1_id, combo.table_2_id],
          maxCapacity,
          tableCount: 2,
        });
      }
    }

    const slotTimes: string[] = [];
    for (const range of openRanges) {
      let cursor = new Date(range.start);
      while (cursor < range.end) {
        slotTimes.push(utcDateToMadridTimeHHmm(cursor));
        cursor = addMinutes(cursor, rules.slot_interval_minutes);
      }
    }

    const slots = slotTimes.map((time) => {
      const startAt = buildDateTimeISO(input.date, time);
      const endAt = addMinutes(startAt, duration);
      const occupancyStart = addMinutes(startAt, -rules.default_buffer_before_minutes);
      const occupancyEnd = addMinutes(endAt, rules.default_buffer_after_minutes);

      const withinService = isBookingWithinOpeningWindows(
        { start: startAt, end: endAt },
        openRanges,
      );
      if (!withinService) {
        return { time, available: false };
      }

      const inPartialClosure = (closures ?? []).some(
        (closure) =>
          !closure.is_full_day &&
          closure.starts_at &&
          closure.ends_at &&
          occupancyStart < new Date(closure.ends_at) &&
          new Date(closure.starts_at) < occupancyEnd,
      );
      if (inPartialClosure) return { time, available: false };

      const hasCandidate = Boolean(
        findBestCandidateForSlot({
          partySize: input.partySize,
          occupancyWindow: { start: occupancyStart, end: occupancyEnd },
          candidates,
          occupancies: (existing ?? []).map((occupied) => ({
            tableId: occupied.table_id,
            start: new Date(occupied.occupancy_start_at),
            end: new Date(occupied.occupancy_end_at),
          })),
          blocks: (blocks ?? []).map((block) => ({
            tableId: block.table_id ?? undefined,
            start: new Date(block.starts_at),
            end: new Date(block.ends_at),
          })),
        }),
      );

      const startAtIso = startAt.toISOString();
      const bucket = madridSlotBucketIndexFromIso(startAtIso, rulesRow.slot_interval_minutes);
      const inBucket = bucket < 0 ? 0 : (bucketCounts.get(bucket) ?? 0);
      const underCap = inBucket < maxPerSlot;

      return { time, available: hasCandidate && underCap };
    });

    const availableTimes = slots.filter((slot) => slot.available).map((slot) => slot.time);
    const suggestions = input.preferredTime
      ? suggestNearbyTimes(input.preferredTime, availableTimes, 3)
      : [];

    return {
      date: input.date,
      partySize: input.partySize,
      slots,
      suggestions:
        input.preferredTime && !availableTimes.includes(input.preferredTime) ? suggestions : [],
      message:
        availableTimes.length === 0
          ? "No hay hueco para ese dia y numero de comensales."
          : undefined,
    };
  }

  async createReservation(input: CreatePublicReservationInput | AdminCreateReservationInput) {
    const isAdminInput = "startAtISO" in input;
    const startAtISO = isAdminInput
      ? input.startAtISO
      : madridLocalDateTimeToUtcIso(input.date, input.time);
    const customerComment = isAdminInput
      ? input.customerComment ?? ""
      : input.comments ?? "";
    const internalNotes = isAdminInput ? input.internalNotes ?? "" : "";
    const adminUserId = isAdminInput ? input.adminUserId ?? null : null;

    const rpcPayload = {
      p_restaurant_id: input.restaurantId,
      p_customer_name: input.customerName,
      p_customer_phone: input.customerPhone,
      p_customer_email: input.customerEmail,
      p_customer_comment: customerComment,
      p_party_size: input.partySize,
      p_start_at: startAtISO,
      p_source: isAdminInput ? ("admin" as const) : ("web" as const),
      p_created_by_admin_user_id: adminUserId,
      p_internal_notes: internalNotes,
    };

    const { data, error } = (await this.supabase.rpc(
      "rpc_create_reservation_atomic",
      rpcPayload,
    )) as { data: CreatedReservationRow[] | null; error: { message: string; code?: string; details?: string | null } | null };

    if (error || !data?.[0]) {
      throw fromSupabaseError(error ?? { message: "No data from rpc" }, "No se pudo crear la reserva.");
    }

    logger.info({
      scope: "reservations.create",
      message: "Reservation created",
      meta: { reservationId: data[0].reservation_id, source: rpcPayload.p_source },
    });

    return data[0];
  }

  async listReservations(input: AdminListReservationsInput) {
    let query = this.supabase
      .from("reservations")
      .select(
        "id, reservation_code, status, customer_name, customer_phone, customer_email, party_size, start_at, internal_notes, customer_comment",
      )
      .eq("restaurant_id", input.restaurantId)
      .order("start_at", { ascending: true });

    if (input.date) {
      const dayRange = madridDateToUtcDayRange(input.date);
      query = query
        .gte("start_at", dayRange.startUtcIso)
        .lte("start_at", dayRange.endUtcIso);
    }
    if (input.status) query = query.eq("status", input.status);
    if (input.name) query = query.ilike("customer_name", `%${input.name}%`);

    const { data, error } = await query;
    if (error) {
      throw fromSupabaseError(error, "No se pudieron cargar las reservas.");
    }
    return data;
  }

  async updateReservation(input: AdminUpdateReservationInput) {
    if (input.moveToISO) {
      let nextPartySize = input.partySize;
      if (!nextPartySize) {
        const { data: currentReservation, error: currentReservationError } = await this.supabase
          .from("reservations")
          .select("party_size")
          .eq("id", input.id)
          .eq("restaurant_id", input.restaurantId)
          .single();

        if (currentReservationError || !currentReservation) {
          throw fromSupabaseError(
            currentReservationError ?? { message: "Reservation not found" },
            "No se encontro la reserva para mover.",
          );
        }

        nextPartySize = currentReservation.party_size;
      }

      const { data, error } = (await this.supabase.rpc(
        "rpc_reschedule_reservation_atomic",
        {
          p_reservation_id: input.id,
          p_new_start_at: input.moveToISO,
          p_new_party_size: nextPartySize,
          p_admin_user_id: input.adminUserId ?? null,
        },
      )) as {
        data: { reservation_id: string; start_at: string; party_size: number }[] | null;
        error: { message: string; code?: string; details?: string | null } | null;
      };
      if (error || !data?.[0]) {
        throw fromSupabaseError(error ?? { message: "Unable to reschedule" }, "No se pudo mover la reserva.");
      }
      logger.info({
        scope: "reservations.update",
        message: "Reservation rescheduled",
        meta: { reservationId: input.id, moveToISO: input.moveToISO },
      });
    }

    const patch = {
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_email: input.customerEmail,
      customer_comment: input.customerComment,
      internal_notes: input.internalNotes,
      status: input.status,
    };

    const cleanedPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(cleanedPatch).length > 0) {
      const { error } = await this.supabase
        .from("reservations")
        .update(cleanedPatch)
        .eq("id", input.id)
        .eq("restaurant_id", input.restaurantId);

      if (error) {
        throw fromSupabaseError(error, "No se pudo editar la reserva.");
      }
      logger.info({
        scope: "reservations.update",
        message: "Reservation fields updated",
        meta: { reservationId: input.id },
      });
    }

    if (input.status) {
      const { error: tableStatusError } = await this.supabase
        .from("reservation_tables")
        .update({ reservation_status: input.status })
        .eq("reservation_id", input.id);
      if (tableStatusError) {
        throw fromSupabaseError(tableStatusError, "No se pudo sincronizar estado de mesas.");
      }

      if (input.status === "no_show") {
        await this.handleRepeatedNoShow(input.id, input.restaurantId, input.adminUserId ?? null);
      }
    }
  }

  private async handleRepeatedNoShow(
    reservationId: string,
    restaurantId: string,
    adminUserId: string | null,
  ) {
    const { data: reservation, error: reservationError } = await this.supabase
      .from("reservations")
      .select("id, customer_name, customer_email, customer_phone")
      .eq("id", reservationId)
      .eq("restaurant_id", restaurantId)
      .single();

    if (reservationError || !reservation) {
      throw fromSupabaseError(
        reservationError ?? { message: "Reservation not found for no-show check" },
        "No se pudo validar no-show repetido.",
      );
    }

    const { count, error: noShowCountError } = await this.supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("customer_email", reservation.customer_email)
      .eq("status", "no_show");

    if (noShowCountError) {
      throw fromSupabaseError(noShowCountError, "No se pudo calcular historico de no-show.");
    }

    if ((count ?? 0) < 2) return;

    const { data: existing, error: existingError } = await this.supabase
      .from("customer_blacklist")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("customer_email", reservation.customer_email)
      .eq("customer_phone", reservation.customer_phone)
      .eq("is_active", true)
      .is("removed_at", null)
      .maybeSingle();

    if (existingError) {
      throw fromSupabaseError(existingError, "No se pudo consultar lista negra.");
    }

    if (existing) {
      const { error: eventError } = await this.supabase
        .from("customer_blacklist_events")
        .insert({
          blacklist_id: existing.id,
          event_type: "repeat_no_show",
          note: "Cliente reincide en no-show",
          metadata: { reservation_id: reservationId, no_show_count: count },
          actor_admin_user_id: adminUserId,
        });
      if (eventError) {
        throw fromSupabaseError(eventError, "No se pudo registrar evento de lista negra.");
      }
      return;
    }

    const { data: inserted, error: insertError } = await this.supabase
      .from("customer_blacklist")
      .insert({
        restaurant_id: restaurantId,
        customer_name: reservation.customer_name,
        customer_email: reservation.customer_email,
        customer_phone: reservation.customer_phone,
        reason: `No-show repetido (${count} veces)`,
        is_active: true,
        created_by_admin_user_id: adminUserId,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      throw fromSupabaseError(
        insertError ?? { message: "Unable to create blacklist record" },
        "No se pudo añadir cliente a lista negra.",
      );
    }

    const { error: eventError } = await this.supabase
      .from("customer_blacklist_events")
      .insert({
        blacklist_id: inserted.id,
        event_type: "added_automatic",
        note: "Alta automatica por no-show repetido",
        metadata: { reservation_id: reservationId, no_show_count: count },
        actor_admin_user_id: adminUserId,
      });

    if (eventError) {
      throw fromSupabaseError(eventError, "No se pudo registrar historial de lista negra.");
    }
  }

  async cancelReservation(id: string, restaurantId: string): Promise<CancelledReservationRow> {
    const { data: reservation, error: reservationError } = (await this.supabase
      .from("reservations")
      .select(
        "id, reservation_code, customer_name, customer_email, customer_phone, customer_comment, party_size, start_at",
      )
      .eq("id", id)
      .eq("restaurant_id", restaurantId)
      .single()) as {
      data: CancelledReservationRow | null;
      error: { message: string; code?: string; details?: string | null } | null;
    };

    if (reservationError || !reservation) {
      throw fromSupabaseError(
        reservationError ?? { message: "Reservation not found" },
        "No se encontro la reserva para cancelar.",
      );
    }

    const { error } = await this.supabase
      .from("reservations")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", id)
      .eq("restaurant_id", restaurantId);

    if (error) {
      throw fromSupabaseError(error, "No se pudo cancelar la reserva.");
    }

    const { error: tableError } = await this.supabase
      .from("reservation_tables")
      .update({ reservation_status: "cancelled" })
      .eq("reservation_id", id);

    if (tableError) {
      throw fromSupabaseError(tableError, "No se pudo liberar la ocupacion de mesas.");
    }

    logger.info({
      scope: "reservations.cancel",
      message: "Reservation cancelled",
      meta: { reservationId: id },
    });

    return reservation;
  }

  async deleteReservationPermanent(id: string, restaurantId: string) {
    const { data: existing, error: lookupError } = await this.supabase
      .from("reservations")
      .select("id")
      .eq("id", id)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    if (lookupError) {
      throw fromSupabaseError(lookupError, "No se pudo comprobar la reserva.");
    }
    if (!existing) {
      throw new AppError("Reserva no encontrada.", 404, "RESERVATION_NOT_FOUND");
    }

    const { error } = await this.supabase
      .from("reservations")
      .delete()
      .eq("id", id)
      .eq("restaurant_id", restaurantId);

    if (error) {
      throw fromSupabaseError(error, "No se pudo borrar la reserva.");
    }

    logger.info({
      scope: "reservations.delete",
      message: "Reservation permanently deleted",
      meta: { reservationId: id, restaurantId },
    });
  }

  async createBlock(input: AdminBlockCreateInput) {
    const { error } = await this.supabase.from("blocked_slots").insert({
      restaurant_id: input.restaurantId,
      table_id: input.tableId ?? null,
      starts_at: input.startsAtISO,
      ends_at: input.endsAtISO,
      reason: input.reason,
      created_by_admin_user_id: input.adminUserId,
    });
    if (error) {
      throw fromSupabaseError(error, "No se pudo crear el bloqueo.");
    }
    logger.info({
      scope: "blocks.create",
      message: "Manual block created",
      meta: { restaurantId: input.restaurantId, tableId: input.tableId ?? "all" },
    });
  }

  async listBlocks(restaurantId: string, date?: string) {
    let query = this.supabase
      .from("blocked_slots")
      .select("id, table_id, starts_at, ends_at, reason, is_active")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("starts_at", { ascending: true });

    if (date) {
      const dayRange = madridDateToUtcDayRange(date);
      query = query.gte("starts_at", dayRange.startUtcIso).lte("starts_at", dayRange.endUtcIso);
    }

    const { data, error } = await query;
    if (error) {
      throw fromSupabaseError(error, "No se pudieron cargar los bloqueos.");
    }
    return data;
  }

  async removeBlock(id: string, restaurantId: string) {
    const { error } = await this.supabase
      .from("blocked_slots")
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .is("deleted_at", null);

    if (error) {
      throw fromSupabaseError(error, "No se pudo eliminar el bloqueo.");
    }

    logger.info({
      scope: "blocks.remove",
      message: "Manual block removed",
      meta: { blockId: id, restaurantId },
    });
  }

  async readCalendar(input: AdminCalendarQueryInput) {
    const [reservations, blocks] = await Promise.all([
      this.listReservations({
        restaurantId: input.restaurantId,
        date: input.date,
      }),
      this.listBlocks(input.restaurantId, input.date),
    ]);

    const grouped = reservations.reduce<Record<string, typeof reservations>>((acc, item) => {
      const time = utcDateToMadridTimeHHmm(item.start_at);
      if (!acc[time]) acc[time] = [];
      acc[time].push(item);
      return acc;
    }, {});

    return {
      date: input.date,
      slots: grouped,
      reservations,
      blocks,
    };
  }

  async readCalendarMonthSummary(input: AdminCalendarMonthQueryInput) {
    const [year, month] = input.month.split("-").map(Number);
    const monthStart = `${input.month}-01`;
    const monthEndDate = new Date(year, month, 0).getDate();
    const monthEnd = `${input.month}-${String(monthEndDate).padStart(2, "0")}`;

    const startRange = madridDateToUtcDayRange(monthStart);
    const endRange = madridDateToUtcDayRange(monthEnd);

    const { data, error } = await this.supabase
      .from("reservations")
      .select("start_at, status")
      .eq("restaurant_id", input.restaurantId)
      .gte("start_at", startRange.startUtcIso)
      .lte("start_at", endRange.endUtcIso)
      .in("status", ["pending", "confirmed", "seated", "finished", "no_show"]);

    if (error) {
      throw fromSupabaseError(error, "No se pudo cargar resumen mensual del calendario.");
    }

    const days = new Map<string, number>();
    for (const item of data ?? []) {
      const date = new Date(item.start_at);
      const localDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Madrid",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
      days.set(localDate, (days.get(localDate) ?? 0) + 1);
    }

    return {
      month: input.month,
      days: Array.from(days.entries()).map(([date, count]) => ({ date, count })),
    };
  }

  async getReservationById(id: string, restaurantId: string) {
    const { data, error } = await this.supabase
      .from("reservations")
      .select(
        "id, reservation_code, status, customer_name, customer_phone, customer_email, party_size, start_at, internal_notes, customer_comment",
      )
      .eq("id", id)
      .eq("restaurant_id", restaurantId)
      .single();
    if (error) {
      throw fromSupabaseError(error, "No se pudo cargar la reserva.");
    }
    return data;
  }

  async getAdminSettings(restaurantId: string) {
    const [{ data: restaurant, error: restaurantError }, { data: rules, error: rulesError }] =
      await Promise.all([
        this.supabase.from("restaurants").select("id, name, timezone").eq("id", restaurantId).single(),
        this.supabase
          .from("reservation_rules")
          .select(
            "id, slot_interval_minutes, default_buffer_before_minutes, default_buffer_after_minutes, max_reservations_per_slot",
          )
          .eq("restaurant_id", restaurantId)
          .eq("is_active", true)
          .is("deleted_at", null)
          .single(),
      ]);

    if (restaurantError || !restaurant) {
      throw fromSupabaseError(restaurantError ?? { message: "Restaurant not found" }, "No se pudo leer ajustes.");
    }
    if (rulesError || !rules) {
      throw fromSupabaseError(rulesError ?? { message: "Rules not found" }, "No se pudo leer reglas.");
    }

    return {
      restaurant,
      rules,
    };
  }

  async updateAdminSettings(input: AdminSettingsUpdateInput) {
    const { error: restaurantError } = await this.supabase
      .from("restaurants")
      .update({
        name: input.restaurantName,
        timezone: input.timezone,
      })
      .eq("id", input.restaurantId);

    if (restaurantError) {
      throw fromSupabaseError(restaurantError, "No se pudo actualizar restaurante.");
    }

    const { error: rulesError } = await this.supabase
      .from("reservation_rules")
      .update({
        slot_interval_minutes: input.slotIntervalMinutes,
        default_buffer_before_minutes: input.bufferBeforeMinutes,
        default_buffer_after_minutes: input.bufferAfterMinutes,
        max_reservations_per_slot: input.maxReservationsPerSlot,
      })
      .eq("restaurant_id", input.restaurantId)
      .eq("is_active", true)
      .is("deleted_at", null);

    if (rulesError) {
      throw fromSupabaseError(rulesError, "No se pudieron actualizar reglas.");
    }
  }

  async listBlacklist(input: AdminBlacklistListInput) {
    let query = this.supabase
      .from("customer_blacklist")
      .select(
        "id, customer_name, customer_email, customer_phone, reason, is_active, created_at, removed_at",
      )
      .eq("restaurant_id", input.restaurantId)
      .order("created_at", { ascending: false });

    if (input.query) {
      query = query.or(
        `customer_name.ilike.%${input.query}%,customer_email.ilike.%${input.query}%,customer_phone.ilike.%${input.query}%`,
      );
    }

    const { data, error } = await query;
    if (error) {
      throw fromSupabaseError(error, "No se pudo leer la lista negra.");
    }
    return data;
  }

  async createBlacklist(input: AdminBlacklistCreateInput) {
    const { data: existing, error: existingError } = await this.supabase
      .from("customer_blacklist")
      .select("id, is_active")
      .eq("restaurant_id", input.restaurantId)
      .eq("customer_email", input.customerEmail)
      .eq("customer_phone", input.customerPhone)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (existingError) {
      throw fromSupabaseError(existingError, "No se pudo consultar lista negra.");
    }

    if (existing?.is_active) {
      return { id: existing.id, status: "already_active" as const };
    }

    if (existing) {
      const { error: reactivateError } = await this.supabase
        .from("customer_blacklist")
        .update({
          customer_name: input.customerName,
          reason: input.reason,
          is_active: true,
          removed_at: null,
          removed_by_admin_user_id: null,
          created_by_admin_user_id: input.adminUserId,
        })
        .eq("id", existing.id);
      if (reactivateError) {
        throw fromSupabaseError(reactivateError, "No se pudo reactivar lista negra.");
      }

      const { error: eventError } = await this.supabase.from("customer_blacklist_events").insert({
        blacklist_id: existing.id,
        event_type: "added_manual",
        note: input.reason,
        metadata: { source: "manual_reactivate" },
        actor_admin_user_id: input.adminUserId,
      });
      if (eventError) {
        throw fromSupabaseError(eventError, "No se pudo registrar historial.");
      }
      return { id: existing.id, status: "reactivated" as const };
    }

    const { data: created, error: createError } = await this.supabase
      .from("customer_blacklist")
      .insert({
        restaurant_id: input.restaurantId,
        customer_name: input.customerName,
        customer_email: input.customerEmail,
        customer_phone: input.customerPhone,
        reason: input.reason,
        is_active: true,
        created_by_admin_user_id: input.adminUserId,
      })
      .select("id")
      .single();
    if (createError || !created) {
      throw fromSupabaseError(createError ?? { message: "Unable to create blacklist" }, "No se pudo crear la entrada de lista negra.");
    }

    const { error: eventError } = await this.supabase.from("customer_blacklist_events").insert({
      blacklist_id: created.id,
      event_type: "added_manual",
      note: input.reason,
      metadata: { source: "manual" },
      actor_admin_user_id: input.adminUserId,
    });
    if (eventError) {
      throw fromSupabaseError(eventError, "No se pudo registrar historial de lista negra.");
    }

    return { id: created.id, status: "created" as const };
  }

  async updateBlacklist(input: AdminBlacklistUpdateInput) {
    if (input.action !== "remove") return;

    const { error } = await this.supabase
      .from("customer_blacklist")
      .update({
        is_active: false,
        removed_at: new Date().toISOString(),
        removed_by_admin_user_id: input.adminUserId,
      })
      .eq("id", input.id)
      .eq("restaurant_id", input.restaurantId);

    if (error) {
      throw fromSupabaseError(error, "No se pudo actualizar lista negra.");
    }

    const { error: eventError } = await this.supabase
      .from("customer_blacklist_events")
      .insert({
        blacklist_id: input.id,
        event_type: "removed",
        note: input.note ?? "Eliminado manualmente",
        metadata: { source: "manual" },
        actor_admin_user_id: input.adminUserId,
      });
    if (eventError) {
      throw fromSupabaseError(eventError, "No se pudo guardar el historial.");
    }
  }

  async listBlacklistHistory(id: string, restaurantId: string) {
    const { data: blacklist, error: blacklistError } = await this.supabase
      .from("customer_blacklist")
      .select("id")
      .eq("id", id)
      .eq("restaurant_id", restaurantId)
      .single();

    if (blacklistError || !blacklist) {
      throw fromSupabaseError(
        blacklistError ?? { message: "Blacklist entry not found" },
        "No se encontro la entrada de lista negra.",
      );
    }

    const { data, error } = await this.supabase
      .from("customer_blacklist_events")
      .select("id, event_type, note, metadata, created_at")
      .eq("blacklist_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      throw fromSupabaseError(error, "No se pudo cargar historial de lista negra.");
    }
    return data;
  }

  async listContacts(input: AdminContactListInput) {
    let query = this.supabase
      .from("reservations")
      .select("customer_name, customer_email, customer_phone, start_at, status")
      .eq("restaurant_id", input.restaurantId)
      .order("start_at", { ascending: false });

    if (input.query) {
      query = query.or(
        `customer_name.ilike.%${input.query}%,customer_email.ilike.%${input.query}%,customer_phone.ilike.%${input.query}%`,
      );
    }

    const { data, error } = await query;
    if (error) {
      throw fromSupabaseError(error, "No se pudo cargar historial de contactos.");
    }

    const { data: blacklistRows, error: blacklistError } = await this.supabase
      .from("customer_blacklist")
      .select("id, customer_email, customer_phone, is_active")
      .eq("restaurant_id", input.restaurantId)
      .eq("is_active", true)
      .is("removed_at", null);

    if (blacklistError) {
      throw fromSupabaseError(blacklistError, "No se pudo validar lista negra en contactos.");
    }

    const blacklistedMap = new Map(
      (blacklistRows ?? []).map((row) => [`${row.customer_email}|${row.customer_phone}`, row.id]),
    );

    const grouped = new Map<
      string,
      {
        customer_name: string;
        customer_email: string;
        customer_phone: string;
        total_reservations: number;
        no_show_count: number;
        last_reservation_at: string;
        is_blacklisted: boolean;
        blacklist_id: string | null;
      }
    >();

    for (const item of data ?? []) {
      const key = `${item.customer_email}|${item.customer_phone}`;
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          customer_name: item.customer_name,
          customer_email: item.customer_email,
          customer_phone: item.customer_phone,
          total_reservations: 1,
          no_show_count: item.status === "no_show" ? 1 : 0,
          last_reservation_at: item.start_at,
          is_blacklisted: blacklistedMap.has(key),
          blacklist_id: blacklistedMap.get(key) ?? null,
        });
      } else {
        existing.total_reservations += 1;
        existing.no_show_count += item.status === "no_show" ? 1 : 0;
      }
    }

    return Array.from(grouped.values()).sort((a, b) =>
      b.last_reservation_at.localeCompare(a.last_reservation_at),
    );
  }

  async deleteContact(input: AdminContactDeleteInput) {
    const { error: reservationDeleteError } = await this.supabase
      .from("reservations")
      .delete()
      .eq("restaurant_id", input.restaurantId)
      .eq("customer_email", input.customerEmail)
      .eq("customer_phone", input.customerPhone);

    if (reservationDeleteError) {
      throw fromSupabaseError(reservationDeleteError, "No se pudo borrar historial de reservas del contacto.");
    }

    const { error: blacklistDeleteError } = await this.supabase
      .from("customer_blacklist")
      .delete()
      .eq("restaurant_id", input.restaurantId)
      .eq("customer_email", input.customerEmail)
      .eq("customer_phone", input.customerPhone);

    if (blacklistDeleteError) {
      throw fromSupabaseError(blacklistDeleteError, "No se pudo borrar lista negra del contacto.");
    }

    logger.info({
      scope: "contacts.delete",
      message: "Contact history permanently deleted",
      meta: {
        restaurantId: input.restaurantId,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        adminUserId: input.adminUserId,
      },
    });
  }

  private normalizePhoneDigits(phone: string) {
    return phone.replace(/\D/g, "");
  }

  async listPublicCustomerReservations(input: {
    restaurantId: string;
    customerEmail: string;
    customerPhone: string;
  }): Promise<
    Array<{
      id: string;
      reservation_code: string;
      status: string;
      party_size: number;
      start_at: string;
      customer_name: string;
    }>
  > {
    const email = input.customerEmail.trim().toLowerCase();
    const wantDigits = this.normalizePhoneDigits(input.customerPhone);

    const { data, error } = await this.supabase
      .from("reservations")
      .select("id, reservation_code, status, party_size, start_at, customer_name, customer_phone")
      .eq("restaurant_id", input.restaurantId)
      .eq("customer_email", email)
      .order("start_at", { ascending: false });

    if (error) {
      throw fromSupabaseError(error, "No se pudieron cargar las reservas.");
    }

    const rows = (data ?? []).filter(
      (row) => this.normalizePhoneDigits(row.customer_phone) === wantDigits,
    );

    return rows.map((row) => ({
      id: row.id,
      reservation_code: row.reservation_code,
      status: row.status,
      party_size: row.party_size,
      start_at: row.start_at,
      customer_name: row.customer_name,
    }));
  }

  async purgeRestaurantOperationalData(restaurantId: string) {
    const { error } = await this.supabase.rpc("rpc_purge_restaurant_operational_data", {
      p_restaurant_id: restaurantId,
    });
    if (error) {
      throw fromSupabaseError(error, "No se pudo vaciar los datos operativos.");
    }
    logger.info({
      scope: "admin.purge",
      message: "Operational data purged",
      meta: { restaurantId },
    });
  }
}
