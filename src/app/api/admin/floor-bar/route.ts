import { requireAdmin } from "@/lib/security/admin-auth";
import { fail, ok } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const layoutSchema = z.object({
  x: z.coerce.number(),
  y: z.coerce.number(),
  width: z.coerce.number().min(40).max(400),
  height: z.coerce.number().min(40).max(300),
});

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = layoutSchema.safeParse(body);
    if (!parsed.success) {
      return ok({ error: "Layout de barra invalido.", details: parsed.error.flatten() }, 400);
    }
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("restaurants")
      .update({ floor_bar_layout: parsed.data })
      .eq("id", admin.restaurantId);
    if (error) {
      return fail(error as unknown as Error, "api.admin.floor-bar.patch");
    }
    return ok({ status: "updated", floorBar: parsed.data });
  } catch (error) {
    return fail(error, "api.admin.floor-bar.patch");
  }
}
