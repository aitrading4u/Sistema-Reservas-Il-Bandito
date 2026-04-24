import { AppError } from "@/lib/errors";

export interface DurationRule {
  minPartySize: number;
  maxPartySize: number;
  durationMinutes: number;
}

export interface TimeWindow {
  start: Date;
  end: Date;
}

export interface CandidateTableSet {
  id: string;
  tableIds: string[];
  maxCapacity: number;
}

export interface OccupancyItem {
  tableId: string;
  start: Date;
  end: Date;
}

export interface BlockedItem {
  tableId?: string;
  start: Date;
  end: Date;
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function overlaps(a: TimeWindow, b: TimeWindow) {
  return a.start < b.end && b.start < a.end;
}

export function resolveDurationByPartySize(rules: DurationRule[], partySize: number) {
  const match = rules.find(
    (rule) => partySize >= rule.minPartySize && partySize <= rule.maxPartySize,
  );
  if (!match) {
    throw new AppError(
      "No hay regla de duracion para ese numero de personas.",
      422,
      "MISSING_DURATION_RULE",
    );
  }
  return match.durationMinutes;
}

export function buildOccupancyWindow(
  bookingStart: Date,
  durationMinutes: number,
  bufferBeforeMinutes: number,
  bufferAfterMinutes: number,
) {
  const bookingEnd = addMinutes(bookingStart, durationMinutes);
  return {
    booking: { start: bookingStart, end: bookingEnd },
    occupancy: {
      start: addMinutes(bookingStart, -bufferBeforeMinutes),
      end: addMinutes(bookingEnd, bufferAfterMinutes),
    },
  };
}

export function isBookingWithinOpeningWindows(
  booking: TimeWindow,
  openingWindows: TimeWindow[],
) {
  return openingWindows.some(
    (window) => booking.start >= window.start && booking.end <= window.end,
  );
}

export function findBestCandidateForSlot(params: {
  partySize: number;
  occupancyWindow: TimeWindow;
  candidates: CandidateTableSet[];
  occupancies: OccupancyItem[];
  blocks: BlockedItem[];
}) {
  const available = params.candidates.filter((candidate) => {
    const blocked = params.blocks.some((block) => {
      const hitsTable = !block.tableId || candidate.tableIds.includes(block.tableId);
      return hitsTable && overlaps(params.occupancyWindow, { start: block.start, end: block.end });
    });
    if (blocked) return false;

    const conflict = params.occupancies.some((occupied) => {
      if (!candidate.tableIds.includes(occupied.tableId)) return false;
      return overlaps(params.occupancyWindow, { start: occupied.start, end: occupied.end });
    });
    return !conflict;
  });

  if (available.length === 0) return null;

  return [...available].sort((a, b) => {
    const wasteA = a.maxCapacity - params.partySize;
    const wasteB = b.maxCapacity - params.partySize;
    if (wasteA !== wasteB) return wasteA - wasteB;
    if (a.tableIds.length !== b.tableIds.length) return a.tableIds.length - b.tableIds.length;
    return a.id.localeCompare(b.id);
  })[0];
}

export function suggestNearbyTimes(
  preferredTime: string,
  availableTimes: string[],
  maxSuggestions = 3,
) {
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  };
  const preferred = toMinutes(preferredTime);

  return [...availableTimes]
    .sort((a, b) => {
      const distanceDiff = Math.abs(toMinutes(a) - preferred) - Math.abs(toMinutes(b) - preferred);
      if (distanceDiff !== 0) return distanceDiff;
      return toMinutes(a) - toMinutes(b);
    })
    .slice(0, maxSuggestions);
}
