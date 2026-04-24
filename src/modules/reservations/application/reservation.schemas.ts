import { z } from "zod";
import { publicReservationCreateSchema } from "@/lib/validations/public-reservation";

export const reservationStatusSchema = z.enum([
  "pending",
  "confirmed",
  "cancelled",
  "seated",
  "finished",
  "no_show",
]);

export const availabilityRequestSchema = z.object({
  restaurantId: z.string().uuid(),
  partySize: z.coerce.number().int().min(1).max(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const createPublicReservationInputSchema = publicReservationCreateSchema.extend({
  restaurantId: z.string().uuid(),
  locale: z.enum(["es", "en", "it"]).optional().default("es"),
});

export const adminCreateReservationSchema = z.object({
  restaurantId: z.string().uuid(),
  adminUserId: z.string().uuid().optional(),
  locale: z.enum(["es", "en", "it"]).optional().default("es"),
  customerName: z.string().trim().min(2).max(80),
  customerPhone: z.string().trim().min(7).max(20),
  customerEmail: z.string().trim().email(),
  customerComment: z.string().max(500).optional(),
  internalNotes: z.string().max(500).optional(),
  partySize: z.number().int().min(1).max(20),
  startAtISO: z.string().datetime({ offset: true }),
});

export const adminListReservationsSchema = z.object({
  restaurantId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: reservationStatusSchema.optional(),
  name: z.string().max(80).optional(),
});

export const adminUpdateReservationSchema = z.object({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  adminUserId: z.string().uuid().optional(),
  customerName: z.string().trim().min(2).max(80).optional(),
  customerPhone: z.string().trim().min(7).max(20).optional(),
  customerEmail: z.string().trim().email().optional(),
  customerComment: z.string().max(500).optional(),
  internalNotes: z.string().max(500).optional(),
  status: reservationStatusSchema.optional(),
  moveToISO: z.string().datetime({ offset: true }).optional(),
  partySize: z.number().int().min(1).max(20).optional(),
});

export const adminBlockCreateSchema = z.object({
  restaurantId: z.string().uuid(),
  tableId: z.string().uuid().optional(),
  startsAtISO: z.string().datetime({ offset: true }),
  endsAtISO: z.string().datetime({ offset: true }),
  reason: z.string().min(3).max(200),
  adminUserId: z.string().uuid(),
});

export const adminCalendarQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const adminCalendarMonthQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export const adminSettingsUpdateSchema = z.object({
  restaurantId: z.string().uuid(),
  restaurantName: z.string().trim().min(2).max(120),
  timezone: z.literal("Europe/Madrid"),
  slotIntervalMinutes: z.number().int().min(5).max(60),
  bufferBeforeMinutes: z.number().int().min(0).max(120),
  bufferAfterMinutes: z.number().int().min(0).max(120),
  /** Max reservas que inician en la misma franja (largo = intervalo de slot, ej. 15 min). */
  maxReservationsPerSlot: z.number().int().min(1).max(100),
});

export const publicCustomerReservationsLookupSchema = z.object({
  restaurantId: z.string().uuid(),
  customerEmail: z.string().trim().email(),
  customerPhone: z.string().trim().min(7).max(20),
});
export type PublicCustomerReservationsLookupInput = z.infer<typeof publicCustomerReservationsLookupSchema>;

export const adminBlacklistCreateSchema = z.object({
  restaurantId: z.string().uuid(),
  adminUserId: z.string().uuid(),
  customerName: z.string().trim().min(2).max(80),
  customerEmail: z.string().trim().email(),
  customerPhone: z.string().trim().min(7).max(20),
  reason: z.string().trim().min(3).max(300),
});

export const adminBlacklistListSchema = z.object({
  restaurantId: z.string().uuid(),
  query: z.string().trim().max(100).optional(),
});

export const adminBlacklistUpdateSchema = z.object({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  adminUserId: z.string().uuid(),
  action: z.enum(["remove"]),
  note: z.string().trim().max(300).optional(),
});

export const adminContactListSchema = z.object({
  restaurantId: z.string().uuid(),
  query: z.string().trim().max(100).optional(),
});

export const adminContactDeleteSchema = z.object({
  restaurantId: z.string().uuid(),
  adminUserId: z.string().uuid(),
  customerEmail: z.string().trim().email(),
  customerPhone: z.string().trim().min(7).max(20),
});

export type AvailabilityRequest = z.infer<typeof availabilityRequestSchema>;
export type CreatePublicReservationInput = z.infer<typeof createPublicReservationInputSchema>;
export type AdminCreateReservationInput = z.infer<typeof adminCreateReservationSchema>;
export type AdminListReservationsInput = z.infer<typeof adminListReservationsSchema>;
export type AdminUpdateReservationInput = z.infer<typeof adminUpdateReservationSchema>;
export type AdminBlockCreateInput = z.infer<typeof adminBlockCreateSchema>;
export type AdminCalendarQueryInput = z.infer<typeof adminCalendarQuerySchema>;
export type AdminCalendarMonthQueryInput = z.infer<typeof adminCalendarMonthQuerySchema>;
export type AdminSettingsUpdateInput = z.infer<typeof adminSettingsUpdateSchema>;
export type AdminBlacklistCreateInput = z.infer<typeof adminBlacklistCreateSchema>;
export type AdminBlacklistListInput = z.infer<typeof adminBlacklistListSchema>;
export type AdminBlacklistUpdateInput = z.infer<typeof adminBlacklistUpdateSchema>;
export type AdminContactListInput = z.infer<typeof adminContactListSchema>;
export type AdminContactDeleteInput = z.infer<typeof adminContactDeleteSchema>;
