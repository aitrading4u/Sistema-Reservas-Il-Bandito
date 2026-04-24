import { requireAdmin } from "@/lib/security/admin-auth";
import { fail, ok } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const patchSchema = z
  .object({
    table_code: z.string().min(1).max(32).optional(),
    min_capacity: z.coerce.number().int().min(1).max(99).optional(),
    max_capacity: z.coerce.number().int().min(1).max(99).optional(),
    dining_area: z.enum(["sala", "barra", "terraza"]).optional().nullable(),
    plan_x: z.coerce.number().optional().nullable(),
    plan_y: z.coerce.number().optional().nullable(),
  })
  .strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id: tableId } = await context.params;
    if (!tableId) {
      return ok({ error: "Falta id de mesa." }, 400);
    }
    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return ok({ error: "Datos de mesa invalidos.", details: parsed.error.flatten() }, 400);
    }
    const patch = parsed.data;
    const update: Record<string, unknown> = {};
    if (patch.table_code !== undefined) {
      update.table_code = patch.table_code.trim();
    }
    if (patch.min_capacity !== undefined) {
      update.min_capacity = patch.min_capacity;
    }
    if (patch.max_capacity !== undefined) {
      update.max_capacity = patch.max_capacity;
    }
    if (patch.dining_area !== undefined) {
      update.dining_area = patch.dining_area;
    }
    if (patch.plan_x !== undefined) {
      update.plan_x = patch.plan_x;
    }
    if (patch.plan_y !== undefined) {
      update.plan_y = patch.plan_y;
    }
    if (Object.keys(update).length === 0) {
      return ok({ error: "Nada que actualizar." }, 400);
    }
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("tables")
      .update(update)
      .eq("id", tableId)
      .eq("restaurant_id", admin.restaurantId)
      .is("deleted_at", null)
      .select("id, table_code, min_capacity, max_capacity, dining_area, plan_x, plan_y")
      .single();
    if (error) {
      return fail(error as unknown as Error, "api.admin.tables.patch");
    }
    if (!data) {
      return ok({ error: "Mesa no encontrada." }, 404);
    }
    return ok({ table: data });
  } catch (error) {
    return fail(error, "api.admin.tables.patch");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id: tableId } = await context.params;
    if (!tableId) {
      return ok({ error: "Falta id de mesa." }, 400);
    }
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("tables")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", tableId)
      .eq("restaurant_id", admin.restaurantId)
      .is("deleted_at", null);
    if (error) {
      return fail(error as unknown as Error, "api.admin.tables.delete");
    }
    return ok({ status: "deleted" });
  } catch (error) {
    return fail(error, "api.admin.tables.delete");
  }
}
