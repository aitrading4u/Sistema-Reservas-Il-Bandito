import { isDemoMode } from "@/lib/demo-mode";
import { createSupabaseClient } from "@/lib/supabase/client";
import { blockSeed, reservationSeed } from "@/modules/admin/data/admin.seed";

export type AdminReservationStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "seated"
  | "finished"
  | "no_show";

export interface AdminReservationRow {
  id: string;
  reservation_code: string;
  status: AdminReservationStatus;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  party_size: number;
  start_at: string;
  internal_notes: string | null;
  customer_comment: string | null;
}

interface ApiErrorPayload {
  error?: string;
}

const DEMO_RESERVATIONS_KEY = "ilbandito.demo.reservations.v1";
const DEMO_BLOCKS_KEY = "ilbandito.demo.blocks.v1";
const DEMO_SETTINGS_KEY = "ilbandito.demo.settings.v1";
const DEMO_BLACKLIST_KEY = "ilbandito.demo.blacklist.v1";
const DEMO_BLACKLIST_HISTORY_KEY = "ilbandito.demo.blacklist.history.v1";

function isClient() {
  return typeof window !== "undefined";
}

function toIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function fromIsoDate(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function fromIsoTime(iso: string) {
  return new Date(iso).toISOString().slice(11, 16);
}

function defaultDemoReservations(): AdminReservationRow[] {
  return reservationSeed.map((row) => ({
    id: row.id,
    reservation_code: row.code,
    status: row.status,
    customer_name: row.customerName,
    customer_phone: row.customerPhone,
    customer_email: row.customerEmail,
    party_size: row.partySize,
    start_at: toIso(row.date, row.time),
    internal_notes: row.notesInternal ?? null,
    customer_comment: row.comments ?? null,
  }));
}

function readDemoState<T>(key: string, fallback: T): T {
  if (!isClient()) return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeDemoState<T>(key: string, value: T) {
  if (!isClient()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function getDemoReservations() {
  return readDemoState(DEMO_RESERVATIONS_KEY, defaultDemoReservations());
}

function setDemoReservations(next: AdminReservationRow[]) {
  writeDemoState(DEMO_RESERVATIONS_KEY, next);
}

function getDemoBlocks() {
  return readDemoState(
    DEMO_BLOCKS_KEY,
    blockSeed.map((item) => ({
      id: item.id,
      table_id: item.target ?? null,
      starts_at: toIso(item.date, item.startTime),
      ends_at: toIso(item.date, item.endTime),
      reason: item.reason,
    })),
  );
}

function setDemoBlocks(next: Array<{ id: string; table_id: string | null; starts_at: string; ends_at: string; reason: string }>) {
  writeDemoState(DEMO_BLOCKS_KEY, next);
}

function getDemoSettings() {
  return readDemoState(DEMO_SETTINGS_KEY, {
    restaurant: {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Il Bandito",
      timezone: "Europe/Madrid",
    },
    rules: {
      id: "demo-rules",
      slot_interval_minutes: 15,
      default_buffer_before_minutes: 0,
      default_buffer_after_minutes: 15,
    },
  });
}

type DemoBlacklistRow = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  reason: string;
  is_active: boolean;
  created_at: string;
  removed_at: string | null;
};

function getDemoBlacklist() {
  return readDemoState<DemoBlacklistRow[]>(DEMO_BLACKLIST_KEY, []);
}

function setDemoBlacklist(value: DemoBlacklistRow[]) {
  writeDemoState(DEMO_BLACKLIST_KEY, value);
}

function getDemoBlacklistHistory() {
  return readDemoState<
    Record<
      string,
      Array<{ id: string; event_type: string; note: string; metadata: Record<string, unknown>; created_at: string }>
    >
  >(DEMO_BLACKLIST_HISTORY_KEY, {});
}

function pushDemoBlacklistHistory(
  blacklistId: string,
  entry: { event_type: string; note: string; metadata?: Record<string, unknown> },
) {
  const history = getDemoBlacklistHistory();
  history[blacklistId] = [
    {
      id: `hist-${Date.now()}`,
      event_type: entry.event_type,
      note: entry.note,
      metadata: entry.metadata ?? {},
      created_at: new Date().toISOString(),
    },
    ...(history[blacklistId] ?? []),
  ];
  writeDemoState(DEMO_BLACKLIST_HISTORY_KEY, history);
}

function adminFetchInit(init: RequestInit = {}): RequestInit {
  return { credentials: "include", ...init };
}

/** Align cookie with Supabase session before each API call (JWT auto-refresh in localStorage, cookie was only set at login). */
async function ensureAdminAccessCookieFromSession() {
  if (isDemoMode() || !isClient()) return;
  try {
    const supabase = createSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      document.cookie = `admin_access_token=${encodeURIComponent(session.access_token)}; Path=/; Max-Age=28800; SameSite=Lax`;
    }
  } catch {
    // Missing NEXT_PUBLIC env, etc.
  }
}

async function adminFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  await ensureAdminAccessCookieFromSession();
  return fetch(input, adminFetchInit(init));
}

async function unwrapResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | (T & ApiErrorPayload & { code?: string })
    | null;

  if (isClient() && response.status === 401) {
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.replace(`/admin/login?next=${encodeURIComponent(next)}`);
    return new Promise<T>(() => {});
  }

  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? "No se pudo completar la solicitud.");
  }
  return payload;
}

