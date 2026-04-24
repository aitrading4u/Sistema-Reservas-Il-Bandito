import { fail, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/security/admin-auth";
import { listAdminBlacklistHistory } from "@/modules/reservations/application/public-booking.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const items = await listAdminBlacklistHistory(id, admin.restaurantId);
    return ok({ items });
  } catch (error) {
    return fail(error, "api.admin.blacklist.history");
  }
}
