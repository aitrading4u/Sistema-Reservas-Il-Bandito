"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { openingHoursSeed } from "@/modules/admin/data/admin.seed";
import type { OpeningHourRule } from "@/modules/admin/domain/admin.types";
import { SectionHeader } from "@/modules/admin/ui/section-header";

const weekdayMap: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miercoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sabado",
  7: "Domingo",
};

const STORAGE_KEY = "ilbandito.demo.opening-hours.v1";

export default function AdminHorariosPage() {
  const [rows, setRows] = useState<OpeningHourRule[]>(() => {
    if (typeof window === "undefined") return openingHoursSeed;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return openingHoursSeed;
    try {
      return JSON.parse(stored) as OpeningHourRule[];
    } catch {
      return openingHoursSeed;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }, [rows]);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        `${String(a.weekday).padStart(2, "0")}${a.service}`.localeCompare(
          `${String(b.weekday).padStart(2, "0")}${b.service}`,
        ),
      ),
    [rows],
  );

  function updateRow(id: string, patch: Partial<OpeningHourRule>) {
    setRows((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        id: `oh-${Date.now()}`,
        weekday: 1,
        service: "lunch",
        openTime: "13:00",
        closeTime: "16:00",
        active: true,
      },
    ]);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Horarios de apertura"
        description="Gestiona turnos de comida y cena por dia de la semana."
      />
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Puedes editar directamente cada fila. Los cambios se reflejan al instante en demo.
          </p>
          <Button onClick={addRow}>Añadir franja</Button>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Dia</th>
                <th className="px-3 py-3">Servicio</th>
                <th className="px-3 py-3">Apertura</th>
                <th className="px-3 py-3">Cierre</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((rule) => (
                <tr key={rule.id} className="border-t">
                  <td className="px-3 py-3 font-medium">
                    <select
                      className="h-10 rounded-xl border border-border bg-card px-3"
                      value={rule.weekday}
                      onChange={(event) =>
                        updateRow(rule.id, { weekday: Number(event.target.value) })
                      }
                    >
                      {Object.entries(weekdayMap).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="h-10 rounded-xl border border-border bg-card px-3"
                      value={rule.service}
                      onChange={(event) =>
                        updateRow(rule.id, { service: event.target.value as "lunch" | "dinner" })
                      }
                    >
                      <option value="lunch">Comida</option>
                      <option value="dinner">Cena</option>
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <Input
                      type="time"
                      value={rule.openTime}
                      onChange={(event) => updateRow(rule.id, { openTime: event.target.value })}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Input
                      type="time"
                      value={rule.closeTime}
                      onChange={(event) => updateRow(rule.id, { closeTime: event.target.value })}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Button
                      size="sm"
                      variant={rule.active ? "default" : "secondary"}
                      onClick={() => updateRow(rule.id, { active: !rule.active })}
                    >
                      {rule.active ? "Activo" : "Inactivo"}
                    </Button>
                  </td>
                  <td className="px-3 py-3">
                    <Button size="sm" variant="ghost" onClick={() => removeRow(rule.id)}>
                      Eliminar
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
