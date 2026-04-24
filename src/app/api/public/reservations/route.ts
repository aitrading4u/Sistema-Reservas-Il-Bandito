import { AppError } from "@/lib/errors";
import { ilBanditoConfig } from "@/config/il-bandito.config";
import { fail, ok } from "@/lib/http";
import { applyRateLimit, getClientIpFromRequest } from "@/lib/security/rate-limit";
import { getDefaultRestaurantId } from "@/lib/supabase/admin";
import { resolveEmailLocale } from "@/modules/notifications/application/email-locale";
import { TransactionalEmailService } from "@/modules/notifications/application/transactional-email.service";
import {
  createPublicReservation,
  getPublicAvailability,
} from "@/modules/reservations/application/public-booking.service";
import {
  createPublicReservationInputSchema,
  type CreatePublicReservationInput,
} from "@/modules/reservations/application/reservation.schemas";

export async function POST(request: Request) {
  let parsedInput: CreatePublicReservationInput | null = null;
  const emailService = new TransactionalEmailService();
  try {
    const ip = getClientIpFromRequest(request);
    const limiter = applyRateLimit({
      key: `public:reservation-create:${ip}`,
      windowMs: 60_000,
      max: 12,
    });
    if (!limiter.allowed) {
      return ok(
        {
          error: "Has realizado demasiados intentos. Espera un minuto e intentalo de nuevo.",
          code: "RATE_LIMITED",
        },
        429,
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = createPublicReservationInputSchema.safeParse({
      ...body,
      restaurantId: body?.restaurantId ?? getDefaultRestaurantId(),
    });

    if (!parsed.success) {
      return ok(
        {
          error: "Revisa los datos del formulario.",
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    parsedInput = parsed.data;
    const created = await createPublicReservation(parsed.data);

    await emailService.sendReservationConfirmation({
      reservationCode: created.reservation_code,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      customerPhone: parsed.data.customerPhone,
      partySize: parsed.data.partySize,
      startAtISO: created.start_at,
      comments: parsed.data.comments,
      locale: parsed.data.locale ?? resolveEmailLocale(request.headers.get("accept-language")),
      instructions: ilBanditoConfig.confirmationTexts.defaultInstructions,
    });

    return ok(
      {
        status: created.status,
        reservationCode: created.reservation_code,
        reservationId: created.reservation_id,
        message: "Reserva confirmada. Te hemos enviado un email de confirmacion.",
      },
      201,
    );
  } catch (error) {
    if (error instanceof AppError && error.code === "NO_AVAILABILITY" && parsedInput) {
      const availability = await getPublicAvailability({
        restaurantId: parsedInput.restaurantId,
        partySize: parsedInput.partySize,
        date: parsedInput.date,
        preferredTime: parsedInput.time,
      });
      return ok(
        {
          error: "La hora seleccionada ya no esta disponible.",
          code: "NO_AVAILABILITY",
          suggestions: availability.suggestions,
        },
        409,
      );
    }
    if (error instanceof AppError && error.code === "SLOT_CAP_REACHED") {
      return ok(
        {
          error: error.message,
          code: "SLOT_CAP_REACHED",
        },
        409,
      );
    }
    return fail(error, "api.public.reservations.create");
  }
}
