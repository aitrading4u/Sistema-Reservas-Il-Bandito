"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deleteContact, fetchContacts, upsertBlacklistFromContact } from "@/modules/admin/infrastructure/admin-api";
import { SectionHeader } from "@/modules/admin/ui/section-header";

interface ContactItem {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_reservations: number;
  no_show_count: number;
  last_reservation_at: string;
  is_blacklisted: boolean;
  blacklist_id: string | null;
}

export default function AdminContactosPage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ContactItem[]>([]);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function refreshContacts() {
    const data = await fetchContacts(query || undefined);
    setItems(data.items);
    setError("");
  }

  useEffect(() => {
    fetchContacts(query || undefined)
      .then((data) => {
        setItems(data.items);
        setError("");
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "No se pudo cargar contactos.");
      });
  }, [query]);

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Historial de contactos"
        description="Lista unificada de contactos de reservas con su historico de actividad."
      />

      {error ? <Card className="border-primary/40 p-4 text-sm text-primary">{error}</Card> : null}
      {feedback ? (
        <Card className="border-emerald-500/40 p-4 text-sm text-emerald-700">{feedback}</Card>
      ) : null}

      <Card className="space-y-3 p-4">
        <Input
          placeholder="Buscar por nombre, email o telefono"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Telefono</th>
                <th className="px-3 py-3">Reservas</th>
                <th className="px-3 py-3">No-show</th>
                <th className="px-3 py-3">Ultima reserva</th>
                <th className="px-3 py-3">Lista negra</th>
                <th className="px-3 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.customer_email}-${item.customer_phone}`} className="border-t">
                  <td className="px-3 py-3 font-medium">{item.customer_name}</td>
                  <td className="px-3 py-3">{item.customer_email}</td>
                  <td className="px-3 py-3">{item.customer_phone}</td>
                  <td className="px-3 py-3">{item.total_reservations}</td>
                  <td className="px-3 py-3">{item.no_show_count}</td>
                  <td className="px-3 py-3">
                    {new Date(item.last_reservation_at).toLocaleString("es-ES")}
                  </td>
                  <td className="px-3 py-3">{item.is_blacklisted ? "Si" : "No"}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={item.is_blacklisted ? "ghost" : "secondary"}
                        disabled={busyKey === `${item.customer_email}|${item.customer_phone}`}
                        onClick={async () => {
                          try {
                            const key = `${item.customer_email}|${item.customer_phone}`;
                            setBusyKey(key);
                            await upsertBlacklistFromContact({
                              customerName: item.customer_name,
                              customerEmail: item.customer_email,
                              customerPhone: item.customer_phone,
                              isBlacklisted: item.is_blacklisted,
                              blacklistId: item.blacklist_id,
                            });
                            setFeedback(
                              item.is_blacklisted
                                ? "Contacto desbloqueado de lista negra."
                                : "Contacto bloqueado en lista negra.",
                            );
                            await refreshContacts();
                          } catch (cause) {
                            setError(
                              cause instanceof Error
                                ? cause.message
                                : "No se pudo actualizar lista negra del contacto.",
                            );
                          } finally {
                            setBusyKey(null);
                          }
                        }}
                      >
                        {item.is_blacklisted ? "Desbloquear" : "Bloquear"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busyKey === `${item.customer_email}|${item.customer_phone}`}
                        onClick={async () => {
                          const key = `${item.customer_email}|${item.customer_phone}`;
                          const confirmed = window.confirm(
                            "¿Borrar contacto e historial de reservas? Esta accion no se puede deshacer.",
                          );
                          if (!confirmed) return;
                          try {
                            setBusyKey(key);
                            await deleteContact({
                              customerEmail: item.customer_email,
                              customerPhone: item.customer_phone,
                            });
                            setFeedback("Contacto eliminado con su historial.");
                            await refreshContacts();
                          } catch (cause) {
                            setError(
                              cause instanceof Error ? cause.message : "No se pudo eliminar el contacto.",
                            );
                          } finally {
                            setBusyKey(null);
                          }
                        }}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    No hay contactos para los filtros actuales.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
