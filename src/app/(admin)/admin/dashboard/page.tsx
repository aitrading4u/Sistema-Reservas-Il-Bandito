"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  fetchAdminReservations,
  type AdminReservationRow,
} from "@/modules/admin/infrastructure/admin-api";
import { OccupancyCard } from "@/modules/admin/ui/occupancy-card";
import { SectionHeader } from "@/modules/admin/ui/section-header";
import { StatusBadge } from "@/modules/admin/ui/status-badge";

export default function AdminDashboardPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [todayReservations, setTodayReservations] = useState<AdminReservationRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAdminReservations({ date: today })
      .then((data) => {
        setTodayReservations(data.items);
        setError("");
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : "No se pudo cargar el dashboard.";
        setError(message);
      });
  }, [today]);

  const pending = todayReservations.filter((item) => item.status === "pending").length;
  const seated = todayReservations.filter((item) => item.status === "seated").length;
  const noShow = todayReservations.filter((item) => item.status === "no_show").length;
  const todayOccupancy = useMemo(
    () => todayReservations.reduce((total, item) => total + item.party_size, 0),
    [todayReservations],
  );
  const upcoming = useMemo(() => {
    return [...todayReservations].sort((a, b) => a.start_at.localeCompare(b.start_at)).slice(0, 5);
  }, [todayReservations]);

  function formatTime(iso: string) {
    return new Intl.DateTimeFormat("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/Madrid",
    }).format(new Date(iso));
  }

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Dashboard operativo"
        description="Vision rapida del servicio para gestionar sala en tiempo real."
      />
      {error ? <Card className="border-primary/40 p-4 text-sm text-primary">{error}</Card> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <h2 className="text-sm text-muted-foreground">Reservas hoy</h2>
          <p className="mt-2 text-3xl font-semibold">{todayReservations.length}</p>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm text-muted-foreground">Pendientes</h2>
          <p className="mt-2 text-3xl font-semibold">{pending}</p>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm text-muted-foreground">Seated</h2>
          <p className="mt-2 text-3xl font-semibold">{seated}</p>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm text-muted-foreground">No-show</h2>
          <p className="mt-2 text-3xl font-semibold">{noShow}</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <OccupancyCard title="Ocupacion hoy (pax)" occupied={todayOccupancy} capacity={56} />
        <OccupancyCard
          title="Cobertura reservas"
          occupied={todayReservations.length}
          capacity={60}
        />
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold">Proximas llegadas</h3>
        <div className="mt-3 space-y-3">
          {upcoming.map((reservation) => (
            <div
              key={reservation.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm last:border-b-0 last:pb-0"
            >
              <div>
                <p className="font-medium">
                  {formatTime(reservation.start_at)} · {reservation.customer_name}
                </p>
                <p className="text-muted-foreground">{reservation.party_size} pax</p>
              </div>
              <StatusBadge status={reservation.status} />
            </div>
          ))}
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay llegadas registradas para hoy.</p>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
