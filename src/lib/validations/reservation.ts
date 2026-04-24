import { z } from "zod";

export const reservationStatusSchema = z.enum([
  "pending",
  "confirmed",
  "cancelled",
  "seated",
  "finished",
  "no_show",
]);

export const createReservationSchema = z.object({
  customerName: z.string().min(2, "El nombre es obligatorio"),
  customerPhone: z
    .string()
    .min(7, "Telefono invalido")
    .max(20, "Telefono invalido"),
  customerEmail: z.string().email("Email invalido"),
  partySize: z.coerce.number().int().min(1).max(20),
  reservationDate: z.string().min(1, "Fecha obligatoria"),
  reservationTime: z.string().min(1, "Hora obligatoria"),
  comments: z.string().max(500).optional(),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
