"use client";

import { useEffect, useMemo, useState } from "react";
import { reservationSeed } from "@/modules/admin/data/admin.seed";
import type { AdminReservation, AdminReservationStatus } from "@/modules/admin/domain/admin.types";

const STORAGE_KEY = "ilbandito.admin.reservations.v1";

interface Filters {
  date: string;
  status: "all" | AdminReservationStatus;
  name: string;
}

interface CreateManualReservationInput {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  partySize: number;
  date: string;
  time: string;
  comments?: string;
}

function reservationCode(id: string) {
  return `IB-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

function nowId() {
  return `${Date.now()}-${Math.floor(Math.random() * 9999)}`;
}

export function useAdminReservations() {
  const [reservations, setReservations] = useState<AdminReservation[]>(() => {
    if (typeof window === "undefined") {
      return reservationSeed;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return reservationSeed;
    }

    try {
      return JSON.parse(stored) as AdminReservation[];
    } catch {
      return reservationSeed;
    }
  });

  useEffect(() => {
    if (reservations.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
    }
  }, [reservations]);

  const actions = useMemo(
    () => ({
      createManualReservation(input: CreateManualReservationInput) {
        const id = nowId();
        const service = input.time < "17:00" ? "lunch" : "dinner";
        const newItem: AdminReservation = {
          id,
          code: reservationCode(id),
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerEmail: input.customerEmail,
          partySize: input.partySize,
          date: input.date,
          time: input.time,
          status: "confirmed",
          service,
          notesInternal: "Creada desde panel admin",
          comments: input.comments ?? "",
          tableLabel: undefined,
        };
        setReservations((prev) => [newItem, ...prev]);
      },
      updateReservation(id: string, patch: Partial<AdminReservation>) {
        setReservations((prev) =>
          prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        );
      },
      cancelReservation(id: string) {
        setReservations((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: "cancelled" } : item)),
        );
      },
      moveReservation(id: string, date: string, time: string) {
        setReservations((prev) =>
          prev.map((item) => (item.id === id ? { ...item, date, time } : item)),
        );
      },
      markSeated(id: string) {
        setReservations((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: "seated" } : item)),
        );
      },
      markNoShow(id: string) {
        setReservations((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: "no_show" } : item)),
        );
      },
      addInternalNote(id: string, note: string) {
        setReservations((prev) =>
          prev.map((item) => (item.id === id ? { ...item, notesInternal: note } : item)),
        );
      },
    }),
    [],
  );

  function filterReservations(filters: Filters) {
    return reservations
      .filter((reservation) => (filters.date ? reservation.date === filters.date : true))
      .filter((reservation) =>
        filters.status === "all" ? true : reservation.status === filters.status,
      )
      .filter((reservation) =>
        filters.name
          ? reservation.customerName.toLowerCase().includes(filters.name.toLowerCase())
          : true,
      )
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }

  return { reservations, actions, filterReservations };
}
