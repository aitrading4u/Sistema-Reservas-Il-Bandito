import { fail, ok } from "@/lib/http";
import { ilBanditoConfig } from "@/config/il-bandito.config";
import { resolveEmailLocale } from "@/modules/notifications/application/email-locale";
import { TransactionalEmailService } from "@/modules/notifications/application/transactional-email.service";
import { requireAdmin } from "@/lib/security/admin-auth";
import {
  createAdminReservation,
  listAdminReservations,
} from "@/modules/reservations/application/public-booking.service";
import {
  adminCreateReservationSchema,
  adminListReservationsSchema,
} from "@/modules/reservations/application/reservation.schemas";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const parsed = adminListReservationsSchema.safeParse({
      restaurantId: admin.restaurantId,
      date: searchParams.get("date") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      name: searchParams.get("name") ?? undefined,
    });

    if (!parsed.success) {
      return ok(
        { error: "Filtros invalidos.", details: parsed.error.flatten() },
        400,
      );
    }

    const data = await listAdminReservations(parsed.data);
    return ok({ items: data });
  } catch (error) {
    return fail(error, "api.admin.reservations.list");
  }
}

export async function POST(request: Request) {
  const emailService = new TransactionalEmailService();
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = adminCreateReservationSchema.safeParse({
      ...body,
      restaurantId: admin.restaurantId,
      adminUserId: admin.adminUserId,
    });

    if (!parsed.success) {
      return ok(
        { error: "Datos de reserva invalidos.", details: parsed.error.flatten() },
        400,
      );
    }

    const created = await createAdminReservation(parsed.data);

    void emailService.sendReservationConfirmation({
      reservationCode: created.reservation_code,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      customerPhone: parsed.data.customerPhone,
      partySize: parsed.data.partySize,
      startAtISO: created.start_at,
      comments: parsed.data.customerComment,
      locale: parsed.data.locale ?? resolveEmailLocale(request.headers.get("accept-language")),
      instructions: ilBanditoConfig.confirmationTexts.defaultInstructions,
    });

    return ok(
      {
        reservationId: created.reservation_id,
        reservationCode: created.reservation_code,
        status: created.status,
      },
      201,
    );
  } catch (error) {
    return fail(error, "api.admin.reservations.create");
  }
}
