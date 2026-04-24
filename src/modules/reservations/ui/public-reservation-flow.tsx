"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ilBanditoConfig } from "@/config/il-bandito.config";
import { isDemoMode } from "@/lib/demo-mode";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { publicReservationCreateSchema } from "@/lib/validations/public-reservation";
import { cn } from "@/lib/utils/cn";

type Slot = {
  time: string;
  available: boolean;
};

type AvailabilityResponse = {
  date: string;
  partySize: number;
  slots: Slot[];
  suggestions: string[];
  message?: string;
};

const steps = [
  "Comensales",
  "Fecha",
  "Horario",
  "Datos",
  "Confirmar",
  "Listo",
] as const;

const partyOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const pageText = ilBanditoConfig.publicTexts;
const confirmationText = ilBanditoConfig.confirmationTexts;
const DEMO_RESERVATIONS_KEY = "ilbandito.demo.public.reservations.v1";

function todayISO() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  const year = copy.getFullYear();
  const month = String(copy.getMonth() + 1).padStart(2, "0");
  const day = String(copy.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function prettyDate(dateISO: string) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(`${dateISO}T00:00:00`));
}

function prettyTime(time: string) {
  return `${time} h`;
}

const guestInfoSchema = publicReservationCreateSchema.pick({
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  comments: true,
});

type GuestInfo = z.infer<typeof guestInfoSchema>;

