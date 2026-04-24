import { describe, expect, it } from "vitest";
import {
  buildOccupancyWindow,
  findBestCandidateForSlot,
  isBookingWithinOpeningWindows,
  resolveDurationByPartySize,
  suggestNearbyTimes,
} from "@/modules/reservations/domain/availability-rules";

describe("availability rules", () => {
  it("resolves duration by party size correctly", () => {
    const duration = resolveDurationByPartySize(
      [
        { minPartySize: 1, maxPartySize: 2, durationMinutes: 90 },
        { minPartySize: 3, maxPartySize: 4, durationMinutes: 105 },
      ],
      4,
    );
    expect(duration).toBe(105);
  });

  it("builds occupancy window applying pre and post buffer", () => {
    const start = new Date("2026-07-10T20:00:00.000Z");
    const result = buildOccupancyWindow(start, 90, 10, 15);

    expect(result.booking.start.toISOString()).toBe("2026-07-10T20:00:00.000Z");
    expect(result.booking.end.toISOString()).toBe("2026-07-10T21:30:00.000Z");
    expect(result.occupancy.start.toISOString()).toBe("2026-07-10T19:50:00.000Z");
    expect(result.occupancy.end.toISOString()).toBe("2026-07-10T21:45:00.000Z");
  });

  it("respects opening windows", () => {
    const inside = isBookingWithinOpeningWindows(
      {
        start: new Date("2026-07-10T13:30:00.000Z"),
        end: new Date("2026-07-10T14:45:00.000Z"),
      },
      [
        {
          start: new Date("2026-07-10T13:00:00.000Z"),
          end: new Date("2026-07-10T16:00:00.000Z"),
        },
      ],
    );
    const outside = isBookingWithinOpeningWindows(
      {
        start: new Date("2026-07-10T15:40:00.000Z"),
        end: new Date("2026-07-10T16:20:00.000Z"),
      },
      [
        {
          start: new Date("2026-07-10T13:00:00.000Z"),
          end: new Date("2026-07-10T16:00:00.000Z"),
        },
      ],
    );

    expect(inside).toBe(true);
    expect(outside).toBe(false);
  });

  it("chooses best candidate minimizing waste and table count", () => {
    const best = findBestCandidateForSlot({
      partySize: 4,
      occupancyWindow: {
        start: new Date("2026-07-10T20:00:00.000Z"),
        end: new Date("2026-07-10T21:45:00.000Z"),
      },
      candidates: [
        { id: "A", tableIds: ["t1"], maxCapacity: 6 },
        { id: "B", tableIds: ["t2", "t3"], maxCapacity: 6 },
        { id: "C", tableIds: ["t4"], maxCapacity: 4 },
      ],
      occupancies: [],
      blocks: [],
    });

    expect(best?.id).toBe("C");
  });

  it("returns null when slot would double-book same table", () => {
    const best = findBestCandidateForSlot({
      partySize: 2,
      occupancyWindow: {
        start: new Date("2026-07-10T20:00:00.000Z"),
        end: new Date("2026-07-10T21:45:00.000Z"),
      },
      candidates: [{ id: "T2", tableIds: ["t2"], maxCapacity: 2 }],
      occupancies: [
        {
          tableId: "t2",
          start: new Date("2026-07-10T20:30:00.000Z"),
          end: new Date("2026-07-10T22:00:00.000Z"),
        },
      ],
      blocks: [],
    });

    expect(best).toBeNull();
  });

  it("suggests nearest available times", () => {
    const suggestions = suggestNearbyTimes(
      "21:00",
      ["20:30", "21:15", "22:00", "20:45"],
      3,
    );
    expect(suggestions).toEqual(["20:45", "21:15", "20:30"]);
  });
});
