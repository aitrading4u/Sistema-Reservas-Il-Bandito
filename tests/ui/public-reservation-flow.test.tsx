import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicReservationFlow } from "@/modules/reservations/ui/public-reservation-flow";

describe("PublicReservationFlow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads available times and allows selecting one", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        date: "2026-07-10",
        partySize: 2,
        slots: [
          { time: "20:30", available: true },
          { time: "20:45", available: false },
        ],
        suggestions: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicReservationFlow />);

    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    const dateInput = screen.getByLabelText("Fecha de reserva");
    fireEvent.change(dateInput, { target: { value: "2026-07-10" } });
    await userEvent.click(screen.getByRole("button", { name: "Ver horarios" }));

    await screen.findByRole("button", { name: /20:30/ });
    await userEvent.click(screen.getByRole("button", { name: /20:30/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByRole("heading", { name: "4. Tus datos" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows field-level validation errors on guest info", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        date: "2026-07-10",
        partySize: 2,
        slots: [{ time: "20:30", available: true }],
        suggestions: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicReservationFlow />);

    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.change(screen.getByLabelText("Fecha de reserva"), {
      target: { value: "2026-07-10" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Ver horarios" }));
    await screen.findByRole("button", { name: /20:30/ });
    await userEvent.click(screen.getByRole("button", { name: /20:30/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await userEvent.click(screen.getByRole("button", { name: "Revisar reserva" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Too small:");
    });
  });
});
