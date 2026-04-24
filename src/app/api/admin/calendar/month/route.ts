import { fail, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/security/admin-auth";
import { readAdminCalendarMonthSummary } from "@/modules/reservations/application/public-booking.service";
import { adminCalendarMonthQuerySchema } from "@/modules/reservations/application/reservation.schemas";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const parsed = adminCalendarMonthQuerySchema.safeParse({
      restaurantId: admin.restaurantId,
      month: searchParams.get("month"),
    });

    if (!parsed.success) {
      return ok(
        {
          error: "Mes invalido para calendario.",
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const summary = await readAdminCalendarMonthSummary(parsed.data);
    return ok(summary);
  } catch (error) {
    return fail(error, "api.admin.calendar.month");
  }
}
