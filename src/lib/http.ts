import { NextResponse } from "next/server";
import { AppError, isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export function ok<T>(payload: T, status = 200) {
  return NextResponse.json(payload, { status });
}

export function fail(error: unknown, scope: string) {
  if (isAppError(error)) {
    logger.warn({
      scope,
      message: error.message,
      meta: { code: error.code, details: error.details },
    });
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.statusCode },
    );
  }

  logger.error({
    scope,
    message: "Unhandled error",
    meta: { error: String(error) },
  });

  return NextResponse.json(
    {
      error: "Error interno del servidor.",
      code: "INTERNAL_ERROR",
    },
    { status: 500 },
  );
}

export function fromSupabaseError(
  supabaseError: { message: string; code?: string; details?: string | null },
  fallbackMessage: string,
) {
  if (supabaseError.code === "23P01" || supabaseError.message.includes("NO_AVAILABILITY")) {
    return new AppError("No hay disponibilidad para esa hora.", 409, "NO_AVAILABILITY");
  }

  return new AppError(fallbackMessage, 500, "DATABASE_ERROR", {
    code: supabaseError.code,
    details: supabaseError.details,
  });
}
