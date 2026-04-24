import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/security/admin-auth";
import { removeAdminBlock } from "@/modules/reservations/application/public-booking.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const idSchema = z.string().uuid();

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const parsed = idSchema.safeParse(id);

    if (!parsed.success) {
      return ok({ error: "Identificador de bloqueo invalido." }, 400);
    }

    await removeAdminBlock(parsed.data, admin.restaurantId);
    return ok({ status: "deleted" });
  } catch (error) {
    return fail(error, "api.admin.blocks.delete");
  }
}
