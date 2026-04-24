import { fail, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/security/admin-auth";
import { purgeRestaurantOperationalData } from "@/modules/reservations/application/public-booking.service";

/**
 * Borra reservas, perfiles de cliente, bloqueos manuales, lista negra y auditoria del restaurante.
 * No afecta a restaurantes, administradores, mesas, horarios ni reglas.
 */
export async function POST() {
  try {
    const admin = await requireAdmin();
    await purgeRestaurantOperationalData(admin.restaurantId);
    return ok({ status: "purged" });
  } catch (error) {
    return fail(error, "api.admin.operations.purge");
  }
}
