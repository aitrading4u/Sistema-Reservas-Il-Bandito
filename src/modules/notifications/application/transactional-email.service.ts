import { logger } from "@/lib/logger";
import type { EmailLocale, ReservationEmailPayload } from "@/modules/notifications/domain/email.types";
import { getEmailConfig } from "@/modules/notifications/infrastructure/email.config";
import { ResendProvider } from "@/modules/notifications/infrastructure/resend.provider";
import {
  buildCancellationEmail,
  buildConfirmationEmail,
} from "@/modules/notifications/templates/reservation-email.templates";

interface SendReservationEmailParams {
  reservationCode: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  partySize: number;
  startAtISO: string;
  comments?: string;
  instructions?: string;
  locale?: EmailLocale;
}

function payloadFromParams(params: SendReservationEmailParams): ReservationEmailPayload {
  return {
    reservationCode: params.reservationCode,
    customerName: params.customerName,
    customerEmail: params.customerEmail,
    customerPhone: params.customerPhone,
    partySize: params.partySize,
    startAtISO: params.startAtISO,
    comments: params.comments,
    instructions: params.instructions,
    locale: params.locale ?? "es",
  };
}

export class TransactionalEmailService {
  private provider = new ResendProvider();
  private config = getEmailConfig();

  private async sendInternalCopy(subject: string, html: string, text: string) {
    if (!this.config.internalEnabled || !this.config.internalTo) {
      return;
    }
    await this.provider.send({
      to: this.config.internalTo,
      subject: `[INTERNAL] ${subject}`,
      html,
      text,
    });
  }

  async sendReservationConfirmation(params: SendReservationEmailParams) {
    const payload = payloadFromParams(params);
    const message = buildConfirmationEmail(payload);

    try {
      await this.provider.send({
        to: payload.customerEmail,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      await this.sendInternalCopy(message.subject, message.html, message.text);
      logger.info({
        scope: "email.confirmation",
        message: "Confirmation email sent",
        meta: { reservationCode: payload.reservationCode, to: payload.customerEmail },
      });
    } catch (error) {
      logger.error({
        scope: "email.confirmation",
        message: "Failed to send confirmation email",
        meta: { error: String(error), reservationCode: payload.reservationCode },
      });
    }
  }

  async sendReservationCancellation(params: SendReservationEmailParams) {
    const payload = payloadFromParams(params);
    const message = buildCancellationEmail(payload);

    try {
      await this.provider.send({
        to: payload.customerEmail,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      await this.sendInternalCopy(message.subject, message.html, message.text);
      logger.info({
        scope: "email.cancellation",
        message: "Cancellation email sent",
        meta: { reservationCode: payload.reservationCode, to: payload.customerEmail },
      });
    } catch (error) {
      logger.error({
        scope: "email.cancellation",
        message: "Failed to send cancellation email",
        meta: { error: String(error), reservationCode: payload.reservationCode },
      });
    }
  }
}
