"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { madridLocalDateTimeToUtcIso } from "@/lib/datetime";
import {
  cancelAdminReservation,
  createBlacklistEntry,
  deleteAdminReservationPermanent,
  fetchContacts,
  fetchAdminReservation,
  updateAdminReservation,
  type AdminReservationRow,
} from "@/modules/admin/infrastructure/admin-api";
import { SectionHeader } from "@/modules/admin/ui/section-header";
import { StatusBadge } from "@/modules/admin/ui/status-badge";

export function ReservationDetailClient({ id }: { id: string }) {
  const [reservation, setReservation] = useState<AdminReservationRow | null>(null);
  const [moveDate, setMoveDate] = useState(new Date().toISOString().slice(0, 10));
  const [moveTime, setMoveTime] = useState("21:00");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isBlacklisted, setIsBlacklisted] = useState(false);
  const [blacklistBusy, setBlacklistBusy] = useState(false);

  async function refresh() {
    const payload = await fetchAdminReservation(id);
    setReservation(payload.item);
    setNote(payload.item.internal_notes ?? "");
    const contacts = await fetchContacts(payload.item.customer_email);
    const currentContact = contacts.items.find(
      (item) =>
        item.customer_email === payload.item.customer_email &&
        item.customer_phone === payload.item.customer_phone,
    );
    setIsBlacklisted(Boolean(currentContact?.is_blacklisted));
  }

  useEffect(() => {
    fetchAdminReservation(id)
      .then((payload) => {
        setReservation(payload.item);
        setNote(payload.item.internal_notes ?? "");
        return fetchContacts(payload.item.customer_email).then((contacts) => {
          const currentContact = contacts.items.find(
            (item) =>
              item.customer_email === payload.item.customer_email &&
              item.customer_phone === payload.item.customer_phone,
          );
          setIsBlacklisted(Boolean(currentContact?.is_blacklisted));
        });
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : "No se ha encontrado la reserva.";
        setError(message);
      });
  }, [id]);

  if (!reservation) {
    return (
      <section className="space-y-3">
        <SectionHeader title="Detalle de reserva" description="No se ha encontrado la reserva." />
        {error ? <Card className="border-primary/40 p-4 text-sm text-primary">{error}</Card> : null}
        <Link href="/admin/reservas">
          <Button variant="secondary">Volver a lista</Button>
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <SectionHeader
        title={`Reserva ${reservation.reservation_code}`}
        description="Editar datos, mover hora y registrar estado de servicio."
      />
      {error ? <Card className="border-primary/40 p-4 text-sm text-primary">{error}</Card> : null}
      {feedback ? <Card className="border-emerald-500/40 p-4 text-sm text-emerald-700">{feedback}</Card> : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="space-y-3 p-4 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Datos principales</h2>
            <StatusBadge status={reservation.status} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Nombre</Label>
              <Input
                value={reservation.customer_name}
                onChange={(event) => setReservation((prev) => prev ? { ...prev, customer_name: event.target.value } : prev)}
              />
            </div>
            <div>
              <Label>Telefono</Label>
              <Input
                value={reservation.customer_phone}
                onChange={(event) => setReservation((prev) => prev ? { ...prev, customer_phone: event.target.value } : prev)}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={reservation.customer_email}
                onChange={(event) => setReservation((prev) => prev ? { ...prev, customer_email: event.target.value } : prev)}
              />
            </div>
            <div>
              <Label>Comensales</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={reservation.party_size}
                onChange={(event) =>
                  setReservation((prev) =>
                    prev
                      ? {
                          ...prev,
                          party_size: Number(event.target.value || prev.party_size),
                        }
                      : prev,
                  )
                }
              />
            </div>
          </div>
          <div>
            <Label>Notas internas</Label>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await updateAdminReservation(reservation.id, {
                      internalNotes: note,
                    });
                    setFeedback("Nota guardada.");
                    setError("");
                    await refresh();
                  } catch (cause) {
                    const message = cause instanceof Error ? cause.message : "No se pudo guardar la nota.";
                    setError(message);
                  }
                }}
              >
                Guardar nota
              </Button>
            </div>
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="text-lg font-semibold">Acciones operativas</h2>
          <div className="space-y-2">
            <Button
              className="w-full"
              variant="secondary"
              onClick={async () => {
                try {
                  await updateAdminReservation(reservation.id, { status: "seated" });
                  setFeedback("Reserva marcada como seated.");
                  await refresh();
                } catch (cause) {
                  const message = cause instanceof Error ? cause.message : "No se pudo actualizar estado.";
                  setError(message);
                }
              }}
            >
              Marcar llegada
            </Button>
            <Button
              className="w-full"
              variant="secondary"
              onClick={async () => {
                try {
                  await updateAdminReservation(reservation.id, { status: "no_show" });
                  setFeedback("Reserva marcada como no-show.");
                  await refresh();
                } catch (cause) {
                  const message = cause instanceof Error ? cause.message : "No se pudo actualizar estado.";
                  setError(message);
                }
              }}
            >
              Marcar no-show
            </Button>
            <Button
              className="w-full"
              variant="secondary"
              onClick={async () => {
                try {
                  await cancelAdminReservation(reservation.id);
                  setFeedback("Reserva cancelada.");
                  await refresh();
                } catch (cause) {
                  const message = cause instanceof Error ? cause.message : "No se pudo cancelar la reserva.";
                  setError(message);
                }
              }}
            >
              Cancelar reserva
            </Button>
            <Button
              className="w-full"
              variant="secondary"
              onClick={async () => {
                const confirmed = window.confirm(
                  "¿Borrar definitivamente esta reserva? Esta accion no se puede deshacer.",
                );
                if (!confirmed) return;
                try {
                  await deleteAdminReservationPermanent(reservation.id);
                  setFeedback("Reserva borrada definitivamente.");
                  setError("");
                  setTimeout(() => {
                    window.location.href = "/admin/reservas";
                  }, 300);
                } catch (cause) {
                  const message = cause instanceof Error ? cause.message : "No se pudo borrar la reserva.";
                  setError(message);
                }
              }}
            >
              Borrar definitivamente
            </Button>
            <Button
              className="w-full"
              variant={isBlacklisted ? "ghost" : "secondary"}
              disabled={blacklistBusy || isBlacklisted}
              onClick={async () => {
                if (isBlacklisted) return;
                try {
                  setBlacklistBusy(true);
                  await createBlacklistEntry({
                    customerName: reservation.customer_name,
                    customerEmail: reservation.customer_email,
                    customerPhone: reservation.customer_phone,
                    reason: `Alta desde reserva ${reservation.reservation_code}`,
                  });
                  setFeedback("Cliente añadido a lista negra.");
                  setIsBlacklisted(true);
                } catch (cause) {
                  const message = cause instanceof Error ? cause.message : "No se pudo añadir a lista negra.";
                  setError(message);
                } finally {
                  setBlacklistBusy(false);
                }
              }}
            >
              {isBlacklisted ? "Ya en lista negra" : "Añadir a lista negra"}
            </Button>
          </div>
          <div className="space-y-2 border-t pt-3">
            <p className="text-sm font-medium">Mover reserva</p>
            <Input type="date" value={moveDate} onChange={(event) => setMoveDate(event.target.value)} />
            <Input type="time" value={moveTime} onChange={(event) => setMoveTime(event.target.value)} />
            <Button
              className="w-full"
              onClick={async () => {
                try {
                  await updateAdminReservation(reservation.id, {
                    moveToISO: madridLocalDateTimeToUtcIso(moveDate, moveTime),
                  });
                  setFeedback("Reserva movida correctamente.");
                  await refresh();
                } catch (cause) {
                  const message = cause instanceof Error ? cause.message : "No se pudo mover la reserva.";
                  setError(message);
                }
              }}
            >
              Confirmar cambio
            </Button>
            <Button
              className="w-full"
              onClick={async () => {
                try {
                  await updateAdminReservation(reservation.id, {
                    customerName: reservation.customer_name,
                    customerPhone: reservation.customer_phone,
                    customerEmail: reservation.customer_email,
                    partySize: reservation.party_size,
                  });
                  setFeedback("Datos principales guardados.");
                  await refresh();
                } catch (cause) {
                  const message = cause instanceof Error ? cause.message : "No se pudieron guardar datos.";
                  setError(message);
                }
              }}
            >
              Guardar datos principales
            </Button>
          </div>
          <Link href="/admin/reservas">
            <Button className="w-full" variant="ghost">
              Volver a lista
            </Button>
          </Link>
        </Card>
      </div>
    </section>
  );
}
