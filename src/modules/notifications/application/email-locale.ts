import type { EmailLocale } from "@/modules/notifications/domain/email.types";

export function resolveEmailLocale(input?: string | null): EmailLocale {
  const normalized = (input ?? "").toLowerCase();
  if (normalized.startsWith("en")) return "en";
  if (normalized.startsWith("it")) return "it";
  return "es";
}
