"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  deleteAdminReservationPermanent,
  fetchAdminCalendar,
  updateAdminReservation,
} from "@/modules/admin/infrastructure/admin-api";
import { SectionHeader } from "@/modules/admin/ui/section-header";
import { StatusBadge } from "@/modules/admin/ui/status-badge";

type ReservationRow = {
  id: string;
  reservation_code: string;
  customer_name: string;
  party_size: number;
  status: "pending" | "confirmed" | "cancelled" | "seated" | "finished" | "no_show";
  start_at: string;
};

function addDays(dateISO: string, days: number) {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function timeFromISO(iso: string) {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}

export default function AdminCalendarioDiaPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function refreshDay() {
    try {
      const payload = await fetchAdminCalendar(date);
      setReservations(payload.reservations);
      setError("");
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : "No se pudieron cargar reservas del dia.";
      setError(message);
    }
  }

  useEffect(() => {
    fetchAdminCalendar(date)
      .then((payload) => {
        setReservations(payload.reservations);
        setError("");
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : "No se pudieron cargar reservas del dia.";
        setError(message);
      });
  }, [date]);

  const lunchReservations = useMemo(
    () =>
      reservations
        .filter((item) => {
          const hour = Number(timeFromISO(item.start_at).split(":")[0]);
          return hour < 17;
        })
        .sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [reservations],
  );

  const dinnerReservations = useMemo(
    () =>
      reservations
        .filter((item) => {
          const hour = Number(timeFromISO(item.start_at).split(":")[0]);
          return hour >= 17;
        })
        .sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [reservations],
  );

  function openDay(nextDate: string) {
    router.push(`/admin/calendario/dia?date=${encodeURIComponent(nextDate)}`);
  }

  async function confirmReservation(id: string) {
    try {
      setUpdatingId(id);
      await updateAdminReservation(id, { status: "confirmed" });
      setFeedback("Reserva confirmada.");
      setError("");
      await refreshDay();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se pudo confirmar la reserva.";
      setError(message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function markSeated(id: string) {
    try {
      setUpdatingId(id);
      await updateAdminReservation(id, { status: "seated" });
      setFeedback("Reserva marcada como llegada.");
      setError("");
      await refreshDay();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se pudo actualizar.";
      setError(message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function markNoShow(id: string) {
    try {
      setUpdatingId(id);
      await updateAdminReservation(id, { status: "no_show" });
      setFeedback("Reserva marcada como no-show.");
      setError("");
      await refreshDay();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se pudo actualizar.";
      setError(message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function removeReservation(id: string) {
    const confirmed = window.confirm(
      "¿Borrar definitivamente esta reserva? Esta accion no se puede deshacer.",
    );
    if (!confirmed) return;
    try {
      setUpdatingId(id);
      await deleteAdminReservationPermanent(id);
      setFeedback("Reserva borrada.");
      setError("");
      await refreshDay();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No se pudo borrar.";
      setError(message);
    } finally {
      setUpdatingId(null);
    }
  }

  function dayActionButtons(item: ReservationRow) {
    const busy = updatingId === item.id;
    return (
      <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
        {item.status === "pending" ? (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => confirmReservation(item.id)}>
            Confirmar
          </Button>
        ) : null}
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => markSeated(item.id)}>
          Llegada
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => markNoShow(item.id)}>
          No-show
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => removeReservation(item.id)}>
          Borrar
        </Button>
        <StatusBadge status={item.status} />
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Reservas del dia"
        description="Solo se muestran reservas registradas para optimizar espacio operativo."
      />

      <div className="flex justify-end">
        <Link href="/admin/calendario">
          <Button variant="ghost">Volver al calendario</Button>
        </Link>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <Button variant="secondary" onClick={() => openDay(addDays(date, -1))}>
          Dia anterior
        </Button>
        <p className="text-sm font-semibold">
          {new Intl.DateTimeFormat("es-ES", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          }).format(new Date(`${date}T12:00:00`))}
        </p>
        <Button variant="secondary" onClick={() => openDay(addDays(date, 1))}>
          Dia siguiente
        </Button>
      </Card>

      {error ? <Card className="border-primary/40 p-4 text-sm text-primary">{error}</Card> : null}
      {feedback ? <Card className="border-emerald-500/40 p-4 text-sm text-emerald-700">{feedback}</Card> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-lg font-semibold">Servicio comida</h2>
          <div className="mt-3 space-y-2">
            {lunchReservations.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/70 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {timeFromISO(item.start_at)} · {item.customer_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.party_size} pax · <span className="font-mono">{item.reservation_code}</span>
                    </p>
                  </div>
                  {dayActionButtons(item)}
                </div>
              </div>
            ))}
            {lunchReservations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin reservas en comida.</p>
            ) : null}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-semibold">Servicio cena</h2>
          <div className="mt-3 space-y-2">
            {dinnerReservations.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/70 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {timeFromISO(item.start_at)} · {item.customer_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.party_size} pax · <span className="font-mono">{item.reservation_code}</span>
                    </p>
                  </div>
                  {dayActionButtons(item)}
                </div>
              </div>
            ))}
            {dinnerReservations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin reservas en cena.</p>
            ) : null}
          </div>
        </Card>
      </div>
    </section>
  );
}
