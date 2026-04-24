export type EmailLocale = "es" | "en" | "it";

export interface ReservationEmailPayload {
  reservationCode: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  partySize: number;
  startAtISO: string;
  comments?: string;
  instructions?: string;
  locale: EmailLocale;
}

export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
}
