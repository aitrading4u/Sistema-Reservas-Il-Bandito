import type { Metadata } from "next";
import { ilBanditoConfig } from "@/config/il-bandito.config";
import { MisReservasForm } from "@/modules/reservations/ui/mis-reservas-form";

export const metadata: Metadata = {
  title: `Mis reservas | ${ilBanditoConfig.restaurant.name}`,
  description: "Consulta el estado de tus reservas y el historial.",
};

export default function MisReservasPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mis reservas</h1>
        <p className="text-sm text-muted-foreground">
          Introduce el email y el telefono con los que reservaste. Mostramos todas las reservas de esa
          cuenta, pasadas y futuras.
        </p>
      </div>
      <MisReservasForm />
    </section>
  );
}
