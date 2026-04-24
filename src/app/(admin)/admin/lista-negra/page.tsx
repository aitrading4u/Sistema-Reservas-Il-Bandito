"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createBlacklistEntry,
  fetchBlacklist,
  fetchBlacklistHistory,
  removeBlacklistEntry,
} from "@/modules/admin/infrastructure/admin-api";
import { SectionHeader } from "@/modules/admin/ui/section-header";

interface BlacklistItem {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  reason: string;
  is_active: boolean;
  created_at: string;
  removed_at: string | null;
}

interface HistoryItem {
  id: string;
  event_type: string;
  note: string;
  created_at: string;
}

export default function AdminListaNegraPage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<BlacklistItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    reason: "",
  });

  async function loadHistory(id: string) {
    const data = await fetchBlacklistHistory(id);
    setHistory(data.items);
  }

  useEffect(() => {
    fetchBlacklist(query || undefined)
      .then((data) => {
        setItems(data.items);
        setError("");
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "No se pudo cargar lista negra.");
      });
  }, [query]);

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Lista negra de clientes"
        description="Controla reincidencias no-show y registra historial por cliente."
      />

      {error ? <Card className="border-primary/40 p-4 text-sm text-primary">{error}</Card> : null}
      {feedback ? (
        <Card className="border-emerald-500/40 p-4 text-sm text-emerald-700">{feedback}</Card>
      ) : null}

      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Añadir cliente a lista negra</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            placeholder="Nombre cliente"
            value={form.customerName}
            onChange={(event) => setForm((prev) => ({ ...prev, customerName: event.target.value }))}
          />
          <Input
            placeholder="Email"
            type="email"
            value={form.customerEmail}
            onChange={(event) => setForm((prev) => ({ ...prev, customerEmail: event.target.value }))}
          />
          <Input
            placeholder="Telefono"
            value={form.customerPhone}
            onChange={(event) => setForm((prev) => ({ ...prev, customerPhone: event.target.value }))}
          />
          <Input
            placeholder="Motivo"
            value={form.reason}
            onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
          />
        </div>
        <div className="flex justify-end">
          <Button
            onClick={async () => {
              try {
                await createBlacklistEntry(form);
                setFeedback("Cliente añadido a lista negra.");
                setError("");
                setForm({ customerName: "", customerEmail: "", customerPhone: "", reason: "" });
                const data = await fetchBlacklist(query || undefined);
                setItems(data.items);
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "No se pudo añadir.");
              }
            }}
          >
            Añadir
          </Button>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <Input
          placeholder="Buscar por nombre, email o telefono"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3">Contacto</th>
                  <th className="px-3 py-3">Motivo</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-3 font-medium">{item.customer_name}</td>
                    <td className="px-3 py-3">
                      <p>{item.customer_email}</p>
                      <p className="text-xs text-muted-foreground">{item.customer_phone}</p>
                    </td>
                    <td className="px-3 py-3">{item.reason}</td>
                    <td className="px-3 py-3">{item.is_active ? "Activa" : "Inactiva"}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            setSelectedId(item.id);
                            await loadHistory(item.id);
                          }}
                        >
                          Historial
                        </Button>
                        {item.is_active ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              await removeBlacklistEntry(item.id, "Retirado manualmente");
                              setFeedback("Cliente retirado de lista negra.");
                              const data = await fetchBlacklist(query || undefined);
                              setItems(data.items);
                              if (selectedId === item.id) {
                                await loadHistory(item.id);
                              }
                            }}
                          >
                            Quitar
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold">
            Historial {selectedId ? `(entrada ${selectedId})` : ""}
          </h3>
          <div className="mt-3 space-y-2">
            {history.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/70 p-3 text-sm">
                <p className="font-medium">{item.event_type}</p>
                <p className="text-muted-foreground">{item.note}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(item.created_at).toLocaleString("es-ES")}
                </p>
              </div>
            ))}
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Selecciona un cliente para ver historial de eventos.
              </p>
            ) : null}
          </div>
        </Card>
      </div>
    </section>
  );
}
