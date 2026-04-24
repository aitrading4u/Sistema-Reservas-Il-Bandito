"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { madridLocalDateTimeToUtcIso } from "@/lib/datetime";
import {
  cancelAdminReservation,
  createAdminReservation,
  deleteAdminReservationPermanent,
  fetchAdminReservations,
  updateAdminReservation,
  type AdminReservationRow,
} from "@/modules/admin/infrastructure/admin-api";
import { SectionHeader } from "@/modules/admin/ui/section-header";
import { StatusBadge } from "@/modules/admin/ui/status-badge";

const statusOptions = ["all", "pending", "confirmed", "cancelled", "seated", "finished", "no_show"] as const;

export default function AdminReservasPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("all");
  const [name, setName] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [rows, setRows] = useState<AdminReservationRow[]>([]);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [formState, setFormState] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    partySize: 2,
    date,
    time: "20:30",
    comments: "",
  });

  const normalizedStatus = status === "all" ? undefined : status;

  useEffect(() => {
    fetchAdminReservations({ date, status: normalizedStatus, name: name || undefined })
      .then((payload) => {
        setRows(payload.items);
        setError("");
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : "No se pudieron cargar reservas.";
        setError(message);
      });
  }, [date, name, normalizedStatus]);

  const tableRows = useMemo(() => rows, [rows]);

  function formatTime(iso: string) {
    return new Intl.DateTimeFormat("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/Madrid",
    }).format(new Date(iso));
  }

  async function refreshRows() {
    const payload = await fetchAdminReservations({ date, status: normalizedStatus, name: name || undefined });
    setRows(payload.items);
  }

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Lista de reservas"
        description="Filtra, crea, edita o mueve reservas de forma operativa."
      />
      {error ? <Card className="border-primary/40 p-4 text-sm text-primary">{error}</Card> : null}
      {feedback ? <Card className="border-emerald-500/40 p-4 text-sm text-emerald-700">{feedback}</Card> : null}

      <Card className="space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="f-date">Fecha</Label>
            <Input id="f-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-status">Estado</Label>
            <select
              id="f-status"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value as (typeof statusOptions)[number])}
            >
              {statusOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-name">Nombre cliente</Label>
            <Input
              id="f-name"
              placeholder="Buscar por nombre"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={() => setFormOpen((prev) => !prev)}>
              {formOpen ? "Cerrar alta manual" : "Crear reserva manual"}
            </Button>
          </div>
        </div>
      </Card>

      {formOpen ? (
        <Card className="space-y-3 p-4">
          <h3 className="text-sm font-semibold">Nueva reserva manual</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Nombre"
              value={formState.customerName}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, customerName: event.target.value }))
              }
            />
            <Input
              placeholder="Telefono"
              value={formState.customerPhone}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, customerPhone: event.target.value }))
              }
            />
            <Input
              type="email"
              placeholder="Email"
              value={formState.customerEmail}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, customerEmail: event.target.value }))
              }
            />
            <Input
              type="number"
              min={1}
              max={12}
              value={formState.partySize}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, partySize: Number(event.target.value || 1) }))
              }
            />
            <Input
              type="date"
              value={formState.date}
              onChange={(event) => setFormState((prev) => ({ ...prev, date: event.target.value }))}
            />
            <Input
              type="time"
              value={formState.time}
              onChange={(event) => setFormState((prev) => ({ ...prev, time: event.target.value }))}
            />
          </div>
          <Input
            placeholder="Comentario opcional"
            value={formState.comments}
            onChange={(event) => setFormState((prev) => ({ ...prev, comments: event.target.value }))}
          />
          <div className="flex justify-end">
            <Button
              onClick={async () => {
                try {
                  await createAdminReservation({
                    customerName: formState.customerName,
                    customerPhone: formState.customerPhone,
                    customerEmail: formState.customerEmail,
                    partySize: formState.partySize,
                    startAtISO: madridLocalDateTimeToUtcIso(formState.date, formState.time),
                    customerComment: formState.comments || undefined,
                  });
                  setFormOpen(false);
                  setFeedback("Reserva creada correctamente.");
                  await refreshRows();
                } catch (cause) {
                  const message = cause instanceof Error ? cause.message : "No se pudo crear la reserva.";
                  setError(message);
                }
              }}
            >
              Guardar reserva
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Hora</th>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Pax</th>
                <th className="px-3 py-3">Mesa</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-3 font-medium">{formatTime(row.start_at)}</td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{row.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{row.customer_phone}</p>
                  </td>
                  <td className="px-3 py-3">{row.party_size}</td>
                  <td className="px-3 py-3">Asignada por motor</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {row.status === "pending" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            try {
                              await updateAdminReservation(row.id, { status: "confirmed" });
                              setFeedback("Reserva confirmada.");
                              setError("");
                              await refreshRows();
                            } catch (cause) {
                              const message = cause instanceof Error ? cause.message : "No se pudo confirmar.";
                              setError(message);
                            }
                          }}
                        >
                          Confirmar
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          try {
                            await updateAdminReservation(row.id, { status: "seated" });
                            setFeedback("Reserva marcada como seated.");
                            await refreshRows();
                          } catch (cause) {
                            const message = cause instanceof Error ? cause.message : "No se pudo actualizar.";
                            setError(message);
                          }
                        }}
                      >
                        Llegada
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          try {
                            await updateAdminReservation(row.id, { status: "no_show" });
                            setFeedback("Reserva marcada como no-show.");
                            await refreshRows();
                          } catch (cause) {
                            const message = cause instanceof Error ? cause.message : "No se pudo actualizar.";
                            setError(message);
                          }
                        }}
                      >
                        No-show
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          try {
                            await cancelAdminReservation(row.id);
                            setFeedback("Reserva cancelada.");
                            await refreshRows();
                          } catch (cause) {
                            const message = cause instanceof Error ? cause.message : "No se pudo cancelar.";
                            setError(message);
                          }
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          const confirmed = window.confirm(
                            "¿Borrar definitivamente esta reserva? Esta accion no se puede deshacer.",
                          );
                          if (!confirmed) return;
                          try {
                            await deleteAdminReservationPermanent(row.id);
                            setFeedback("Reserva borrada definitivamente.");
                            await refreshRows();
                          } catch (cause) {
                            const message = cause instanceof Error ? cause.message : "No se pudo borrar.";
                            setError(message);
                          }
                        }}
                      >
                        Borrar
                      </Button>
                      <Link href={`/admin/reservas/${row.id}`}>
                        <Button size="sm">Detalle</Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                    No hay reservas con esos filtros.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
