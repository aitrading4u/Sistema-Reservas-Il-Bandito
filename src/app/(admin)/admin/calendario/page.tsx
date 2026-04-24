"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchAdminCalendarMonthSummary } from "@/modules/admin/infrastructure/admin-api";
import { SectionHeader } from "@/modules/admin/ui/section-header";

const weekdayLabels = ["L", "M", "X", "J", "V", "S", "D"];

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(date);
}

function normalizeMondayFirst(dayIndex: number) {
  return dayIndex === 0 ? 6 : dayIndex - 1;
}

function calendarDays(viewMonth: Date) {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const leading = normalizeMondayFirst(firstDay.getDay());

  const cells: Array<{ iso: string; day: number } | null> = [];
  for (let i = 0; i < leading; i += 1) cells.push(null);
  for (let day = 1; day <= totalDays; day += 1) {
    const iso = new Date(year, month, day, 12).toISOString().slice(0, 10);
    cells.push({ iso, day });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function AdminCalendarioPage() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [daysWithReservations, setDaysWithReservations] = useState<Record<string, number>>({});

  const monthValue = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = String(viewMonth.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }, [viewMonth]);

  const cells = calendarDays(viewMonth);

  useEffect(() => {
    fetchAdminCalendarMonthSummary(monthValue)
      .then((summary) => {
        const map: Record<string, number> = {};
        for (const day of summary.days) {
          map[day.date] = day.count;
        }
        setDaysWithReservations(map);
      })
      .catch(() => {
        setDaysWithReservations({});
      });
  }, [monthValue]);

  function previousMonth() {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  function nextMonth() {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  function onDatePicked(nextDate: string) {
    setDate(nextDate);
    const d = new Date(`${nextDate}T12:00:00`);
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  function openDayReservations(targetDate?: string) {
    const pickedDate = targetDate ?? date;
    router.push(`/admin/calendario/dia?date=${encodeURIComponent(pickedDate)}`);
  }

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Calendario diario"
        description="Selecciona una fecha y abre la pagina de reservas de ese dia."
      />

      <Card className="space-y-4 p-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Elegir fecha
          </label>
          <Input type="date" value={date} onChange={(event) => onDatePicked(event.target.value)} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button size="sm" variant="secondary" onClick={previousMonth}>
            Mes anterior
          </Button>
          <p className="text-sm font-semibold capitalize">{monthLabel(viewMonth)}</p>
          <Button size="sm" variant="secondary" onClick={nextMonth}>
            Mes siguiente
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-muted-foreground">
          {weekdayLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {cells.map((cell, index) =>
            cell ? (
              <button
                key={cell.iso}
                type="button"
                onClick={() => openDayReservations(cell.iso)}
                className={
                  date === cell.iso
                    ? "h-10 rounded-xl border border-primary bg-primary text-primary-foreground text-sm font-semibold"
                    : daysWithReservations[cell.iso]
                      ? "h-10 rounded-xl border border-amber-300 bg-amber-100 text-amber-900 text-sm font-semibold hover:bg-amber-200"
                    : "h-10 rounded-xl border border-border/80 bg-card text-sm font-medium hover:bg-muted/60"
                }
              >
                {cell.day}
              </button>
            ) : (
              <span key={`empty-${index}`} className="h-10" />
            ),
          )}
        </div>
        <div className="flex justify-end">
          <Button onClick={() => openDayReservations()}>Abrir reservas del dia</Button>
        </div>
      </Card>
    </section>
  );
}
