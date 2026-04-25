import { z } from "zod";

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_CHAT_ID: z.string().min(1).optional(),
  TELEGRAM_NOTIFY_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

function emptyToUndefined(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function getTelegramConfig() {
  const parsed = envSchema.parse({
    TELEGRAM_BOT_TOKEN: emptyToUndefined(process.env.TELEGRAM_BOT_TOKEN),
    TELEGRAM_CHAT_ID: emptyToUndefined(process.env.TELEGRAM_CHAT_ID),
    TELEGRAM_NOTIFY_ENABLED: process.env.TELEGRAM_NOTIFY_ENABLED,
  });

  const notifyEnabled = parsed.TELEGRAM_NOTIFY_ENABLED ?? false;

  return {
    botToken: parsed.TELEGRAM_BOT_TOKEN,
    chatId: parsed.TELEGRAM_CHAT_ID,
    notifyEnabled,
    enabled: Boolean(notifyEnabled && parsed.TELEGRAM_BOT_TOKEN && parsed.TELEGRAM_CHAT_ID),
  };
}
