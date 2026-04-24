import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAdminReservations } from "@/modules/admin/hooks/use-admin-reservations";

describe("useAdminReservations", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates manual reservation and can filter by customer name", () => {
    const { result } = renderHook(() => useAdminReservations());

    act(() => {
      result.current.actions.createManualReservation({
        customerName: "Test Cliente",
        customerPhone: "+34 600123123",
        customerEmail: "test@cliente.com",
        partySize: 2,
        date: "2026-07-10",
        time: "20:30",
        comments: "Prueba",
      });
    });

    const filtered = result.current.filterReservations({
      date: "2026-07-10",
      status: "all",
      name: "test cliente",
    });

    expect(filtered.length).toBe(1);
    expect(filtered[0].customerEmail).toBe("test@cliente.com");
  });

  it("updates status to no_show and supports status filtering", () => {
    const { result } = renderHook(() => useAdminReservations());

    const current = result.current.reservations[0];
    expect(current).toBeTruthy();

    act(() => {
      result.current.actions.markNoShow(current.id);
    });

    const filtered = result.current.filterReservations({
      date: current.date,
      status: "no_show",
      name: "",
    });

    expect(filtered.some((item) => item.id === current.id)).toBe(true);
  });
});
