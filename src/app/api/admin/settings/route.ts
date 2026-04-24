import { fail, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/security/admin-auth";
import {
  readAdminSettings,
  updateAdminSettings,
} from "@/modules/reservations/application/public-booking.service";
import { adminSettingsUpdateSchema } from "@/modules/reservations/application/reservation.schemas";

export async function GET() {
  try {
    const admin = await requireAdmin();
    const settings = await readAdminSettings(admin.restaurantId);
    return ok(settings);
  } catch (error) {
    return fail(error, "api.admin.settings.read");
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = adminSettingsUpdateSchema.safeParse({
      ...body,
      restaurantId: admin.restaurantId,
    });
    if (!parsed.success) {
      return ok(
        { error: "Datos de ajustes invalidos.", details: parsed.error.flatten() },
        400,
      );
    }
    await updateAdminSettings(parsed.data);
    return ok({ status: "updated" });
  } catch (error) {
    return fail(error, "api.admin.settings.update");
  }
}
