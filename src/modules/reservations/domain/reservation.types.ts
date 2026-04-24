import type { z } from "zod";
import type {
  createReservationSchema,
  reservationStatusSchema,
} from "@/lib/validations/reservation";

export type ReservationStatus = z.infer<typeof reservationStatusSchema>;
export type CreateReservation = z.infer<typeof createReservationSchema>;

export interface AvailabilityQuery {
  partySize: number;
  requestedAtISO: string;
}

export interface AvailabilitySuggestion {
  startAtISO: string;
  label: string;
}
