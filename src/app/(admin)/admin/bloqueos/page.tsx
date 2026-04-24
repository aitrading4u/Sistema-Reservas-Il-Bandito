"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { madridLocalDateTimeToUtcIso } from "@/lib/datetime";
import {
  createAdminBlock,
  fetchAdminBlocks,
  removeAdminBlock,
} from "@/modules/admin/infrastructure/admin-api";
import { SectionHeader } from "@/modules/admin/ui/section-header";

export default function AdminBloqueosPage() {
  const [blocks, setBlocks] = useState<
    Array<{ id: string; table_id: string | null; starts_at: string; ends_at: string; reason: string }>
  >([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("20:00");
  const [endTime, setEndTime] = useState("21:00");
  const [reason, setReason] = useState("Bloqueo operativo");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    fetchAdminBlocks(date)
      .then((payload) => {
        setBlocks(payload.items);
        setError("");
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : "No se pudieron cargar bloqueos.";
        setError(message);
      });
  }, [date]);

  function formatDateTime(iso: string) {
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/Madrid",
    }).format(new Date(iso));
  }

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Bloqueos manuales"
        description="Bloquea mesas o franjas horarias por incidencias o eventos."
      />
      {error ? <Card className="border-primary/40 p-4 text-sm text-primary">{error}</Card> : null}
      {feedback ? <Card className="border-emerald-500/40 p-4 text-sm text-emerald-700">{feedback}</Card> : null}

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Nuevo bloqueo</h2>
        <div className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1">
            <Label>Fecha</Label>
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Desde</Label>
            <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Hasta</Label>
            <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Motivo</Label>
            <Input value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={async () => {
              try {
                await createAdminBlock({
                  startsAtISO: madridLocalDateTimeToUtcIso(date, startTime),
                  endsAtISO: madridLocalDateTimeToUtcIso(date, endTime),
                  reason,
                });
                const payload = await fetchAdminBlocks(date);
                setBlocks(payload.items);
                setFeedback("Bloqueo creado correctamente.");
              } catch (cause) {
                const message = cause instanceof Error ? cause.message : "No se pudo crear el bloqueo.";
                setError(message);
              }
            }}
          >
            Guardar bloqueo
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Fecha</th>
                <th className="px-3 py-3">Franja</th>
                <th className="px-3 py-3">Motivo</th>
                <th className="px-3 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((block) => (
                <tr key={block.id} className="border-t">
                  <td className="px-3 py-3">{formatDateTime(block.starts_at).slice(0, 10)}</td>
                  <td className="px-3 py-3">
                    {formatDateTime(block.starts_at).slice(11, 16)} - {formatDateTime(block.ends_at).slice(11, 16)}
                  </td>
                  <td className="px-3 py-3">{block.reason}</td>
                  <td className="px-3 py-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await removeAdminBlock(block.id);
                          const payload = await fetchAdminBlocks(date);
                          setBlocks(payload.items);
                          setFeedback("Bloqueo eliminado.");
                          setError("");
                        } catch (cause) {
                          const message = cause instanceof Error ? cause.message : "No se pudo eliminar el bloqueo.";
                          setError(message);
                        }
                      }}
                    >
                      Quitar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