function toQuery(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export async function fetchAdminReservations(filters: {
  date?: string;
  status?: string;
  name?: string;
}) {
  if (isDemoMode()) {
    const rows = getDemoReservations()
      .filter((row) => (filters.date ? fromIsoDate(row.start_at) === filters.date : true))
      .filter((row) => (filters.status ? row.status === filters.status : true))
      .filter((row) =>
        filters.name
          ? row.customer_name.toLowerCase().includes(filters.name.toLowerCase())
          : true,
      )
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
    return { items: rows };
  }

  const query = toQuery(filters);
  const response = await adminFetch(`/api/admin/reservations${query}`, { cache: "no-store" });
  return unwrapResponse<{ items: AdminReservationRow[] }>(response);
}

export async function fetchAdminReservation(id: string) {
  if (isDemoMode()) {
    const row = getDemoReservations().find((item) => item.id === id);
    if (!row) throw new Error("Reserva no encontrada en demo.");
    return { item: row };
  }
  const response = await adminFetch(`/api/admin/reservations/${id}`, { cache: "no-store" });
  return unwrapResponse<{ item: AdminReservationRow }>(response);
}

export async function createAdminReservation(payload: {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  partySize: number;
  startAtISO: string;
  customerComment?: string;
}) {
  if (isDemoMode()) {
    const rows = getDemoReservations();
    const id = `demo-${Date.now()}`;
    const nextRow: AdminReservationRow = {
      id,
      reservation_code: `IB-${id.slice(-6).toUpperCase()}`,
      status: "confirmed",
      customer_name: payload.customerName,
      customer_phone: payload.customerPhone,
      customer_email: payload.customerEmail,
      party_size: payload.partySize,
      start_at: payload.startAtISO,
      internal_notes: null,
      customer_comment: payload.customerComment ?? null,
    };
    setDemoReservations([nextRow, ...rows]);
    return { reservationId: id };
  }

  const response = await adminFetch("/api/admin/reservations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return unwrapResponse<{ reservationId: string }>(response);
}

export async function updateAdminReservation(id: string, payload: Record<string, unknown>) {
  if (isDemoMode()) {
    const rows = getDemoReservations().map((row) => {
      if (row.id !== id) return row;
      return {
        ...row,
        status: (payload.status as AdminReservationStatus | undefined) ?? row.status,
        customer_name: (payload.customerName as string | undefined) ?? row.customer_name,
        customer_phone: (payload.customerPhone as string | undefined) ?? row.customer_phone,
        customer_email: (payload.customerEmail as string | undefined) ?? row.customer_email,
        party_size: (payload.partySize as number | undefined) ?? row.party_size,
        customer_comment: (payload.customerComment as string | undefined) ?? row.customer_comment,
        internal_notes: (payload.internalNotes as string | undefined) ?? row.internal_notes,
        start_at: (payload.moveToISO as string | undefined) ?? row.start_at,
      };
    });
    setDemoReservations(rows);

    if (payload.status === "no_show") {
      const updated = rows.find((row) => row.id === id);
      if (updated) {
        const noShowCount = rows.filter(
          (row) => row.customer_email === updated.customer_email && row.status === "no_show",
        ).length;
        if (noShowCount >= 2) {
          const blacklist = getDemoBlacklist();
          const existing = blacklist.find(
            (item) =>
              item.customer_email === updated.customer_email &&
              item.customer_phone === updated.customer_phone &&
              item.is_active,
          );
          if (!existing) {
            const created: DemoBlacklistRow = {
              id: `bl-${Date.now()}`,
              customer_name: updated.customer_name,
              customer_email: updated.customer_email,
              customer_phone: updated.customer_phone,
              reason: `No-show repetido (${noShowCount} veces)`,
              is_active: true,
              created_at: new Date().toISOString(),
              removed_at: null,
            };
            setDemoBlacklist([created, ...blacklist]);
            pushDemoBlacklistHistory(created.id, {
              event_type: "added_automatic",
              note: "Alta automatica por no-show repetido",
              metadata: { reservation_id: id, no_show_count: noShowCount },
            });
          } else {
            pushDemoBlacklistHistory(existing.id, {
              event_type: "repeat_no_show",
              note: "Reincidencia no-show",
              metadata: { reservation_id: id, no_show_count: noShowCount },
            });
          }
        }
      }
    }

    return { status: "updated" };
  }

  const response = await adminFetch(`/api/admin/reservations/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return unwrapResponse<{ status: string }>(response);
}

export async function cancelAdminReservation(id: string) {
  if (isDemoMode()) {
    const rows = getDemoReservations().map((row) =>
      row.id === id ? { ...row, status: "cancelled" as const } : row,
    );
    setDemoReservations(rows);
    return { status: "cancelled" };
  }
  const response = await adminFetch(`/api/admin/reservations/${id}`, { method: "DELETE" });
  return unwrapResponse<{ status: string }>(response);
}

export async function deleteAdminReservationPermanent(id: string) {
  if (isDemoMode()) {
    const rows = getDemoReservations().filter((row) => row.id !== id);
    setDemoReservations(rows);
    return { status: "deleted" };
  }
  const response = await adminFetch(`/api/admin/reservations/${id}/purge`, { method: "DELETE" });
  return unwrapResponse<{ status: string }>(response);
}

export async function fetchAdminCalendar(date: string) {
  if (isDemoMode()) {
    const reservations = getDemoReservations().filter(
      (item) => fromIsoDate(item.start_at) === date,
    );
    const slots = reservations.reduce<Record<string, AdminReservationRow[]>>((acc, row) => {
      const time = fromIsoTime(row.start_at);
      if (!acc[time]) acc[time] = [];
      acc[time].push(row);
      return acc;
    }, {});
    return {
      date,
      slots,
      reservations,
      blocks: getDemoBlocks().filter((block) => fromIsoDate(block.starts_at) === date),
    };
  }

  const response = await adminFetch(`/api/admin/calendar?date=${encodeURIComponent(date)}`, {
    cache: "no-store",
  });
  return unwrapResponse<{
    date: string;
    slots: Record<string, AdminReservationRow[]>;
    reservations: AdminReservationRow[];
    blocks: Array<{ id: string; table_id: string | null; starts_at: string; ends_at: string; reason: string }>;
  }>(response);
}

export async function fetchAdminCalendarMonthSummary(month: string) {
  if (isDemoMode()) {
    const reservations = getDemoReservations().filter((item) => fromIsoDate(item.start_at).startsWith(`${month}-`));
    const map = new Map<string, number>();
    for (const row of reservations) {
      const date = fromIsoDate(row.start_at);
      map.set(date, (map.get(date) ?? 0) + 1);
    }
    return {
      month,
      days: Array.from(map.entries()).map(([date, count]) => ({ date, count })),
    };
  }
  const response = await adminFetch(
    `/api/admin/calendar/month?month=${encodeURIComponent(month)}`,
    { cache: "no-store" },
  );
  return unwrapResponse<{ month: string; days: Array<{ date: string; count: number }> }>(response);
}

export async function fetchAdminBlocks(date?: string) {
  if (isDemoMode()) {
    const items = getDemoBlocks().filter((item) =>
      date ? fromIsoDate(item.starts_at) === date : true,
    );
    return { items };
  }
  const response = await adminFetch(
    `/api/admin/blocks${date ? `?date=${encodeURIComponent(date)}` : ""}`,
    { cache: "no-store" },
  );
  return unwrapResponse<{
    items: Array<{ id: string; table_id: string | null; starts_at: string; ends_at: string; reason: string }>;
  }>(response);
}

export async function createAdminBlock(payload: {
  startsAtISO: string;
  endsAtISO: string;
  reason: string;
}) {
  if (isDemoMode()) {
    const items = getDemoBlocks();
    const next = [
      {
        id: `demo-block-${Date.now()}`,
        table_id: null,
        starts_at: payload.startsAtISO,
        ends_at: payload.endsAtISO,
        reason: payload.reason,
      },
      ...items,
    ];
    setDemoBlocks(next);
    return { status: "created" };
  }

  const response = await adminFetch("/api/admin/blocks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return unwrapResponse<{ status: string }>(response);
}

export async function removeAdminBlock(id: string) {
  if (isDemoMode()) {
    const items = getDemoBlocks().filter((item) => item.id !== id);
    setDemoBlocks(items);
    return { status: "deleted" };
  }

  const response = await adminFetch(`/api/admin/blocks/${id}`, { method: "DELETE" });
  return unwrapResponse<{ status: string }>(response);
}

export async function fetchAdminSettings() {
  if (isDemoMode()) {
    return getDemoSettings();
  }
  const response = await adminFetch("/api/admin/settings", { cache: "no-store" });
  return unwrapResponse<{
    restaurant: { id: string; name: string; timezone: string };
    rules: {
      id: string;
      slot_interval_minutes: number;
      default_buffer_before_minutes: number;
      default_buffer_after_minutes: number;
    };
  }>(response);
}

export async function saveAdminSettings(payload: {
  restaurantName: string;
  timezone: "Europe/Madrid";
  slotIntervalMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
}) {
  if (isDemoMode()) {
    const current = getDemoSettings();
    const next = {
      ...current,
      restaurant: {
        ...current.restaurant,
        name: payload.restaurantName,
        timezone: payload.timezone,
      },
      rules: {
        ...current.rules,
        slot_interval_minutes: payload.slotIntervalMinutes,
        default_buffer_before_minutes: payload.bufferBeforeMinutes,
        default_buffer_after_minutes: payload.bufferAfterMinutes,
      },
    };
    writeDemoState(DEMO_SETTINGS_KEY, next);
    return { status: "updated" };
  }

  const response = await adminFetch("/api/admin/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return unwrapResponse<{ status: string }>(response);
}

export async function fetchBlacklist(query?: string) {
  if (isDemoMode()) {
    const items = getDemoBlacklist()
      .filter((row) =>
        query
          ? `${row.customer_name} ${row.customer_email} ${row.customer_phone}`
              .toLowerCase()
              .includes(query.toLowerCase())
          : true,
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { items };
  }
  const response = await adminFetch(
    `/api/admin/blacklist${query ? `?query=${encodeURIComponent(query)}` : ""}`,
    { cache: "no-store" },
  );
  return unwrapResponse<{ items: DemoBlacklistRow[] }>(response);
}

export async function createBlacklistEntry(payload: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  reason: string;
}) {
  if (isDemoMode()) {
    const blacklist = getDemoBlacklist();
    const existing = blacklist.find(
      (item) =>
        item.customer_email === payload.customerEmail &&
        item.customer_phone === payload.customerPhone &&
        item.is_active,
    );
    if (existing) return { id: existing.id, status: "already_active" as const };
    const created: DemoBlacklistRow = {
      id: `bl-${Date.now()}`,
      customer_name: payload.customerName,
      customer_email: payload.customerEmail,
      customer_phone: payload.customerPhone,
      reason: payload.reason,
      is_active: true,
      created_at: new Date().toISOString(),
      removed_at: null,
    };
    setDemoBlacklist([created, ...blacklist]);
    pushDemoBlacklistHistory(created.id, {
      event_type: "added_manual",
      note: payload.reason,
      metadata: { source: "manual" },
    });
    return { id: created.id, status: "created" as const };
  }
  const response = await adminFetch("/api/admin/blacklist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return unwrapResponse<{ id: string; status: string }>(response);
}

export async function removeBlacklistEntry(id: string, note?: string) {
  if (isDemoMode()) {
    const blacklist = getDemoBlacklist().map((item) =>
      item.id === id
        ? {
            ...item,
            is_active: false,
            removed_at: new Date().toISOString(),
          }
        : item,
    );
    setDemoBlacklist(blacklist);
    pushDemoBlacklistHistory(id, {
      event_type: "removed",
      note: note ?? "Eliminado manualmente",
      metadata: { source: "manual" },
    });
    return { status: "updated" };
  }
  const response = await adminFetch(`/api/admin/blacklist/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "remove", note }),
  });
  return unwrapResponse<{ status: string }>(response);
}

