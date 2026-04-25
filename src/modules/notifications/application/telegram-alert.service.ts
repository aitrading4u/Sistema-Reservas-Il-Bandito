import { DateTime } from "luxon";
import { logger } from "@/lib/logger";
import { TelegramProvider } from "@/modules/notifications/infrastructure/telegram.provider";

interface TelegramReservationAlertParams {
  reservationCode: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  startAtISO: string;
  comments?: string;
  source: "web" | "admin";
}

export class TelegramAlertService {
  private readonly provider = new TelegramProvider();

  async sendReservationCreated(params: TelegramReservationAlertParams) {
    if (!this.provider.isEnabled()) return;

    const start = DateTime.fromISO(params.startAtISO, { zone: "utc" }).setZone("Europe/Madrid");
    const dateLabel = start.isValid ? start.toFormat("dd/LL/yyyy") : params.startAtISO;
    const timeLabel = start.isValid ? start.toFormat("HH:mm") : "";

    const lines = [
      "🔔 <b>Nueva reserva</b>",
      `<b>Codigo:</b> ${params.reservationCode}`,
      `<b>Fecha:</b> ${dateLabel}${timeLabel ? ` ${timeLabel}` : ""}`,
      `<b>Personas:</b> ${params.partySize}`,
      `<b>Cliente:</b> ${params.customerName}`,
      `<b>Telefono:</b> ${params.customerPhone}`,
      `<b>Canal:</b> ${params.source}`,
    ];

    const notes = params.comments?.trim();
    if (notes) {
      lines.push(`<b>Comentario:</b> ${notes}`);
    }

    try {
      await this.provider.sendMessage(lines.join("\n"));
      logger.info({
        scope: "telegram.reservation.created",
        message: "Telegram reservation alert sent",
        meta: { reservationCode: params.reservationCode },
      });
    } catch (error) {
      logger.error({
        scope: "telegram.reservation.created",
        message: "Failed to send telegram reservation alert",
        meta: { error: String(error), reservationCode: params.reservationCode },
      });
    }
  }
}
