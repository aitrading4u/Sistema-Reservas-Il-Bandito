"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchAdminSettings,
  purgeOperationalData,
  saveAdminSettings,
} from "@/modules/admin/infrastructure/admin-api";
import { isDemoMode } from "@/lib/demo-mode";
import { SectionHeader } from "@/modules/admin/ui/section-header";

export default function AdminAjustesPage() {
  const demoMode = isDemoMode();
  const [restaurantName, setRestaurantName] = useState("");
  const [timezone, setTimezone] = useState("Europe/Madrid");
  const [slotInterval, setSlotInterval] = useState(15);
  const [bufferBefore, setBufferBefore] = useState(0);
  const [bufferAfter, setBufferAfter] = useState(15);
  const [maxReservationsPerSlot, setMaxReservationsPerSlot] = useState(3);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [purgeMessage, setPurgeMessage] = useState("");

  useEffect(() => {
    fetchAdminSettings()
      .then((settings) => {
        setRestaurantName(settings.restaurant.name);
        setTimezone(settings.restaurant.timezone);
        setSlotInterval(settings.rules.slot_interval_minutes);
        setBufferBefore(settings.rules.default_buffer_before_minutes);
        setBufferAfter(settings.rules.default_buffer_after_minutes);
        setMaxReservationsPerSlot(
          "max_reservations_per_slot" in settings.rules && settings.rules.max_reservations_per_slot != null
            ? Number(settings.rules.max_reservations_per_slot)
            : 3,
        );
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : "No se pudieron cargar ajustes.";
        setError(message);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Ajustes del restaurante"
        description="Configuracion general de reservas y parametros operativos."
      />
      {error ? <Card className="border-primary/40 p-4 text-sm text-primary">{error}</Card> : null}

      <Card className="space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="restaurantName">Nombre comercial</Label>
            <Input
              id="restaurantName"
              value={restaurantName}
              onChange={(event) => setRestaurantName(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="timezone">Zona horaria</Label>
            <Input id="timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="slotInterval">Intervalo de slots (min)</Label>
            <Input
              id="slotInterval"
              type="number"
              min={5}
              value={slotInterval}
              onChange={(event) => setSlotInterval(Number(event.target.value || 15))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bufferBefore">Buffer previo (min)</Label>
            <Input
              id="bufferBefore"
              type="number"
              min={0}
              value={bufferBefore}
              onChange={(event) => setBufferBefore(Number(event.target.value || 0))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bufferAfter">Buffer entre reservas (min)</Label>
            <Input
              id="bufferAfter"
              type="number"
              min={0}
              value={bufferAfter}
              onChange={(event) => setBufferAfter(Number(event.target.value || 0))}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="maxPerSlot">Max. reservas por franja horaria</Label>
            <Input
              id="maxPerSlot"
              type="number"
              min={1}
              max={100}
              value={maxReservationsPerSlot}
              onChange={(event) => setMaxReservationsPerSlot(Number(event.target.value || 3))}
            />
            <p className="text-xs text-muted-foreground">
              Cada franja dura lo mismo que el intervalo de slots (arriba). Por ejemplo, con 15 min y aqui 3, solo
              se aceptan 3 reservas que empiezan en el mismo bloque (misma hora de entrada en la web).
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          {saved ? <p className="text-xs text-emerald-700">Cambios guardados</p> : null}
          <Button
            disabled={loading}
            onClick={async () => {
              try {
                await saveAdminSettings({
                  restaurantName,
                  timezone: "Europe/Madrid",
                  slotIntervalMinutes: slotInterval,
                  bufferBeforeMinutes: bufferBefore,
                  bufferAfterMinutes: bufferAfter,
                  maxReservationsPerSlot,
                });
                setSaved(true);
                setError("");
              } catch (cause) {
                const message = cause instanceof Error ? cause.message : "No se pudieron guardar ajustes.";
                setError(message);
              }
            }}
          >
            Guardar ajustes
          </Button>
        </div>
      </Card>

      <Card className="space-y-3 border-primary/25 p-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Vaciar datos de prueba</h2>
          <p className="text-sm text-muted-foreground">
            Elimina todas las reservas, perfiles de cliente, bloqueos, lista negra y entradas de
            auditoria de este restaurante. No se borran cuentas de administrador, mesas, horarios ni
            reglas de reserva.
          </p>
        </div>
        {demoMode ? (
          <p className="text-sm text-muted-foreground">
            En modo demo no aplica: los datos de prueba estan en el navegador, no en la base de
            datos.
          </p>
        ) : null}
        {purgeMessage ? <p className="text-sm text-emerald-700">{purgeMessage}</p> : null}
        <Button
          type="button"
          variant="secondary"
          className="border-primary/30 text-primary hover:bg-primary/10"
          disabled={demoMode || loading || purgeBusy}
          onClick={async () => {
            if (
              !window.confirm(
                "Seguro? Se eliminaran permanentemente reservas, clientes, bloqueos, lista negra y auditoria. No se puede deshacer.",
              )
            ) {
              return;
            }
            if (
              !window.confirm(
                "Confirmacion final: se borraran todos los datos operativos excepto ajustes y accesos admin.",
              )
            ) {
              return;
            }
            setPurgeBusy(true);
            setPurgeMessage("");
            setError("");
            try {
              await purgeOperationalData();
              setPurgeMessage("Datos operativos eliminados correctamente.");
            } catch (cause) {
              const message = cause instanceof Error ? cause.message : "No se pudo vaciar los datos.";
              setError(message);
            } finally {
              setPurgeBusy(false);
            }
          }}
        >
          {purgeBusy ? "Borrando..." : "Eliminar reservas y datos de prueba"}
        </Button>
      </Card>
    </section>
  );
}
