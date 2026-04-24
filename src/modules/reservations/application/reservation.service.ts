import { createReservationSchema } from "@/lib/validations/reservation";
import type { CreateReservation } from "@/modules/reservations/domain/reservation.types";

export function validateReservationInput(payload: unknown): CreateReservation {
  return createReservationSchema.parse(payload);
}
