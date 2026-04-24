import { z } from "zod";
import { AppError } from "@/lib/errors";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RESERVATIONS_DEFAULT_RESTAURANT_ID: z.string().uuid(),
});

function flattenIssues(error: z.ZodError) {
  return error.issues.map((issue) => issue.path.join(".")).join(", ");
}

export function getPublicEnv() {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    throw new AppError(
      `Configuracion publica incompleta: ${flattenIssues(parsed.error)}`,
      500,
      "MISSING_ENV",
    );
  }

  return parsed.data;
}

export function getServerEnv() {
  const parsed = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESERVATIONS_DEFAULT_RESTAURANT_ID: process.env.RESERVATIONS_DEFAULT_RESTAURANT_ID,
  });

  if (!parsed.success) {
    throw new AppError(
      `Configuracion de entorno incompleta: ${flattenIssues(parsed.error)}`,
      500,
      "MISSING_ENV",
    );
  }

  return parsed.data;
}
