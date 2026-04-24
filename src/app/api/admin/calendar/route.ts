import { fail, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/security/admin-auth";
import { readAdminCalendar } from "@/modules/reservations/application/public-booking.service";
import { adminCalendarQuerySchema } from "@/modules/reservations/application/reservation.schemas";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const parsed = adminCalendarQuerySchema.safeParse({
      restaurantId: admin.restaurantId,
      date: searchParams.get("date"),
    });

    if (!parsed.success) {
      return ok(
        {
          error: "Fecha invalida para calendario.",
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const calendar = await readAdminCalendar(parsed.data);
    return ok(calendar);
  } catch (error) {
    return fail(error, "api.admin.calendar.read");
  }
}
