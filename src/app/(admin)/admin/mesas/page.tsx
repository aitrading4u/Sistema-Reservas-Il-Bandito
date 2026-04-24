"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { floorTableInventory } from "@/modules/admin/data/admin.seed";
import { SectionHeader } from "@/modules/admin/ui/section-header";

type FloorView = "salaBarra" | "terraza";

interface PlannerTable {
  id: string;
  code: string;
  zone: "Interior" | "Terraza";
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

const STORAGE_TABLES = "ilbandito.demo.planner.tables.v2";
const STORAGE_BAR = "ilbandito.demo.planner.bar.v1";

const TABLE_SIZE = 56; // h-14 w-14
const TABLE_HALF = TABLE_SIZE / 2;

function sortCodesByNumber(codes: string[]) {
  return [...codes].sort((a, b) => {
    const na = parseInt(a.replace(/^\D+/, ""), 10);
    const nb = parseInt(b.replace(/^\D+/, ""), 10);
    return (Number.isNaN(na) ? 0 : na) - (Number.isNaN(nb) ? 0 : nb);
  });
}

function defaultPlannerTables(): PlannerTable[] {
  const out: PlannerTable[] = [];
  for (let i = 0; i < floorTableInventory.sala.length; i++) {
    const code = floorTableInventory.sala[i]!;
    const col = i % 4;
    const row = Math.floor(i / 4);
    out.push({
      id: `planner-${code}`,
      code,
      zone: "Interior",
      seats: 4,
      x: 48 + col * 100,
      y: 48 + row * 95,
    });
  }
  floorTableInventory.barra.forEach((code, i) => {
    out.push({
      id: `planner-${code}`,
      code,
      zone: "Interior",
      seats: 2,
      x: 48 + i * 92,
      y: 400,
    });
  });
  for (let i = 0; i < floorTableInventory.terraza.length; i++) {
    const code = floorTableInventory.terraza[i]!;
    const col = i % 5;
    const row = Math.floor(i / 5);
    out.push({
      id: `planner-${code}`,
      code,
      zone: "Terraza",
      seats: 4,
      x: 48 + col * 98,
      y: 52 + row * 92,
    });
  }
  return out;
}

function codesByCategory(tables: PlannerTable[]) {
  const sala: string[] = [];
  const barra: string[] = [];
  const terraza: string[] = [];
  for (const t of tables) {
    if (t.code.startsWith("S")) sala.push(t.code);
    else if (t.code.startsWith("B")) barra.push(t.code);
    else if (t.code.startsWith("T")) terraza.push(t.code);
  }
  return {
    sala: sortCodesByNumber(sala),
    barra: sortCodesByNumber(barra),
    terraza: sortCodesByNumber(terraza),
  };
}

export default function AdminMesasPage() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [floorView, setFloorView] = useState<FloorView>("salaBarra");
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
      return { x: 500, y: 180, width: 150, height: 76 };
    }
    const stored = window.localStorage.getItem(STORAGE_BAR);
    if (!stored) return { x: 500, y: 180, width: 150, height: 76 };
    try {
      return JSON.parse(stored) as PlannerBar;
    } catch {
      return { x: 500, y: 180, width: 150, height: 76 };
    }
  });
  const [dragState, setDragState] = useState<
    { type: "table"; id: string; zone: "Interior" | "Terraza" } | { type: "bar" } | null
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
  const interiorTables = useMemo(
    () => plannerTables.filter((table) => table.zone === "Interior"),
    [plannerTables],
  );
  const terrazaTables = useMemo(
    () => plannerTables.filter((table) => table.zone === "Terraza"),
    [plannerTables],
  );
  const visibleTables = floorView === "salaBarra" ? interiorTables : terrazaTables;
  const listGroups = useMemo(() => codesByCategory(plannerTables), [plannerTables]);

  function getCanvasClamp() {
    const el = canvasRef.current;
    if (!el) {
      return { maxX: 720, maxY: 500 };
    }
    const w = el.clientWidth;
    const h = el.clientHeight;
    return {
      maxX: Math.max(TABLE_SIZE, w - TABLE_SIZE + 8),
      maxY: Math.max(TABLE_SIZE, h - TABLE_SIZE + 8),
    };
  }

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
    const { maxX, maxY } = getCanvasClamp();
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp(event.clientX - bounds.left - TABLE_HALF, 10, maxX - 10),
      y: clamp(event.clientY - bounds.top - TABLE_HALF, 10, maxY - 10),
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
          ? { ...table, x: position.x, y: position.y }
          : table,
      ),
    );
  }

  function endDrag() {
    setDragState(null);
  }

  function moveSelected(dx: number, dy: number) {
    if (!selectedTableId) return;
    const { maxX, maxY } = getCanvasClamp();
    setPlannerTables((prev) =>
      prev.map((table) =>
        table.id === selectedTableId
          ? {
              ...table,
              x: clamp(table.x + dx, 10, maxX - 10),
              y: clamp(table.y + dy, 10, maxY - 10),
            }
          : table,
      ),
    );
  }

  function moveBar(dx: number, dy: number) {
    const { maxX, maxY } = getCanvasClamp();
    setPlannerBar((prev) => ({
      ...prev,
      x: clamp(prev.x + dx, 10, maxX - 10),
      y: clamp(prev.y + dy, 10, maxY - 10),
    }));
  }

  function updateSelectedZone(zone: "Interior" | "Terraza") {
    if (!selectedTableId) return;
    setPlannerTables((prev) =>
      prev.map((table) => (table.id === selectedTableId ? { ...table, zone } : table)),
    );
  }

  function addTable(kind: "sala" | "barra" | "terraza") {
    const prefix = kind === "sala" ? "S" : kind === "barra" ? "B" : "T";
    const nums = plannerTables
      .filter((t) => t.code.startsWith(prefix))
      .map((t) => parseInt(t.code.replace(/^\D+/, ""), 10))
      .filter((n) => !Number.isNaN(n));
    const nextN = (nums.length ? Math.max(...nums) : 0) + 1;
    const code = `${prefix}${nextN}`;
    const zone: "Interior" | "Terraza" = kind === "terraza" ? "Terraza" : "Interior";
    const newId = `planner-${code}-${Date.now()}`;
    setPlannerTables((prev) => [
      ...prev,
      {
        id: newId,
        code,
        zone,
        seats: kind === "barra" ? 2 : 4,
        x: 100,
        y: 100,
      },
    ]);
    setSelectedTableId(newId);
    setFloorView(kind === "terraza" ? "terraza" : "salaBarra");
  }

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Mesas"
        description="Un plano por vista: Sala y barra, o Terraza. Ajusta posiciones; la lista refleja todas las mesas."
      />

      <Card className="space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex w-full max-w-2xl gap-2 sm:w-auto">
            <Button
              type="button"
              variant={floorView === "salaBarra" ? "default" : "secondary"}
              className="flex-1"
              onClick={() => {
                setFloorView("salaBarra");
                setSelectedTableId(null);
              }}
            >
              Sala y barra
            </Button>
            <Button
              type="button"
              variant={floorView === "terraza" ? "default" : "secondary"}
              className="flex-1"
              onClick={() => {
                setFloorView("terraza");
                setSelectedTableId(null);
              }}
            >
              Terraza
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => addTable("sala")}>
              Añadir mesa sala
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => addTable("barra")}>
              Añadir mesa barra
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => addTable("terraza")}>
              Añadir mesa terraza
            </Button>
          </div>
        </div>

        <div
          ref={canvasRef}
          className="relative min-h-[min(60vh,560px)] w-full overflow-hidden rounded-2xl border border-border/80 bg-[#f7f2e7]"
          onClick={onCanvasClick}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
        >
          <div className="absolute left-3 top-3 z-10 rounded-lg bg-card/95 px-3 py-1.5 text-sm font-semibold text-muted-foreground shadow-sm">
            {floorView === "salaBarra" ? "Sala y barra" : "Terraza"}
          </div>
          {floorView === "salaBarra" ? (
            <>
              <div
                className="absolute z-[1] cursor-grab rounded-xl border-2 border-[#9c3f2e] bg-[#d3543f] text-sm font-semibold text-white shadow-sm"
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
                <div className="flex h-full items-center justify-center">BARRA</div>
              </div>
              {interiorTables.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  data-table-id={table.id}
                  className={cn(
                    "absolute z-[2] h-14 w-14 cursor-grab rounded-full border-2 text-xs font-semibold transition",
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
            </>
          ) : (
            terrazaTables.map((table) => (
              <button
                key={table.id}
                type="button"
                data-table-id={table.id}
                className={cn(
                  "absolute z-[2] h-14 w-14 cursor-grab rounded-full border-2 text-xs font-semibold transition",
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
            ))
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3 p-4">
            <h3 className="text-sm font-semibold">Mover mesa seleccionada</h3>
            {selectedTable && visibleTables.some((t) => t.id === selectedTableId) ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {selectedTable.code} · {selectedTable.zone === "Interior" ? "Sala/Barra" : "Terraza"} ·{" "}
                  {selectedTable.seats} pax
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => moveSelected(0, -12)}>Arriba</Button>
                  <Button size="sm" variant="secondary" onClick={() => moveSelected(0, 12)}>Abajo</Button>
                  <Button size="sm" variant="secondary" onClick={() => moveSelected(-12, 0)}>Izquierda</Button>
                  <Button size="sm" variant="secondary" onClick={() => moveSelected(12, 0)}>Derecha</Button>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium">Zona (plano)</span>
                  <select
                    className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
                    value={selectedTable.zone}
                    onChange={(event) => updateSelectedZone(event.target.value as "Interior" | "Terraza")}
                  >
                    <option value="Interior">Sala y barra</option>
                    <option value="Terraza">Terraza</option>
                  </select>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {floorView === "salaBarra"
                  ? "Pulsa una mesa o arrástrala en el plano de sala (incluye barra)."
                  : "Pulsa una mesa o arrástrala en el plano de terraza."}
              </p>
            )}
          </Card>

          {floorView === "salaBarra" ? (
            <Card className="space-y-3 p-4">
              <h3 className="text-sm font-semibold">Mover barra</h3>
              <p className="text-sm text-muted-foreground">
                Arrastra el bloque BARRA o ajústalo con los botones y el tamaño.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => moveBar(0, -12)}>Arriba</Button>
                <Button size="sm" variant="secondary" onClick={() => moveBar(0, 12)}>Abajo</Button>
                <Button size="sm" variant="secondary" onClick={() => moveBar(-12, 0)}>Izquierda</Button>
                <Button size="sm" variant="secondary" onClick={() => moveBar(12, 0)}>Derecha</Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs font-medium">Ancho barra</span>
                  <Input
                    type="number"
                    value={plannerBar.width}
                    onChange={(event) =>
                      setPlannerBar((prev) => ({
                        ...prev,
                        width: clamp(Number(event.target.value || 100), 70, 280),
                      }))
                    }
                  />
                </div>
                <div>
                  <span className="text-xs font-medium">Alto barra</span>
                  <Input
                    type="number"
                    value={plannerBar.height}
                    onChange={(event) =>
                      setPlannerBar((prev) => ({
                        ...prev,
                        height: clamp(Number(event.target.value || 60), 45, 200),
                      }))
                    }
                  />
                </div>
              </div>
            </Card>
          ) : (
            <Card className="space-y-2 p-4">
              <h3 className="text-sm font-semibold">Terraza</h3>
              <p className="text-sm text-muted-foreground">
                {listGroups.terraza.length} mesas en inventario.                 Usa el botón &quot;Sala y barra&quot; arriba para
                colocar la barra o mesas de sala.
              </p>
            </Card>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-4 text-lg font-semibold">Todas las mesas</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Sala</h3>
            <p className="text-sm leading-relaxed text-foreground">
              {listGroups.sala.length ? listGroups.sala.join(", ") : "—"}
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Barra</h3>
            <p className="text-sm leading-relaxed text-foreground">
              {listGroups.barra.length ? listGroups.barra.join(", ") : "—"}
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Terraza</h3>
            <p className="text-sm leading-relaxed text-foreground">
              {listGroups.terraza.length ? listGroups.terraza.join(", ") : "—"}
            </p>
          </div>
        </div>
      </Card>
    </section>
  );
}
