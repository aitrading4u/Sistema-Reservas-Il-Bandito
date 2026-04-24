import { fail, ok } from "@/lib/http";
import { applyRateLimit, getClientIpFromRequest } from "@/lib/security/rate-limit";
import { getDefaultRestaurantId } from "@/lib/supabase/admin";
import { listPublicCustomerReservations } from "@/modules/reservations/application/public-booking.service";
import { publicCustomerReservationsLookupSchema } from "@/modules/reservations/application/reservation.schemas";

export async function POST(request: Request) {
  try {
    const ip = getClientIpFromRequest(request);
    const limiter = applyRateLimit({
      key: `public:customer-lookup:${ip}`,
      windowMs: 60_000,
      max: 30,
    });
    if (!limiter.allowed) {
      return ok(
        {
          error: "Demasiados intentos. Espera un minuto e intentalo de nuevo.",
          code: "RATE_LIMITED",
        },
        429,
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = publicCustomerReservationsLookupSchema.safeParse({
      ...body,
      restaurantId: body?.restaurantId ?? getDefaultRestaurantId(),
    });
    if (!parsed.success) {
      return ok(
        { error: "Revisa el email y el telefono.", details: parsed.error.flatten() },
        400,
      );
    }

    const items = await listPublicCustomerReservations(parsed.data);
    return ok({ items });
  } catch (error) {
    return fail(error, "api.public.misReservas");
  }
}
