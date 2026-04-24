import { fail, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/security/admin-auth";
import { deleteAdminReservationPermanent } from "@/modules/reservations/application/public-booking.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    await deleteAdminReservationPermanent(id, admin.restaurantId);
    return ok({ status: "deleted" });
  } catch (error) {
    return fail(error, "api.admin.reservations.purge");
  }
}
