"use client";

import { useState } from "react";
import { isDemoMode } from "@/lib/demo-mode";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

const DEMO_RESERVATIONS_KEY = "ilbandito.demo.public.reservations.v1";

type Row = {
  id: string;
  reservation_code: string;
  status: string;
  party_size: number;
  start_at: string;
  customer_name: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  seated: "En mesa",
  finished: "Finalizada",
  no_show: "No asistio",
};

function normalizeDigits(s: string) {
  return s.replace(/\D/g, "");
}

function formatMadrid(iso: string) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}

export function MisReservasForm() {
  const demoMode = isDemoMode();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    setError("");
    setRows(null);
    if (!email.trim() || !phone.trim()) {
      setError("Introduce email y telefono usados al reservar.");
      return;
    }

    setLoading(true);
    try {
      if (demoMode) {
        if (typeof window === "undefined") {
          setRows([]);
        } else {
          const raw = window.localStorage.getItem(DEMO_RESERVATIONS_KEY);
          const list = raw
            ? (JSON.parse(raw) as Array<{
                date: string;
                time: string;
                email?: string;
                phone?: string;
                code?: string;
                partySize?: number;
                name?: string;
              }>)
            : [];
          const wantE = email.trim().toLowerCase();
          const wantP = normalizeDigits(phone);
          const matched = list.filter(
            (item) =>
              item.email && item.phone &&
              item.email.trim().toLowerCase() === wantE &&
              normalizeDigits(item.phone) === wantP,
          );
          setRows(
            matched.map((item, i) => ({
              id: `demo-${i}`,
              reservation_code: item.code ?? "—",
              status: "pending",
              party_size: item.partySize ?? 1,
              start_at: new Date(`${item.date}T${item.time}:00`).toISOString(),
              customer_name: item.name ?? "—",
            })),
          );
        }
      } else {
        const response = await fetch("/api/public/mis-reservas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerEmail: email.trim(),
            customerPhone: phone.trim(),
          }),
        });
        const data = (await response.json()) as { error?: string; items?: Row[] };
        if (!response.ok) {
          setError(data.error ?? "No se pudo consultar.");
          return;
        }
        setRows(data.items ?? []);
      }
    } catch {
      setError("No se pudo consultar. Intentalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {demoMode ? (
        <p className="rounded-xl border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">
          Modo demo: se muestran las reservas simuladas de este navegador (mismo email y telefono que al reservar).
        </p>
      ) : null}
      <Card className="space-y-4 p-4 sm:p-6">
        <div className="space-y-2">
          <Label htmlFor="mr-email">Email</Label>
          <Input
            id="mr-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mr-phone">Telefono</Label>
          <Input
            id="mr-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Mismo numero que al reservar"
          />
        </div>
        {error ? (
          <p className="text-sm text-primary" role="alert">
            {error}
          </p>
        ) : null}
        <Button className="w-full sm:w-auto" onClick={onSubmit} disabled={loading}>
          {loading ? "Buscando..." : "Ver mis reservas"}
        </Button>
      </Card>

      {rows !== null ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Tus reservas</h2>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hemos encontrado reservas con esos datos. Revisa el email y el telefono o reserva
              de nuevo.
            </p>
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => (
                <li key={row.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-sm text-muted-foreground">Codigo {row.reservation_code}</p>
                        <p className="text-base font-medium">{row.customer_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatMadrid(row.start_at)} · {row.party_size} personas
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                          row.status === "cancelled" || row.status === "no_show"
                            ? "bg-primary/10 text-primary"
                            : row.status === "finished"
                              ? "bg-muted text-muted-foreground"
                              : "bg-emerald-100 text-emerald-800",
                        )}
                      >
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