export async function fetchBlacklistHistory(id: string) {
  if (isDemoMode()) {
    const history = getDemoBlacklistHistory();
    return { items: history[id] ?? [] };
  }
  const response = await adminFetch(`/api/admin/blacklist/${id}/history`, { cache: "no-store" });
  return unwrapResponse<{
    items: Array<{ id: string; event_type: string; note: string; metadata: Record<string, unknown>; created_at: string }>;
  }>(response);
}

export async function fetchContacts(query?: string) {
  if (isDemoMode()) {
    const reservations = getDemoReservations();
    const blacklist = getDemoBlacklist();
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

    for (const row of reservations) {
      const key = `${row.customer_email}|${row.customer_phone}`;
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          customer_name: row.customer_name,
          customer_email: row.customer_email,
          customer_phone: row.customer_phone,
          total_reservations: 1,
          no_show_count: row.status === "no_show" ? 1 : 0,
          last_reservation_at: row.start_at,
          is_blacklisted: blacklist.some(
            (item) =>
              item.customer_email === row.customer_email &&
              item.customer_phone === row.customer_phone &&
              item.is_active,
          ),
          blacklist_id:
            blacklist.find(
              (item) =>
                item.customer_email === row.customer_email &&
                item.customer_phone === row.customer_phone &&
                item.is_active,
            )?.id ?? null,
        });
      } else {
        existing.total_reservations += 1;
        existing.no_show_count += row.status === "no_show" ? 1 : 0;
      }
    }

    const items = Array.from(grouped.values())
      .filter((item) =>
        query
          ? `${item.customer_name} ${item.customer_email} ${item.customer_phone}`
              .toLowerCase()
              .includes(query.toLowerCase())
          : true,
      )
      .sort((a, b) => b.last_reservation_at.localeCompare(a.last_reservation_at));
    return { items };
  }
  const response = await adminFetch(
    `/api/admin/contacts${query ? `?query=${encodeURIComponent(query)}` : ""}`,
    { cache: "no-store" },
  );
  return unwrapResponse<{
    items: Array<{
      customer_name: string;
      customer_email: string;
      customer_phone: string;
      total_reservations: number;
      no_show_count: number;
      last_reservation_at: string;
      is_blacklisted: boolean;
      blacklist_id: string | null;
    }>;
  }>(response);
}

