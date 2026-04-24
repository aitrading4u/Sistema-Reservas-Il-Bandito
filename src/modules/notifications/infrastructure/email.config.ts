import { z } from "zod";

const envSchema = z.object({
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  EMAIL_REPLY_TO: z.string().email().optional(),
  EMAIL_INTERNAL_TO: z.string().email().optional(),
  EMAIL_ENABLE_INTERNAL_NOTIFY: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

function emptyToUndefined(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function getEmailConfig() {
  const parsed = envSchema.parse({
    RESEND_API_KEY: emptyToUndefined(process.env.RESEND_API_KEY),
    EMAIL_FROM: emptyToUndefined(process.env.EMAIL_FROM),
    EMAIL_REPLY_TO: emptyToUndefined(process.env.EMAIL_REPLY_TO),
    EMAIL_INTERNAL_TO: emptyToUndefined(process.env.EMAIL_INTERNAL_TO),
    EMAIL_ENABLE_INTERNAL_NOTIFY: process.env.EMAIL_ENABLE_INTERNAL_NOTIFY,
  });

  return {
    apiKey: parsed.RESEND_API_KEY ?? "",
    from: parsed.EMAIL_FROM ?? "Il Bandito <reservas@ilbanditoaltea.es>",
    replyTo: parsed.EMAIL_REPLY_TO,
    internalTo: parsed.EMAIL_INTERNAL_TO,
    internalEnabled: parsed.EMAIL_ENABLE_INTERNAL_NOTIFY ?? false,
    enabled: Boolean(parsed.RESEND_API_KEY),
  };
}
