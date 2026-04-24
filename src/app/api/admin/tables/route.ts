import { requireAdmin } from "@/lib/security/admin-auth";
import { fail, ok } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const postSchema = z.object({
  table_code: z.string().min(1).max(32),
  min_capacity: z.coerce.number().int().min(1).max(99),
  max_capacity: z.coerce.number().int().min(1).max(99),
  dining_area: z.enum(["sala", "barra", "terraza"]),
  plan_x: z.coerce.number().optional().nullable(),
  plan_y: z.coerce.number().optional().nullable(),
});

function normalizePost(body: z.infer<typeof postSchema>) {
  const minC = body.min_capacity;
  const maxC = Math.max(minC, body.max_capacity);
  return {
    table_code: body.table_code.trim(),
    min_capacity: minC,
    max_capacity: maxC,
    dining_area: body.dining_area,
    plan_x: body.plan_x ?? null,
    plan_y: body.plan_y ?? null,
  };
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    const supabase = createSupabaseAdminClient();
    const { data: restaurant, error: re } = await supabase
      .from("restaurants")
      .select("floor_bar_layout")
      .eq("id", admin.restaurantId)
      .single();
    if (re) {
      return fail(
        re as unknown as Error,
        "api.admin.tables.get.restaurant",
      );
    }
    const { data: tables, error: te } = await supabase
      .from("tables")
      .select("id, table_code, min_capacity, max_capacity, dining_area, plan_x, plan_y, is_active")
      .eq("restaurant_id", admin.restaurantId)
      .is("deleted_at", null)
      .order("table_code", { ascending: true });
    if (te) {
      return fail(te as unknown as Error, "api.admin.tables.get.tables");
    }
    return ok({ floorBar: restaurant?.floor_bar_layout ?? null, tables: tables ?? [] });
  } catch (error) {
    return fail(error, "api.admin.tables.get");
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return ok({ error: "Datos de mesa invalidos.", details: parsed.error.flatten() }, 400);
    }
    const row = normalizePost(parsed.data);
    if (row.min_capacity > row.max_capacity) {
      return ok({ error: "min_capacity no puede ser mayor que max_capacity." }, 400);
    }
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("tables")
      .insert({
        restaurant_id: admin.restaurantId,
        table_code: row.table_code,
        min_capacity: row.min_capacity,
        max_capacity: row.max_capacity,
        dining_area: row.dining_area,
        plan_x: row.plan_x,
        plan_y: row.plan_y,
        is_active: true,
      })
      .select("id, table_code, min_capacity, max_capacity, dining_area, plan_x, plan_y")
      .single();
    if (error) {
      return fail(error as unknown as Error, "api.admin.tables.post");
    }
    return ok({ table: data });
  } catch (error) {
    return fail(error, "api.admin.tables.post");
  }
}
