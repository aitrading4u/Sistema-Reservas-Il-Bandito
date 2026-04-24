"use client";

import { useEffect, useMemo, useState, type MouseEvent, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { combinationSeed, tableSeed } from "@/modules/admin/data/admin.seed";
import { SectionHeader } from "@/modules/admin/ui/section-header";

type PlannerZone = "Interior" | "Terraza" | "Barra";

interface PlannerTable {
  id: string;
  code: string;
  zone: PlannerZone;
  seats: number;
  x: number;
  y: number;
}

interface PlannerBar {
  x: number;
  y: number;
  width: number;
  height: number;
}

const STORAGE_TABLES = "ilbandito.demo.planner.tables.v1";
const STORAGE_BAR = "ilbandito.demo.planner.bar.v1";

function defaultPlannerTables(): PlannerTable[] {
  let interiorIndex = 0;
  let terrazaIndex = 0;
  return tableSeed.map((table) => {
    const zone = table.area === "Terraza" ? "Terraza" : "Interior";
    if (zone === "Interior") {
      const col = interiorIndex % 4;
      const row = Math.floor(interiorIndex / 4);
      interiorIndex += 1;
      return {
        id: table.id,
        code: table.code,
        zone,
        seats: table.maxCapacity,
        x: 40 + col * 95,
        y: 40 + row * 95,
      };
    }
    const col = terrazaIndex % 4;
    const row = Math.floor(terrazaIndex / 4);
    terrazaIndex += 1;
    return {
      id: table.id,
      code: table.code,
      zone,
      seats: table.maxCapacity,
      x: 40 + col * 95,
      y: 40 + row * 95,
    };
  });
}

export default function AdminMesasPage() {
  const [plannerTables, setPlannerTables] = useState<PlannerTable[]>(() => {
    if (typeof window === "undefined") return defaultPlannerTables();
    const stored = window.localStorage.getItem(STORAGE_TABLES);
    if (!stored) return defaultPlannerTables();
    try {
      return JSON.parse(stored) as PlannerTable[];
    } catch {
      return defaultPlannerTables();
    }
  });
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [plannerBar, setPlannerBar] = useState<PlannerBar>(() => {
    if (typeof window === "undefined") {
      return { x: 430, y: 160, width: 130, height: 70 };
    }
    const stored = window.localStorage.getItem(STORAGE_BAR);
    if (!stored) return { x: 430, y: 160, width: 130, height: 70 };
    try {
      return JSON.parse(stored) as PlannerBar;
    } catch {
      return { x: 430, y: 160, width: 130, height: 70 };
    }
  });
  const [dragState, setDragState] = useState<
    { type: "table"; id: string; zone: Exclude<PlannerZone, "Barra"> } | { type: "bar" } | null
  >(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_TABLES, JSON.stringify(plannerTables));
  }, [plannerTables]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_BAR, JSON.stringify(plannerBar));
  }, [plannerBar]);

  const selectedTable = plannerTables.find((table) => table.id === selectedTableId) ?? null;

  function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  function onCanvasClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const tableId = target.dataset.tableId;
    if (tableId) {
      setSelectedTableId(tableId);
      return;
    }
    setSelectedTableId(null);
  }

  function positionFromPointer(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp(event.clientX - bounds.left - 28, 10, 620),
      y: clamp(event.clientY - bounds.top - 28, 10, 340),
    };
  }

  function onCanvasPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragState) return;
    const position = positionFromPointer(event);
    if (dragState.type === "bar") {
      setPlannerBar((prev) => ({ ...prev, x: position.x, y: position.y }));
      return;
    }
    setPlannerTables((prev) =>
      prev.map((table) =>
        table.id === dragState.id && table.zone === dragState.zone
          ? {
              ...table,
              x: position.x,
              y: position.y,
            }
          : table,
      ),
    );
  }

  function endDrag() {
    setDragState(null);
  }

  function moveSelected(dx: number, dy: number) {
    if (!selectedTableId) return;
    setPlannerTables((prev) =>
      prev.map((table) =>
        table.id === selectedTableId
          ? {
              ...table,
              x: clamp(table.x + dx, 10, 620),
              y: clamp(table.y + dy, 10, 340),
            }
          : table,
      ),
    );
  }

  function moveBar(dx: number, dy: number) {
    setPlannerBar((prev) => ({
      ...prev,
      x: clamp(prev.x + dx, 10, 620),
      y: clamp(prev.y + dy, 10, 340),
    }));
  }

  function updateSelectedTableZone(zone: PlannerZone) {
    if (!selectedTableId) return;
    const nextZone = zone === "Barra" ? "Interior" : zone;
    setPlannerTables((prev) =>
      prev.map((table) => (table.id === selectedTableId ? { ...table, zone: nextZone } : table)),
    );
  }

  const interiorTables = useMemo(
    () => plannerTables.filter((table) => table.zone === "Interior"),
    [plannerTables],
  );
  const terrazaTables = useMemo(
    () => plannerTables.filter((table) => table.zone === "Terraza"),
    [plannerTables],
  );

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Mesas y combinaciones"
        description="Planning visual editable por zonas para posicionar mesas y barra."
      />

      <Card className="space-y-4 p-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="space-y-3 p-3">
            <h3 className="text-sm font-semibold">Sala interior + barra</h3>
            <div
              className="relative h-[390px] w-full overflow-hidden rounded-2xl border border-border/80 bg-[#f7f2e7]"
              onClick={onCanvasClick}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
            >
              <div className="absolute left-3 top-3 rounded-lg bg-card/90 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                Interior
              </div>
              <div
                className="absolute rounded-xl border-2 border-[#9c3f2e] bg-[#d3543f] text-xs font-semibold text-white"
                style={{
                  left: plannerBar.x,
                  top: plannerBar.y,
                  width: plannerBar.width,
                  height: plannerBar.height,
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setDragState({ type: "bar" });
                }}
              >
                <div className="flex h-full cursor-grab items-center justify-center">BARRA</div>
              </div>
              {interiorTables.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  data-table-id={table.id}
                  className={cn(
                    "absolute h-14 w-14 cursor-grab rounded-full border-2 text-xs font-semibold transition",
                    selectedTableId === table.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-[#9c3f2e] bg-[#e64d3a] text-white hover:brightness-110",
                  )}
                  style={{ left: table.x, top: table.y }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setSelectedTableId(table.id);
                    setDragState({ type: "table", id: table.id, zone: "Interior" });
                  }}
                >
                  {table.code}
                </button>
              ))}
            </div>
          </Card>

          <Card className="space-y-3 p-3">
            <h3 className="text-sm font-semibold">Terraza</h3>
            <div
              className="relative h-[390px] w-full overflow-hidden rounded-2xl border border-border/80 bg-[#f7f2e7]"
              onClick={onCanvasClick}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
            >
              <div className="absolute left-3 top-3 rounded-lg bg-card/90 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                Terraza
              </div>
              {terrazaTables.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  data-table-id={table.id}
                  className={cn(
                    "absolute h-14 w-14 cursor-grab rounded-full border-2 text-xs font-semibold transition",
                    selectedTableId === table.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-[#9c3f2e] bg-[#e64d3a] text-white hover:brightness-110",
                  )}
                  style={{ left: table.x, top: table.y }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setSelectedTableId(table.id);
                    setDragState({ type: "table", id: table.id, zone: "Terraza" });
                  }}
                >
                  {table.code}
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3 p-4">
            <h3 className="text-sm font-semibold">Mover mesa seleccionada</h3>
            {selectedTable ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Mesa {selectedTable.code} · zona {selectedTable.zone} · {selectedTable.seats} pax
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => moveSelected(0, -10)}>Arriba</Button>
                  <Button size="sm" variant="secondary" onClick={() => moveSelected(0, 10)}>Abajo</Button>
                  <Button size="sm" variant="secondary" onClick={() => moveSelected(-10, 0)}>Izquierda</Button>
                  <Button size="sm" variant="secondary" onClick={() => moveSelected(10, 0)}>Derecha</Button>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Mover a zona</label>
                  <select
                    className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
                    value={selectedTable.zone}
                    onChange={(event) => updateSelectedTableZone(event.target.value as PlannerZone)}
                  >
                    <option value="Interior">Interior</option>
                    <option value="Terraza">Terraza</option>
                  </select>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Pulsa una mesa en el plano para moverla o cambiar su zona.
              </p>
            )}
          </Card>

          <Card className="space-y-3 p-4">
            <h3 className="text-sm font-semibold">Mover barra</h3>
            <p className="text-sm text-muted-foreground">
              La barra pertenece a sala interior y puedes arrastrarla o moverla con botones.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => moveBar(0, -10)}>Arriba</Button>
              <Button size="sm" variant="secondary" onClick={() => moveBar(0, 10)}>Abajo</Button>
              <Button size="sm" variant="secondary" onClick={() => moveBar(-10, 0)}>Izquierda</Button>
              <Button size="sm" variant="secondary" onClick={() => moveBar(10, 0)}>Derecha</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">Ancho barra</label>
                <Input
                  type="number"
                  value={plannerBar.width}
                  onChange={(event) =>
                    setPlannerBar((prev) => ({ ...prev, width: clamp(Number(event.target.value || 100), 70, 220) }))
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium">Alto barra</label>
                <Input
                  type="number"
                  value={plannerBar.height}
                  onChange={(event) =>
                    setPlannerBar((prev) => ({ ...prev, height: clamp(Number(event.target.value || 60), 45, 160) }))
                  }
                />
              </div>
            </div>
          </Card>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b p-4">
            <h2 className="text-lg font-semibold">Mesas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Codigo</th>
                  <th className="px-3 py-3">Zona</th>
                  <th className="px-3 py-3">Capacidad</th>
                  <th className="px-3 py-3">Posicion</th>
                </tr>
              </thead>
              <tbody>
                {plannerTables.map((table) => (
                  <tr key={table.id} className="border-t">
                    <td className="px-3 py-3 font-medium">{table.code}</td>
                    <td className="px-3 py-3">{table.zone}</td>
                    <td className="px-3 py-3">
                      1-{table.seats}
                    </td>
                    <td className="px-3 py-3">
                      x:{Math.round(table.x)} y:{Math.round(table.y)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b p-4">
            <h2 className="text-lg font-semibold">Combinaciones</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Nombre</th>
                  <th className="px-3 py-3">Mesas</th>
                  <th className="px-3 py-3">Capacidad</th>
                  <th className="px-3 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {combinationSeed.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-3 font-medium">{item.name}</td>
                    <td className="px-3 py-3">{item.tableCodes.join(" + ")}</td>
                    <td className="px-3 py-3">
                      {item.minCapacity}-{item.maxCapacity}
                    </td>
                    <td className="px-3 py-3">{item.isActive ? "Activa" : "Inactiva"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </section>
  );
}