export async function deleteContact(payload: { customerEmail: string; customerPhone: string }) {
  if (isDemoMode()) {
    const remainingReservations = getDemoReservations().filter(
      (item) =>
        !(item.customer_email === payload.customerEmail && item.customer_phone === payload.customerPhone),
    );
    setDemoReservations(remainingReservations);

    const remainingBlacklist = getDemoBlacklist().filter(
      (item) =>
        !(item.customer_email === payload.customerEmail && item.customer_phone === payload.customerPhone),
    );
    setDemoBlacklist(remainingBlacklist);
    return { status: "deleted" };
  }

  const response = await adminFetch("/api/admin/contacts", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return unwrapResponse<{ status: string }>(response);
}

export async function purgeOperationalData() {
  if (isDemoMode()) {
    throw new Error("No disponible en modo demo: el panel usa datos simulados en el navegador.");
  }
  const response = await adminFetch("/api/admin/operations/purge", { method: "POST" });
  return unwrapResponse<{ status: string }>(response);
}

export async function upsertBlacklistFromContact(payload: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  isBlacklisted: boolean;
  blacklistId: string | null;
}) {
  if (payload.isBlacklisted && payload.blacklistId) {
    return removeBlacklistEntry(payload.blacklistId, "Retirado desde historial de contactos");
  }
  return createBlacklistEntry({
    customerName: payload.customerName,
    customerEmail: payload.customerEmail,
    customerPhone: payload.customerPhone,
    reason: "Bloqueado desde historial de contactos",
  });
}
