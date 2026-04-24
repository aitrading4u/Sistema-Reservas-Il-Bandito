import { Resend } from "resend";
import { logger } from "@/lib/logger";
import { getEmailConfig } from "@/modules/notifications/infrastructure/email.config";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export class ResendProvider {
  private readonly config = getEmailConfig();
  private readonly client = this.config.enabled ? new Resend(this.config.apiKey) : null;

  isEnabled() {
    return Boolean(this.client);
  }

  async send(input: SendEmailInput) {
    if (!this.client) {
      logger.warn({
        scope: "email.resend",
        message: "Email provider disabled. Missing RESEND_API_KEY.",
      });
      return;
    }

    const { error } = await this.client.emails.send({
      from: this.config.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: this.config.replyTo,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }
  }
}
