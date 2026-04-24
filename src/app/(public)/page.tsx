import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PublicHomePage() {
  return (
    <section className="space-y-6">
      <Card className="overflow-hidden p-6 sm:p-8">
        <div className="h-1.5 w-28 rounded-full bg-gradient-to-r from-primary/90 to-[#b08a53]" />
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-primary/90">Il Bandito Altea</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Reserva tu mesa en segundos
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Flujo optimizado para móvil, con disponibilidad real, sugerencias
          automáticas y confirmación por email.
        </p>
        <div className="mt-6 grid gap-3 sm:flex">
          <Link className="w-full sm:w-auto" href="/reservas">
            <Button className="w-full" size="lg">Reservar ahora</Button>
          </Link>
        </div>
      </Card>
    </section>
  );
}
