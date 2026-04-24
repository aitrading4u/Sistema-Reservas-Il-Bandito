"use client";

import { useMemo, useState } from "react";
import { createReservationSchema } from "@/lib/validations/reservation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type FormState = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  partySize: string;
  reservationDate: string;
  reservationTime: string;
  comments: string;
};

const initialState: FormState = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  partySize: "2",
  reservationDate: "",
  reservationTime: "",
  comments: "",
};

export function ReservationForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [message, setMessage] = useState<string>("");

  const isValid = useMemo(() => {
    const parsed = createReservationSchema.safeParse(form);
    return parsed.success;
  }, [form]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createReservationSchema.safeParse(form);

    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Revisa los campos.");
      return;
    }

    setMessage("Reserva validada localmente. Lista para enviar al backend.");
  }

  return (
    <Card className="p-4 sm:p-6">
      <form className="grid gap-4" onSubmit={onSubmit} noValidate>
        <div className="grid gap-2">
          <Label htmlFor="customerName">Nombre</Label>
          <Input
            id="customerName"
            name="customerName"
            autoComplete="name"
            value={form.customerName}
            onChange={(event) => updateField("customerName", event.target.value)}
            required
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="customerPhone">Telefono</Label>
            <Input
              id="customerPhone"
              name="customerPhone"
              autoComplete="tel"
              inputMode="tel"
              value={form.customerPhone}
              onChange={(event) => updateField("customerPhone", event.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customerEmail">Email</Label>
            <Input
              id="customerEmail"
              name="customerEmail"
              autoComplete="email"
              type="email"
              value={form.customerEmail}
              onChange={(event) => updateField("customerEmail", event.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="partySize">Personas</Label>
            <Input
              id="partySize"
              name="partySize"
              type="number"
              min={1}
              max={20}
              value={form.partySize}
              onChange={(event) => updateField("partySize", event.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reservationDate">Fecha</Label>
            <Input
              id="reservationDate"
              name="reservationDate"
              type="date"
              value={form.reservationDate}
              onChange={(event) => updateField("reservationDate", event.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reservationTime">Hora</Label>
            <Input
              id="reservationTime"
              name="reservationTime"
              type="time"
              value={form.reservationTime}
              onChange={(event) => updateField("reservationTime", event.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="comments">Comentarios</Label>
          <Textarea
            id="comments"
            name="comments"
            value={form.comments}
            onChange={(event) => updateField("comments", event.target.value)}
            placeholder="Alergias, preferencia de zona, celebracion..."
          />
        </div>

        {message ? (
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {message}
          </p>
        ) : null}

        <Button type="submit" disabled={!isValid}>
          Buscar disponibilidad
        </Button>
      </form>
    </Card>
  );
}
