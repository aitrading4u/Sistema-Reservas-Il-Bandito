import { z } from "zod";

export const publicAvailabilityQuerySchema = z.object({
  partySize: z.coerce.number().int().min(1).max(12),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida"),
  preferredTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Hora invalida")
    .optional(),
});

export const publicReservationCreateSchema = z.object({
  partySize: z.number().int().min(1).max(12),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  customerName: z.string().trim().min(2).max(80),
  customerPhone: z.string().trim().min(7).max(20),
  customerEmail: z.string().trim().email(),
  comments: z.string().max(500).optional().default(""),
});

export type PublicAvailabilityQuery = z.infer<typeof publicAvailabilityQuerySchema>;
export type PublicReservationCreateInput = z.infer<typeof publicReservationCreateSchema>;