export function PublicReservationFlow() {
  const demoMode = isDemoMode();
  const [step, setStep] = useState(1);
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState<string>("");
  const [guestInfo, setGuestInfo] = useState<GuestInfo>({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    comments: "",
  });
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [availabilityMessage, setAvailabilityMessage] = useState<string>("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [guestErrors, setGuestErrors] = useState<Partial<Record<keyof GuestInfo, string>>>({});
  const [reservationCode, setReservationCode] = useState<string>("");

  const minDate = useMemo(() => todayISO(), []);
  const maxDate = useMemo(() => addDays(new Date(), 60), []);

  const progressPercent = useMemo(() => (step / steps.length) * 100, [step]);
  const suggestedDates = useMemo(
    () => [0, 1, 2, 3].map((offset) => addDays(new Date(), offset)),
    [],
  );

  type DemoBookingSlot = { date: string; time: string; email?: string; phone?: string; code?: string; partySize?: number; name?: string };

  function readDemoReservations() {
    if (typeof window === "undefined") return [] as DemoBookingSlot[];
    const raw = window.localStorage.getItem(DEMO_RESERVATIONS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as DemoBookingSlot[];
    } catch {
      return [];
    }
  }

  function writeDemoReservations(items: DemoBookingSlot[]) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DEMO_RESERVATIONS_KEY, JSON.stringify(items));
  }

  function buildDemoAvailability(preferredTime?: string): AvailabilityResponse {
    const baseSlots = [
      "13:00",
      "13:30",
      "14:00",
      "14:30",
      "15:00",
      "19:30",
      "20:00",
      "20:30",
      "21:00",
      "21:30",
      "22:00",
    ];
    const taken = new Set(
      readDemoReservations()
        .filter((r) => r.date === date)
        .map((r) => r.time),
    );
    const slots = baseSlots.map((slot) => ({ time: slot, available: !taken.has(slot) }));
    const suggestions = preferredTime
      ? slots
          .filter((slot) => slot.available)
          .map((slot) => slot.time)
          .sort((a, b) => Math.abs(Number(a.replace(":", "")) - Number(preferredTime.replace(":", ""))) - Math.abs(Number(b.replace(":", "")) - Number(preferredTime.replace(":", ""))))
          .slice(0, 3)
      : [];

    return {
      date,
      partySize,
      slots,
      suggestions,
      message: "Modo demo: disponibilidad simulada para revisar UX.",
    };
  }

  async function fetchAvailability(preferredTime?: string) {
    setLoadingSlots(true);
    setError("");
    setFeedback("Buscando disponibilidad...");
    setAvailabilityMessage("");
    setSuggestions([]);

    if (demoMode) {
      const data = buildDemoAvailability(preferredTime);
      setAvailability(data);
      setFeedback("");
      setAvailabilityMessage(data.message ?? "");
      if (preferredTime && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
      setLoadingSlots(false);
      return;
    }

    const params = new URLSearchParams({
      partySize: String(partySize),
      date,
    });
    if (preferredTime) {
      params.set("preferredTime", preferredTime);
    }

    try {
      const response = await fetch(`/api/public/availability?${params.toString()}`);
      const data = (await response.json()) as AvailabilityResponse & { error?: string };

      if (!response.ok) {
        setError(data.error ?? "No se pudo cargar la disponibilidad.");
        setFeedback("");
        setAvailability(null);
        return;
      }

      setAvailability(data);
      setFeedback("");
      setAvailabilityMessage(data.message ?? "");
      if (preferredTime && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch {
      setError("No pudimos cargar las horas. Intentalo de nuevo.");
      setFeedback("");
      setAvailability(null);
    } finally {
      setLoadingSlots(false);
    }
  }

  function goNext() {
    setStep((current) => Math.min(current + 1, 6));
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 1));
    setError("");
    setFeedback("");
  }

  async function onContinueToTimes() {
    await fetchAvailability();
    setStep(3);
  }

  async function onPickSlot(slot: Slot) {
    setError("");
    if (slot.available) {
      setTime(slot.time);
      setSuggestions([]);
      return;
    }

    await fetchAvailability(slot.time);
    setError(`La hora ${slot.time} ya no esta disponible. Te sugerimos alternativas cercanas.`);
  }

  function onContinueToGuestInfo() {
    if (!time) {
      setError("Selecciona una hora para continuar.");
      return;
    }
    setError("");
    setStep(4);
  }

  function onGuestInfoChange<K extends keyof GuestInfo>(field: K, value: GuestInfo[K]) {
    setGuestInfo((prev) => ({ ...prev, [field]: value }));
    setGuestErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validateGuestInfo() {
    const parsed = guestInfoSchema.safeParse(guestInfo);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof GuestInfo, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof GuestInfo | undefined;
        if (field && !nextErrors[field]) {
          nextErrors[field] = issue.message;
        }
      }
      setGuestErrors(nextErrors);
      setError(parsed.error.issues[0]?.message ?? "Revisa los campos marcados.");
      return false;
    }
    setGuestErrors({});
    setError("");
    return true;
  }

  function onContinueToConfirm() {
    if (!validateGuestInfo()) return;
    setStep(5);
  }

  async function onConfirmReservation() {
    setConfirming(true);
    setError("");
    setFeedback("Confirmando tu reserva...");

    try {
      if (demoMode) {
        const booked = readDemoReservations();
        if (booked.some((item) => item.date === date && item.time === time)) {
          const refreshed = buildDemoAvailability(time);
          setSuggestions(refreshed.suggestions);
          setStep(3);
          setFeedback("");
          setError("Esa hora ya no esta disponible en demo. Elige una sugerencia.");
          return;
        }

        const nextCode = `IB-DEMO-${String(Date.now()).slice(-4)}`;
        setReservationCode(nextCode);
        writeDemoReservations([
          ...booked,
          {
            date,
            time,
            email: guestInfo.customerEmail,
            phone: guestInfo.customerPhone,
            name: guestInfo.customerName,
            partySize,
            code: nextCode,
          },
        ]);
        setFeedback("");
        setStep(6);
        return;
      }

      const payload = {
        partySize,
        date,
        time,
        locale: "es",
        customerName: guestInfo.customerName,
        customerPhone: guestInfo.customerPhone,
        customerEmail: guestInfo.customerEmail,
        comments: guestInfo.comments,
      };

      const response = await fetch("/api/public/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        error?: string;
        reservationCode?: string;
        suggestions?: string[];
      };

      if (!response.ok) {
        if (response.status === 409 && data.suggestions?.length) {
          setSuggestions(data.suggestions);
          setStep(3);
          setFeedback("");
          setError("La hora seleccionada se acaba de ocupar. Elige una de estas sugerencias.");
          return;
        }

        setFeedback("");
        setError(data.error ?? "No se pudo confirmar tu reserva.");
        return;
      }

      setReservationCode(data.reservationCode ?? "");
      setFeedback("");
      setStep(6);
    } catch {
      setFeedback("");
      setError("Ha ocurrido un error inesperado. Vuelve a intentarlo.");
    } finally {
      setConfirming(false);
    }
  }

  function resetFlow() {
    setStep(1);
    setPartySize(2);
    setDate(todayISO());
    setTime("");
    setGuestInfo({
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      comments: "",
    });
    setAvailability(null);
    setSuggestions([]);
    setAvailabilityMessage("");
    setError("");
    setFeedback("");
    setGuestErrors({});
    setReservationCode("");
  }

  return (
    <div className="space-y-4 pb-16">
      <Card className="overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#2f5f4f] via-[#f7f2ea] to-[#9c3f2e]" />
        <div className="space-y-3 p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {ilBanditoConfig.restaurant.name} Altea
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {pageText.reservationTitle}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {pageText.reservationSubtitle}
          </p>
          <p className="text-sm text-muted-foreground">
            <span>¿Ya hiciste una reserva? </span>
            <Link
              href="/mis-reservas"
              className="font-semibold text-foreground underline decoration-primary/50 underline-offset-2 hover:decoration-primary"
            >
              Ver tus reservas
            </Link>
            <span> con el mismo email y telefono que usaste al reservar.</span>
          </p>
          {demoMode ? (
            <p className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
              Modo demo activo: puedes probar el flujo sin backend.
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">{pageText.reservationSupport}</p>
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Paso {step} de {steps.length}</span>
              <span>{steps[step - 1]}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted/80">
              <div
                className="h-2 rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 sm:p-6" aria-busy={loadingSlots || confirming}>
        {step === 1 ? (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">1. Cuantas personas sois?</h2>
            <div className="grid grid-cols-5 gap-2">
              {partyOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={partySize === option}
                  className={cn(
                    "h-12 rounded-xl border text-base font-semibold shadow-sm transition-colors sm:text-sm",
                    partySize === option
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted",
                  )}
                  onClick={() => setPartySize(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="sticky bottom-2 bg-card pt-1">
              <Button className="w-full" size="lg" onClick={goNext}>
                Continuar
              </Button>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">2. Elige la fecha</h2>
            <div className="space-y-2">
              <Label htmlFor="reservation-date">Fecha de reserva</Label>
              <Input
                id="reservation-date"
                type="date"
                min={minDate}
                max={maxDate}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedDates.map((suggestedDate) => (
                <button
                  key={suggestedDate}
                  type="button"
                  className={cn(
                    "rounded-full border border-border/80 px-3 py-2 text-sm font-medium shadow-sm",
                    date === suggestedDate ? "border-primary bg-primary text-primary-foreground" : "bg-background",
                  )}
                  onClick={() => setDate(suggestedDate)}
                >
                  {prettyDate(suggestedDate)}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button className="flex-1" size="lg" variant="secondary" onClick={goBack}>
                Atras
              </Button>
              <Button className="flex-1" size="lg" onClick={onContinueToTimes} disabled={loadingSlots}>
                Ver horarios
              </Button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">3. Selecciona una hora</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {prettyDate(date)} · {partySize} personas
              </p>
            </div>

            {loadingSlots ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, index) => (
                  <div key={index} className="h-11 animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            ) : null}
            {!loadingSlots && availability?.slots.length ? (
              <div className="grid grid-cols-3 gap-2">
                {availability.slots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    aria-label={
                      slot.available
                        ? `Hora ${slot.time} disponible`
                        : `Hora ${slot.time} no disponible, ver alternativas`
                    }
                  className={cn(
                    "h-11 rounded-xl border text-base font-medium shadow-sm transition-colors sm:text-sm",
                      time === slot.time && slot.available
                        ? "border-primary bg-primary text-primary-foreground"
                        : slot.available
                          ? "bg-background hover:bg-muted"
                          : "border-dashed text-muted-foreground hover:bg-muted",
                    )}
                    onClick={() => onPickSlot(slot)}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            ) : null}

            {availabilityMessage ? (
              <p className="text-sm text-muted-foreground">{availabilityMessage}</p>
            ) : null}

            {suggestions.length > 0 ? (
              <div className="space-y-2 rounded-xl border border-border/70 bg-muted/35 p-3">
                <p className="text-sm font-medium">Te recomendamos estas horas cercanas:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <Button key={s} size="sm" variant="secondary" onClick={() => setTime(s)}>
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex gap-3">
              <Button className="flex-1" size="lg" variant="secondary" onClick={goBack}>
                Atras
              </Button>
              <Button className="flex-1" size="lg" onClick={onContinueToGuestInfo}>
                Continuar
              </Button>
            </div>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">4. Tus datos</h2>
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label htmlFor="customerName">Nombre completo</Label>
                <Input
                  id="customerName"
                  autoComplete="name"
                  aria-invalid={Boolean(guestErrors.customerName)}
                  value={guestInfo.customerName}
                  onChange={(event) => onGuestInfoChange("customerName", event.target.value)}
                />
                {guestErrors.customerName ? (
                  <p className="text-xs font-medium text-primary">{guestErrors.customerName}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Telefono</Label>
                <Input
                  id="customerPhone"
                  autoComplete="tel"
                  inputMode="tel"
                  aria-invalid={Boolean(guestErrors.customerPhone)}
                  value={guestInfo.customerPhone}
                  onChange={(event) => onGuestInfoChange("customerPhone", event.target.value)}
                />
                {guestErrors.customerPhone ? (
                  <p className="text-xs font-medium text-primary">{guestErrors.customerPhone}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerEmail">Email</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  aria-invalid={Boolean(guestErrors.customerEmail)}
                  value={guestInfo.customerEmail}
                  onChange={(event) => onGuestInfoChange("customerEmail", event.target.value)}
                />
                {guestErrors.customerEmail ? (
                  <p className="text-xs font-medium text-primary">{guestErrors.customerEmail}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="comments">Comentarios (opcional)</Label>
                <Textarea
                  id="comments"
                  value={guestInfo.comments}
                  onChange={(event) => onGuestInfoChange("comments", event.target.value)}
                  placeholder="Alergias o peticiones especiales"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button className="flex-1" size="lg" variant="secondary" onClick={goBack}>
                Atras
              </Button>
              <Button className="flex-1" size="lg" onClick={onContinueToConfirm}>
                Revisar reserva
              </Button>
            </div>
          </section>
        ) : null}

        {step === 5 ? (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">5. Confirmar reserva</h2>
            <div className="space-y-2 rounded-xl border border-border/70 bg-muted/35 p-4 text-sm">
              <p><strong>Personas:</strong> {partySize}</p>
              <p><strong>Fecha:</strong> {prettyDate(date)}</p>
              <p><strong>Hora:</strong> {prettyTime(time)}</p>
              <p><strong>Nombre:</strong> {guestInfo.customerName}</p>
              <p><strong>Telefono:</strong> {guestInfo.customerPhone}</p>
              <p><strong>Email:</strong> {guestInfo.customerEmail}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Al confirmar, recibirás un email con los detalles de tu reserva.
            </p>
            <div className="flex gap-3">
              <Button className="flex-1" size="lg" variant="secondary" onClick={goBack}>
                Editar
              </Button>
              <Button className="flex-1" size="lg" onClick={onConfirmReservation} disabled={confirming}>
                {confirming ? "Confirmando..." : "Confirmar reserva"}
              </Button>
            </div>
          </section>
        ) : null}

        {step === 6 ? (
          <section className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-base font-semibold text-emerald-700">
              OK
            </div>
            <h2 className="text-2xl font-semibold">6. {confirmationText.successHeadline}</h2>
            <p className="text-sm text-muted-foreground">
              {confirmationText.successBody}
            </p>
            <div className="rounded-xl border border-border/70 bg-muted/35 p-4">
              <p className="text-sm text-muted-foreground">Codigo de reserva</p>
              <p className="mt-1 text-xl font-semibold tracking-wide">{reservationCode}</p>
            </div>
            <p className="text-xs text-muted-foreground">{confirmationText.defaultInstructions}</p>
            <Link
              href="/mis-reservas"
              className={cn(buttonVariants({ variant: "secondary", size: "lg", className: "w-full" }))}
            >
              Ver mis reservas
            </Link>
            <Button className="w-full" size="lg" onClick={resetFlow}>
              Hacer otra reserva
            </Button>
          </section>
        ) : null}

        {feedback ? (
          <p className="mt-4 text-sm text-muted-foreground" role="status" aria-live="polite">
            {feedback}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm font-medium text-primary" role="alert" aria-live="assertive">
            {error}
          </p>
        ) : null}
      </Card>

      <Card className="p-4">
        <p className="text-sm font-medium">{pageText.contactHint}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {pageText.contactPhoneLabel}: {ilBanditoConfig.restaurant.phone}
        </p>
      </Card>
    </div>
  );
}
