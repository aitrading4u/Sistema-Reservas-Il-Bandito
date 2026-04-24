import { fail, ok } from "@/lib/http";
import { applyRateLimit, getClientIpFromRequest } from "@/lib/security/rate-limit";
import { getDefaultRestaurantId } from "@/lib/supabase/admin";
import { availabilityRequestSchema } from "@/modules/reservations/application/reservation.schemas";
import { getPublicAvailability } from "@/modules/reservations/application/public-booking.service";

export async function GET(request: Request) {
  try {
    const ip = getClientIpFromRequest(request);
    const limiter = applyRateLimit({
      key: `public:availability:${ip}`,
      windowMs: 60_000,
      max: 60,
    });
    if (!limiter.allowed) {
      return ok(
        {
          error: "Demasiadas solicitudes. Intenta de nuevo en unos segundos.",
          code: "RATE_LIMITED",
        },
        429,
      );
    }

    const { searchParams } = new URL(request.url);
    const parsed = availabilityRequestSchema.safeParse({
      restaurantId: searchParams.get("restaurantId") ?? getDefaultRestaurantId(),
      partySize: searchParams.get("partySize"),
      date: searchParams.get("date"),
      preferredTime: searchParams.get("preferredTime") ?? undefined,
    });

    if (!parsed.success) {
      return ok(
        {
          error: "Datos de busqueda invalidos.",
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const result = await getPublicAvailability(parsed.data);
    return ok(result);
  } catch (error) {
    return fail(error, "api.public.availability");
  }
}
