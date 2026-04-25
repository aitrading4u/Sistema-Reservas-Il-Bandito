import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/security/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const idSchema = z.string().uuid();
const patchSchema = z
  .object({
    weekday: z.coerce.number().int().min(1).max(7).optional(),
    service: z.enum(["lunch", "dinner"]).optional(),
    open_time: z.string().min(1).optional(),
    close_time: z.string().min(1).optional(),
    is_active: z.coerce.boolean().optional(),
  })
  .strict();

function normalizeTime(value: string) {
  const v = value.trim().toUpperCase();
  const h24 = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
  const h12 = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/;

  const m24 = v.match(h24);
  if (m24) {
    const hh = Number(m24[1]);
    const mm = Number(m24[2]);
    const ss = Number(m24[3] ?? "0");
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return null;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  const m12 = v.match(h12);
  if (m12) {
    let hh = Number(m12[1]);
    const mm = Number(m12[2]);
    const ap = m12[3];
    if (hh < 1 || hh > 12 || mm < 0 || mm > 59) return null;
    if (ap === "AM") {
      if (hh === 12) hh = 0;
    } else if (hh !== 12) {
      hh += 12;
    }
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
  }

  return null;
}

function inferService(openTime: string): "lunch" | "dinner" {
  const hh = Number(openTime.slice(0, 2));
  return hh < 17 ? "lunch" : "dinner";
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) return ok({ error: "Id de horario invalido." }, 400);

    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return ok({ error: "Datos de horario invalidos.", details: parsed.error.flatten() }, 400);
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.weekday !== undefined) update.weekday = parsed.data.weekday;
    if (parsed.data.open_time !== undefined) {
      const open = normalizeTime(parsed.data.open_time);
      if (!open) return ok({ error: "Formato de hora de apertura invalido." }, 400);
      update.open_time = open;
    }
    if (parsed.data.close_time !== undefined) {
      const close = normalizeTime(parsed.data.close_time);
      if (!close) return ok({ error: "Formato de hora de cierre invalido." }, 400);
      update.close_time = close;
    }
    if (parsed.data.is_active !== undefined) update.is_active = parsed.data.is_active;
    if (Object.keys(update).length === 0) return ok({ error: "Nada que actualizar." }, 400);

    const supabase = createSupabaseAdminClient();
    const { data: current, error: currentError } = await supabase
      .from("opening_hours")
      .select("open_time, close_time")
      .eq("id", parsedId.data)
      .eq("restaurant_id", admin.restaurantId)
      .is("deleted_at", null)
      .single();
    if (currentError || !current) {
      return fail(currentError ?? { message: "Not found" }, "api.admin.opening-hours.patch.current");
    }

    const nextOpen = String(update.open_time ?? current.open_time);
    const nextClose = String(update.close_time ?? current.close_time);
    if (nextOpen >= nextClose) {
      return ok({ error: "La hora de cierre debe ser mayor que la de apertura." }, 400);
    }

    const { data, error } = await supabase
      .from("opening_hours")
      .update(update)
      .eq("id", parsedId.data)
      .eq("restaurant_id", admin.restaurantId)
      .is("deleted_at", null)
      .select("id, weekday, open_time, close_time, is_active")
      .single();
    if (error) return fail(error as unknown as Error, "api.admin.opening-hours.patch");
    return ok({
      item: {
        ...data,
        service: parsed.data.service ?? inferService(data.open_time.slice(0, 5)),
      },
    });
  } catch (error) {
    return fail(error, "api.admin.opening-hours.patch");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) return ok({ error: "Id de horario invalido." }, 400);
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("opening_hours")
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq("id", parsedId.data)
      .eq("restaurant_id", admin.restaurantId)
      .is("deleted_at", null);
    if (error) return fail(error as unknown as Error, "api.admin.opening-hours.delete");
    return ok({ status: "deleted" });
  } catch (error) {
    return fail(error, "api.admin.opening-hours.delete");
  }
}
