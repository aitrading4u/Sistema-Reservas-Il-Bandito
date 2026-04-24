import { fail, ok } from "@/lib/http";
import { ilBanditoConfig } from "@/config/il-bandito.config";
import { requireAdmin } from "@/lib/security/admin-auth";
import { resolveEmailLocale } from "@/modules/notifications/application/email-locale";
import { TransactionalEmailService } from "@/modules/notifications/application/transactional-email.service";
import {
  cancelAdminReservation,
  readAdminReservationById,
  updateAdminReservation,
} from "@/modules/reservations/application/public-booking.service";
import { adminUpdateReservationSchema } from "@/modules/reservations/application/reservation.schemas";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = adminUpdateReservationSchema.safeParse({
      ...body,
      id,
      restaurantId: admin.restaurantId,
      adminUserId: admin.adminUserId,
    });

    if (!parsed.success) {
      return ok(
        { error: "Datos de actualizacion invalidos.", details: parsed.error.flatten() },
        400,
      );
    }

    await updateAdminReservation(parsed.data);
    return ok({ status: "updated" });
  } catch (error) {
    return fail(error, "api.admin.reservations.update");
  }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const reservation = await readAdminReservationById(id, admin.restaurantId);
    return ok({ item: reservation });
  } catch (error) {
    return fail(error, "api.admin.reservations.read");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const emailService = new TransactionalEmailService();
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const cancelled = await cancelAdminReservation(id, admin.restaurantId);

    await emailService.sendReservationCancellation({
      reservationCode: cancelled.reservation_code,
      customerName: cancelled.customer_name,
      customerEmail: cancelled.customer_email,
      customerPhone: cancelled.customer_phone,
      partySize: cancelled.party_size,
      startAtISO: cancelled.start_at,
      comments: cancelled.customer_comment ?? "",
      locale: resolveEmailLocale(request.headers.get("accept-language")),
      instructions: ilBanditoConfig.confirmationTexts.defaultInstructions,
    });

    return ok({ status: "cancelled" });
  } catch (error) {
    return fail(error, "api.admin.reservations.cancel");
  }
}
