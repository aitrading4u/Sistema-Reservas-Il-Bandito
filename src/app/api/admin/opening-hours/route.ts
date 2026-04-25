import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/security/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const baseSchema = z.object({
  weekday: z.coerce.number().int().min(1).max(7),
  service: z.enum(["lunch", "dinner"]),
  open_time: z.string().min(1),
  close_time: z.string().min(1),
  is_active: z.coerce.boolean().optional().default(true),
});

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

export async function GET() {
  try {
    const admin = await requireAdmin();
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("opening_hours")
      .select("id, weekday, open_time, close_time, is_active")
      .eq("restaurant_id", admin.restaurantId)
      .is("deleted_at", null)
      .order("weekday", { ascending: true })
      .order("open_time", { ascending: true });
    if (error) return fail(error as unknown as Error, "api.admin.opening-hours.get");
    const items = (data ?? []).map((row) => ({
      ...row,
      service: inferService(row.open_time.slice(0, 5)),
    }));
    return ok({ items });
  } catch (error) {
    return fail(error, "api.admin.opening-hours.get");
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = baseSchema.safeParse(body);
    if (!parsed.success) {
      return ok({ error: "Datos de horario invalidos.", details: parsed.error.flatten() }, 400);
    }
    const payload = parsed.data;
    const openTime = normalizeTime(payload.open_time);
    const closeTime = normalizeTime(payload.close_time);
    if (!openTime || !closeTime) {
      return ok({ error: "Formato de hora invalido. Usa HH:MM o HH:MM AM/PM." }, 400);
    }
    if (openTime >= closeTime) {
      return ok({ error: "La hora de cierre debe ser mayor que la de apertura." }, 400);
    }
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("opening_hours")
      .insert({
        restaurant_id: admin.restaurantId,
        weekday: payload.weekday,
        open_time: openTime,
        close_time: closeTime,
        is_active: payload.is_active,
      })
      .select("id, weekday, open_time, close_time, is_active")
      .single();
    if (error) return fail(error as unknown as Error, "api.admin.opening-hours.post");
    return ok(
      {
        item: {
          ...data,
          service: payload.service,
        },
      },
      201,
    );
  } catch (error) {
    return fail(error, "api.admin.opening-hours.post");
  }
}
