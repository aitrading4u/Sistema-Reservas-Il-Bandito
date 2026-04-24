import { fail, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/security/admin-auth";
import { updateAdminBlacklist } from "@/modules/reservations/application/public-booking.service";
import { adminBlacklistUpdateSchema } from "@/modules/reservations/application/reservation.schemas";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null);
    const { id } = await context.params;
    const parsed = adminBlacklistUpdateSchema.safeParse({
      ...body,
      id,
      restaurantId: admin.restaurantId,
      adminUserId: admin.adminUserId,
    });
    if (!parsed.success) {
      return ok({ error: "Peticion invalida.", details: parsed.error.flatten() }, 400);
    }
    await updateAdminBlacklist(parsed.data);
    return ok({ status: "updated" });
  } catch (error) {
    return fail(error, "api.admin.blacklist.update");
  }
}
