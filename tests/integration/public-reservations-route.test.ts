import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const createPublicReservationMock = vi.fn();
const getPublicAvailabilityMock = vi.fn();
const sendReservationConfirmationMock = vi.fn();
const getDefaultRestaurantIdMock = vi.fn();

vi.mock("@/modules/reservations/application/public-booking.service", () => ({
  createPublicReservation: createPublicReservationMock,
  getPublicAvailability: getPublicAvailabilityMock,
}));

vi.mock("@/modules/notifications/application/transactional-email.service", () => ({
  TransactionalEmailService: class {
    sendReservationConfirmation = sendReservationConfirmationMock;
  },
}));

vi.mock("@/modules/notifications/application/email-locale", () => ({
  resolveEmailLocale: () => "es",
}));

vi.mock("@/lib/supabase/admin", () => ({
  getDefaultRestaurantId: getDefaultRestaurantIdMock,
}));

describe("POST /api/public/reservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDefaultRestaurantIdMock.mockReturnValue("550e8400-e29b-41d4-a716-446655440000");
  });

  it("creates reservation and returns 201", async () => {
    createPublicReservationMock.mockResolvedValue({
      reservation_id: "res-1",
      reservation_code: "IB-ABC123",
      status: "pending",
      start_at: "2026-07-10T20:30:00+02:00",
    });

    const { POST } = await import("@/app/api/public/reservations/route");
    const response = await POST(
      new Request("http://localhost/api/public/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Laura",
          customerPhone: "+34 600000001",
          customerEmail: "laura@example.com",
          partySize: 2,
          date: "2026-07-10",
          time: "20:30",
          comments: "Mesa tranquila",
          locale: "es",
        }),
      }),
    );

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.reservationCode).toBe("IB-ABC123");
    expect(sendReservationConfirmationMock).toHaveBeenCalledTimes(1);
  });

  it("returns 409 and nearby suggestions when slot becomes unavailable", async () => {
    createPublicReservationMock.mockRejectedValue(
      new AppError("No hay disponibilidad para esa hora.", 409, "NO_AVAILABILITY"),
    );
    getPublicAvailabilityMock.mockResolvedValue({
      suggestions: ["20:45", "21:15", "20:30"],
    });

    const { POST } = await import("@/app/api/public/reservations/route");
    const response = await POST(
      new Request("http://localhost/api/public/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Laura",
          customerPhone: "+34 600000001",
          customerEmail: "laura@example.com",
          partySize: 2,
          date: "2026-07-10",
          time: "21:00",
          comments: "",
          locale: "es",
        }),
      }),
    );

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.code).toBe("NO_AVAILABILITY");
    expect(payload.suggestions).toEqual(["20:45", "21:15", "20:30"]);
  });
});
