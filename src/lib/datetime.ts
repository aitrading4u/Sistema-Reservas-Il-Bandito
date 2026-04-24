import { DateTime } from "luxon";
import { AppError } from "@/lib/errors";

export const MADRID_TZ = "Europe/Madrid";

export function madridLocalDateTimeToUtcDate(date: string, timeHHmm: string) {
  const parsed = DateTime.fromFormat(`${date} ${timeHHmm}`, "yyyy-MM-dd HH:mm", {
    zone: MADRID_TZ,
  });

  if (!parsed.isValid) {
    throw new AppError("Fecha u hora invalida.", 400, "INVALID_DATETIME", parsed.invalidReason);
  }

  return parsed.toUTC().toJSDate();
}

export function madridLocalDateTimeToUtcIso(date: string, timeHHmm: string) {
  return madridLocalDateTimeToUtcDate(date, timeHHmm).toISOString();
}

export function utcDateToMadridTimeHHmm(value: string | Date) {
  const dt =
    typeof value === "string"
      ? DateTime.fromISO(value, { zone: "utc" }).setZone(MADRID_TZ)
      : DateTime.fromJSDate(value, { zone: "utc" }).setZone(MADRID_TZ);
  return dt.toFormat("HH:mm");
}

export function madridDateToUtcDayRange(date: string) {
  const start = DateTime.fromFormat(date, "yyyy-MM-dd", { zone: MADRID_TZ }).startOf("day");
  const end = start.endOf("day");
  if (!start.isValid || !end.isValid) {
    throw new AppError("Fecha invalida.", 400, "INVALID_DATE");
  }
  return {
    startUtcIso: start.toUTC().toISO() as string,
    endUtcIso: end.toUTC().toISO() as string,
  };
}
