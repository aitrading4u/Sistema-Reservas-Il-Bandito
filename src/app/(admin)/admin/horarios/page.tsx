"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isDemoMode } from "@/lib/demo-mode";
import { openingHoursSeed } from "@/modules/admin/data/admin.seed";
import type { OpeningHourRule } from "@/modules/admin/domain/admin.types";
import {
  createAdminOpeningHour,
  fetchAdminOpeningHours,
  removeAdminOpeningHour,
  updateAdminOpeningHour,
} from "@/modules/admin/infrastructure/admin-api";
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
  const demoMode = isDemoMode();
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
    if (typeof window === "undefined" || !demoMode) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }, [rows, demoMode]);

  useEffect(() => {
    if (demoMode) return;
    let mounted = true;
    void fetchAdminOpeningHours()
      .then((result) => {
        if (!mounted) return;
        const mapped: OpeningHourRule[] = result.items.map((row) => ({
          id: row.id,
          weekday: row.weekday,
          service: row.service,
          openTime: row.open_time.slice(0, 5),
          closeTime: row.close_time.slice(0, 5),
          active: row.is_active,
        }));
        setRows(mapped);
      })
      .catch(() => {
        // fallback handled by existing local state
      });
    return () => {
      mounted = false;
    };
  }, [demoMode]);

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
    setRows((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, ...patch } : item));
      if (!demoMode) {
        const row = next.find((item) => item.id === id);
        if (row) {
          void updateAdminOpeningHour(id, {
            weekday: row.weekday,
            service: row.service,
            open_time: row.openTime,
            close_time: row.closeTime,
            is_active: row.active,
          });
        }
      }
      return next;
    });
  }

  function addRow() {
    const draft: OpeningHourRule = {
      id: `oh-${Date.now()}`,
      weekday: 1,
      service: "lunch",
      openTime: "13:00",
      closeTime: "16:00",
      active: true,
    };
    if (demoMode) {
      setRows((prev) => [...prev, draft]);
      return;
    }
    void createAdminOpeningHour({
      weekday: draft.weekday,
      service: draft.service,
      open_time: draft.openTime,
      close_time: draft.closeTime,
      is_active: draft.active,
    }).then((created) => {
      const item = created.item;
      if (!item) return;
      setRows((prev) => [
        ...prev,
        {
          id: item.id,
          weekday: item.weekday,
          service: item.service,
          openTime: item.open_time.slice(0, 5),
          closeTime: item.close_time.slice(0, 5),
          active: item.is_active,
        },
      ]);
    });
  }

  function removeRow(id: string) {
    if (!demoMode) {
      void removeAdminOpeningHour(id);
    }
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
            {demoMode
              ? "Puedes editar directamente cada fila. Los cambios se reflejan al instante en demo."
              : "Puedes editar cada fila y se guarda en la base de datos real."}
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
