import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/security/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const baseSchema = z.object({
  weekday: z.coerce.number().int().min(1).max(7),
  service: z.enum(["lunch", "dinner"]),
  open_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  close_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  is_active: z.coerce.boolean().optional().default(true),
});

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value;
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
    if (normalizeTime(payload.open_time) >= normalizeTime(payload.close_time)) {
      return ok({ error: "La hora de cierre debe ser mayor que la de apertura." }, 400);
    }
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("opening_hours")
      .insert({
        restaurant_id: admin.restaurantId,
        weekday: payload.weekday,
        open_time: normalizeTime(payload.open_time),
        close_time: normalizeTime(payload.close_time),
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
