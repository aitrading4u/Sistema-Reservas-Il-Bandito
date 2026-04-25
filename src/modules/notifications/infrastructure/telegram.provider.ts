import { logger } from "@/lib/logger";
import { getTelegramConfig } from "@/modules/notifications/infrastructure/telegram.config";

export class TelegramProvider {
  private readonly config = getTelegramConfig();

  isEnabled() {
    return this.config.enabled;
  }

  async sendMessage(text: string) {
    if (!this.config.enabled || !this.config.botToken || !this.config.chatId) {
      logger.warn({
        scope: "telegram.provider",
        message: "Telegram disabled. Missing env or TELEGRAM_NOTIFY_ENABLED=false.",
      });
      return;
    }

    const response = await fetch(
      `https://api.telegram.org/bot${this.config.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      },
    );

    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; description?: string }
      | null;

    if (!response.ok || payload?.ok === false) {
      throw new Error(
        `Telegram error: ${payload?.description ?? `status ${response.status}`}`,
      );
    }
  }
}
