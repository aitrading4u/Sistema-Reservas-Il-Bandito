"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import { isDemoMode } from "@/lib/demo-mode";
import { floorTableInventory } from "@/modules/admin/data/admin.seed";
import {
  createAdminTable,
  deleteAdminTable,
  fetchAdminFloorPlan,
  type AdminFloorPlanTable,
  updateAdminFloorBar,
  updateAdminTable,
} from "@/modules/admin/infrastructure/admin-api";
import { SectionHeader } from "@/modules/admin/ui/section-header";

import { isLikelyServerTableId, toDiningArea, toPlanner, type PlannerTable, type PlannerZone } from "./floor-helpers";

type FloorView = "salaBarra" | "terraza";

interface PlannerBar {
  x: number;
  y: number;
  width: number;
  height: number;
}

const STORAGE_TABLES = "ilbandito.demo.planner.tables.v3";
const STORAGE_BAR = "ilbandito.demo.planner.bar.v1";

const TABLE_SIZE = 56; // h-14 w-14
const TABLE_HALF = TABLE_SIZE / 2;

function codeSortKey(code: string) {
  const n = parseInt(code.replace(/^\D+/, ""), 10);
  return Number.isNaN(n) ? 0 : n;
}

function sortTablesInCategory(tables: PlannerTable[]) {
  return [...tables].sort((a, b) => codeSortKey(a.code) - codeSortKey(b.code) || a.code.localeCompare(b.code));
}

function normalizePlannerTable(raw: unknown): PlannerTable | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.code !== "string") return null;
  const x = typeof o.x === "number" ? o.x : 0;
  const y = typeof o.y === "number" ? o.y : 0;
  const zone: "Interior" | "Terraza" = o.zone === "Terraza" ? "Terraza" : "Interior";
  let minPax = 1;
  let maxPax = 4;
  if (typeof o.minPax === "number" && typeof o.maxPax === "number") {
    minPax = Math.max(1, Math.min(99, o.minPax));
    maxPax = Math.max(1, Math.min(99, o.maxPax));
  } else if (typeof (o as { seats?: number }).seats === "number") {
    const s = (o as { seats: number }).seats;
    maxPax = Math.max(1, Math.min(99, s));
    minPax = Math.min(2, maxPax);
  }
  if (minPax > maxPax) {
    [minPax, maxPax] = [maxPax, minPax];
  }
  return { id: o.id, code: o.code.trim() || o.code, zone, minPax, maxPax, x, y };
}

function loadPlannerTablesFromStorage(): PlannerTable[] {
  if (typeof window === "undefined") return defaultPlannerTables();
  const stored = window.localStorage.getItem(STORAGE_TABLES);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed)) {
        const tables = parsed.map(normalizePlannerTable).filter((t): t is PlannerTable => t !== null);
        if (tables.length > 0) return tables;
      }
    } catch {
      /* fall through */
    }
  }
  const legacy = window.localStorage.getItem("ilbandito.demo.planner.tables.v2");
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as unknown;
      if (Array.isArray(parsed)) {
        const tables = parsed.map(normalizePlannerTable).filter((t): t is PlannerTable => t !== null);
        if (tables.length > 0) return tables;
      }
    } catch {
      /* fall through */
    }
  }
  return defaultPlannerTables();
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
      minPax: 2,
      maxPax: 4,
      x: 48 + col * 100,
      y: 48 + row * 95,
    });
  }
  floorTableInventory.barra.forEach((code, i) => {
    out.push({
      id: `planner-${code}`,
      code,
      zone: "Interior",
      minPax: 1,
      maxPax: 2,
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
      minPax: 2,
      maxPax: 4,
      x: 48 + col * 98,
      y: 52 + row * 92,
    });
  }
  return out;
}

function tablesByCategory(tables: PlannerTable[]) {
  const sala: PlannerTable[] = [];
  const barra: PlannerTable[] = [];
  const terraza: PlannerTable[] = [];
  for (const t of tables) {
    const c = t.code.toUpperCase();
    if (c.startsWith("S")) sala.push(t);
    else if (c.startsWith("B")) barra.push(t);
    else if (c.startsWith("T")) terraza.push(t);
    else sala.push(t);
  }
  return {
    sala: sortTablesInCategory(sala),
    barra: sortTablesInCategory(barra),
    terraza: sortTablesInCategory(terraza),
  };
}

const DEFAULT_BAR: PlannerBar = { x: 500, y: 180, width: 150, height: 76 };

export default function AdminMesasPage() {
  const isDemo = isDemoMode();
  const canvasRef = useRef<HTMLDivElement>(null);
  const plannerTablesRef = useRef<PlannerTable[]>([]);
  const plannerBarRef = useRef<PlannerBar>(DEFAULT_BAR);
  const lastDragTablePos = useRef<{ id: string; x: number; y: number } | null>(null);
  const lastBarLayout = useRef<PlannerBar | null>(null);
  const persistDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [floorView, setFloorView] = useState<FloorView>("salaBarra");
  const [plannerTables, setPlannerTables] = useState<PlannerTable[]>(() => (isDemo ? loadPlannerTablesFromStorage() : []));
  const [planLoading, setPlanLoading] = useState(!isDemo);
  const [planError, setPlanError] = useState("");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [plannerBar, setPlannerBar] = useState<PlannerBar>(() => {
    if (typeof window === "undefined" || !isDemo) {
      return DEFAULT_BAR;
    }
    const stored = window.localStorage.getItem(STORAGE_BAR);
    if (!stored) return DEFAULT_BAR;
    try {
      return JSON.parse(stored) as PlannerBar;
    } catch {
      return DEFAULT_BAR;
    }
  });
  const [dragState, setDragState] = useState<
    { type: "table"; id: string; zone: "Interior" | "Terraza" } | { type: "bar" } | null
  >(null);

  useEffect(() => {
    plannerTablesRef.current = plannerTables;
  }, [plannerTables]);

  useEffect(() => {
    plannerBarRef.current = plannerBar;
  }, [plannerBar]);

  useEffect(() => {
    if (typeof window === "undefined" || !isDemo) return;
    window.localStorage.setItem(STORAGE_TABLES, JSON.stringify(plannerTables));
  }, [plannerTables, isDemo]);

  useEffect(() => {
    if (typeof window === "undefined" || !isDemo) return;
    window.localStorage.setItem(STORAGE_BAR, JSON.stringify(plannerBar));
  }, [plannerBar, isDemo]);

  useEffect(() => {
    if (isDemo) {
      setPlanLoading(false);
      return;
    }
    setPlanLoading(true);
    setPlanError("");
    void fetchAdminFloorPlan()
      .then((data) => {
        if (data.tables && data.tables.length > 0) {
          setPlannerTables((data.tables as AdminFloorPlanTable[]).map((t) => toPlanner(t)));
          if (data.floorBar) {
            const b = data.floorBar;
            if (
              typeof b.x === "number" &&
              typeof b.y === "number" &&
              typeof b.width === "number" &&
              typeof b.height === "number"
            ) {
              setPlannerBar({ x: b.x, y: b.y, width: b.width, height: b.height });
            }
          }
        } else {
          setPlannerTables([]);
        }
      })
      .catch((e: unknown) => {
        setPlanError(e instanceof Error ? e.message : "No se pudo cargar el plano");
      })
      .finally(() => {
        setPlanLoading(false);
      });
  }, [isDemo]);

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
  const listGroups = useMemo(() => tablesByCategory(plannerTables), [plannerTables]);

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
      setPlannerBar((prev) => {
        const next = { ...prev, x: position.x, y: position.y };
        lastBarLayout.current = next;
        return next;
      });
      return;
    }
    setPlannerTables((prev) =>
      prev.map((table) => {
        if (table.id !== dragState.id || table.zone !== dragState.zone) return table;
        const next = { ...table, x: position.x, y: position.y };
        lastDragTablePos.current = { id: next.id, x: next.x, y: next.y };
        return next;
      }),
    );
  }

  function handleCanvasPointerUp() {
    if (!isDemo) {
      if (dragState?.type === "bar" && lastBarLayout.current) {
        void updateAdminFloorBar(lastBarLayout.current);
      } else if (dragState?.type === "table" && lastDragTablePos.current) {
        const p = lastDragTablePos.current;
        if (isLikelyServerTableId(p.id)) {
          void updateAdminTable(p.id, { plan_x: p.x, plan_y: p.y });
        }
      }
    }
    lastBarLayout.current = null;
    lastDragTablePos.current = null;
    setDragState(null);
  }

  function moveSelected(dx: number, dy: number) {
    if (!selectedTableId) return;
    const { maxX, maxY } = getCanvasClamp();
    setPlannerTables((prev) => {
      return prev.map((table) => {
        if (table.id !== selectedTableId) return table;
        const x = clamp(table.x + dx, 10, maxX - 10);
        const y = clamp(table.y + dy, 10, maxY - 10);
        if (!isDemo && isLikelyServerTableId(table.id)) {
          queueMicrotask(() => {
            void updateAdminTable(table.id, { plan_x: x, plan_y: y });
          });
        }
        return { ...table, x, y };
      });
    });
  }

  function moveBar(dx: number, dy: number) {
    const { maxX, maxY } = getCanvasClamp();
    setPlannerBar((prev) => {
      const next = {
        ...prev,
        x: clamp(prev.x + dx, 10, maxX - 10),
        y: clamp(prev.y + dy, 10, maxY - 10),
      };
      if (!isDemo) {
        queueMicrotask(() => {
          void updateAdminFloorBar(next);
        });
      }
      return next;
    });
  }

  function updateSelectedZone(zone: "Interior" | "Terraza") {
    if (!selectedTableId) return;
    setPlannerTables((prev) => {
      return prev.map((table) => {
        if (table.id !== selectedTableId) return table;
        const merged: PlannerTable = { ...table, zone };
        if (!isDemo && isLikelyServerTableId(merged.id)) {
          void updateAdminTable(merged.id, { dining_area: toDiningArea(merged) });
        }
        return merged;
      });
    });
  }

  function codeTakenByOther(id: string, code: string) {
    const t = code.trim();
    if (!t) return true;
    return plannerTables.some(
      (row) => row.id !== id && row.code.trim().toLowerCase() === t.toLowerCase(),
    );
  }

  function schedulePersistToServer(merged: PlannerTable) {
    if (isDemo || !isLikelyServerTableId(merged.id)) return;
    if (persistDebounce.current) clearTimeout(persistDebounce.current);
    const snapshot = { ...merged };
    persistDebounce.current = setTimeout(() => {
      const d = toDiningArea(snapshot);
      void updateAdminTable(snapshot.id, {
        table_code: snapshot.code,
        min_capacity: snapshot.minPax,
        max_capacity: snapshot.maxPax,
        dining_area: d,
        plan_x: snapshot.x,
        plan_y: snapshot.y,
      });
    }, 500);
  }

  function patchTable(
    id: string,
    patch: Partial<Pick<PlannerTable, "code" | "minPax" | "maxPax" | "zone" | "x" | "y">>,
  ) {
    setPlannerTables((prev) => {
      const next = prev.map((row) => {
        if (row.id !== id) return row;
        if (patch.code !== undefined) {
          const c = patch.code.trim();
          if (!c) return row;
          if (prev.some((r) => r.id !== id && r.code.trim().toLowerCase() === c.toLowerCase())) {
            return row;
          }
        }
        let code = patch.code !== undefined ? patch.code.trim() : row.code;
        let minPax = row.minPax;
        let maxPax = row.maxPax;
        if (patch.minPax !== undefined || patch.maxPax !== undefined) {
          minPax = Math.max(1, Math.min(99, patch.minPax ?? row.minPax));
          maxPax = Math.max(1, Math.min(99, patch.maxPax ?? row.maxPax));
          if (minPax > maxPax) {
            const swap = minPax;
            minPax = maxPax;
            maxPax = swap;
          }
        }
        const zone = patch.zone ?? row.zone;
        const x = patch.x ?? row.x;
        const y = patch.y ?? row.y;
        return { ...row, code, minPax, maxPax, zone, x, y };
      });
      const merged = next.find((r) => r.id === id);
      if (merged) {
        schedulePersistToServer(merged);
      }
      return next;
    });
  }

  async function deleteTable(id: string) {
    if (!isDemo && isLikelyServerTableId(id)) {
      try {
        await deleteAdminTable(id);
      } catch (e) {
        setPlanError(e instanceof Error ? e.message : "No se pudo eliminar");
        return;
      }
    }
    setPlannerTables((prev) => prev.filter((row) => row.id !== id));
    setSelectedTableId((current) => (current === id ? null : current));
  }

  async function addTable(kind: "sala" | "barra" | "terraza") {
    const prefix = kind === "sala" ? "S" : kind === "barra" ? "B" : "T";
    const nums = plannerTables
      .filter((t) => t.code.toUpperCase().startsWith(prefix))
      .map((t) => parseInt(t.code.slice(prefix.length), 10))
      .filter((n) => !Number.isNaN(n));
    const nextN = (nums.length ? Math.max(...nums) : 0) + 1;
    const code = `${prefix}${nextN}`;
    if (codeTakenByOther("", code)) {
      return;
    }
    const zone: PlannerZone = kind === "terraza" ? "Terraza" : "Interior";
    const minPax = kind === "barra" ? 1 : 2;
    const maxPax = kind === "barra" ? 2 : 4;
    if (isDemo) {
      const newId = `planner-${code}-${Date.now()}`;
      setPlannerTables((prev) => [
        ...prev,
        { id: newId, code, zone, minPax, maxPax, x: 100, y: 100 },
      ]);
      setSelectedTableId(newId);
      setFloorView(kind === "terraza" ? "terraza" : "salaBarra");
      return;
    }
    setPlanError("");
    try {
      const d = toDiningArea({ code, zone });
      const { table } = await createAdminTable({
        table_code: code,
        min_capacity: minPax,
        max_capacity: maxPax,
        dining_area: d,
        plan_x: 100,
        plan_y: 100,
      });
      if (table) {
        setPlannerTables((prev) => [...prev, toPlanner(table)]);
        setSelectedTableId(table.id);
        setFloorView(kind === "terraza" ? "terraza" : "salaBarra");
      }
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : "No se pudo crear la mesa");
    }
  }

  async function seedFromTemplate() {
    setPlanError("");
    setPlanLoading(true);
    try {
      for (const row of defaultPlannerTables()) {
        const d = toDiningArea({ code: row.code, zone: row.zone });
        await createAdminTable({
          table_code: row.code,
          min_capacity: row.minPax,
          max_capacity: row.maxPax,
          dining_area: d,
          plan_x: row.x,
          plan_y: row.y,
        });
      }
      const data = await fetchAdminFloorPlan();
      if (data.tables && data.tables.length > 0) {
        setPlannerTables((data.tables as AdminFloorPlanTable[]).map((t) => toPlanner(t)));
      }
      if (data.floorBar) {
        const b = data.floorBar;
        if (
          typeof b.x === "number" &&
          typeof b.y === "number" &&
          typeof b.width === "number" &&
          typeof b.height === "number"
        ) {
          setPlannerBar({ x: b.x, y: b.y, width: b.width, height: b.height });
        }
      } else {
        setPlannerBar(DEFAULT_BAR);
        await updateAdminFloorBar(DEFAULT_BAR);
      }
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : "Error al crear la plantilla");
    } finally {
      setPlanLoading(false);
    }
  }

  const showDbEmptyCta = !isDemo && !planLoading && plannerTables.length === 0 && !planError;

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Mesas"
        description={
          isDemo
            ? "Modo demostración: el plano se guarda solo en este navegador."
            : "Plano y mesas reales (Supabase). Misma lógica que usaran los clientes al reservar."
        }
      />

      {isDemo ? (
        <p className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
          Tienes <code className="text-xs">NEXT_PUBLIC_DEMO_MODE=true</code> en .env. Para entorno real, ponlo en
          <code className="text-xs"> false</code> o bórralo, aplica las migraciones SQL y vuelve a desplegar.
        </p>
      ) : (
        <p className="rounded-xl border border-border/80 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Datos en Supabase. Confirma que la migración <code className="text-xs">20260428_tables_dining_floor.sql</code> esté
          aplicada en el proyecto.
        </p>
      )}

      {planError && !showDbEmptyCta ? (
        <p className="text-sm text-destructive" role="alert">
          {planError}
        </p>
      ) : null}

      {showDbEmptyCta ? (
        <Card className="space-y-3 p-4">
          <p className="text-sm">No hay mesas creadas en la base de datos para este restaurante.</p>
          <Button type="button" onClick={() => void seedFromTemplate()}>
            Crear plantilla inicial (S, B, T según il Bandito)
          </Button>
        </Card>
      ) : null}

      {planLoading && !isDemo ? (
        <p className="text-sm text-muted-foreground">Cargando plano y mesas…</p>
      ) : null}

      {showDbEmptyCta ? null : (
        <>
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
          onPointerUp={handleCanvasPointerUp}
          onPointerLeave={handleCanvasPointerUp}
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
                  title={table.code}
                  className={cn(
                    "absolute z-[2] flex h-14 w-14 cursor-grab items-center justify-center rounded-full border-2 px-0.5 text-center text-[10px] font-semibold leading-tight transition",
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
                  <span className="line-clamp-2 break-words">{table.code}</span>
                </button>
              ))}
            </>
          ) : (
            terrazaTables.map((table) => (
              <button
                key={table.id}
                type="button"
                data-table-id={table.id}
                title={table.code}
                className={cn(
                  "absolute z-[2] flex h-14 w-14 cursor-grab items-center justify-center rounded-full border-2 px-0.5 text-center text-[10px] font-semibold leading-tight transition",
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
                <span className="line-clamp-2 break-words">{table.code}</span>
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
                  {selectedTable.zone === "Interior" ? "Sala/Barra" : "Terraza"} · {selectedTable.minPax}–
                  {selectedTable.maxPax} comensales
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="sel-name" className="text-xs">Nombre en plano</Label>
                    <Input
                      id="sel-name"
                      value={selectedTable.code}
                      onChange={(e) => patchTable(selectedTable.id, { code: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="sel-min" className="text-xs">Min.</Label>
                      <Input
                        id="sel-min"
                        type="number"
                        min={1}
                        max={99}
                        value={selectedTable.minPax}
                        onChange={(e) =>
                          patchTable(selectedTable.id, { minPax: Number(e.target.value || 1) })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="sel-max" className="text-xs">Max.</Label>
                      <Input
                        id="sel-max"
                        type="number"
                        min={1}
                        max={99}
                        value={selectedTable.maxPax}
                        onChange={(e) =>
                          patchTable(selectedTable.id, { maxPax: Number(e.target.value || 1) })
                        }
                      />
                    </div>
                  </div>
                </div>
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
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full text-primary hover:bg-primary/10"
                  onClick={() => {
                    if (window.confirm("¿Eliminar esta mesa del plano?")) {
                      void deleteTable(selectedTable.id);
                    }
                  }}
                >
                  Eliminar mesa
                </Button>
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
                    onChange={(event) => {
                      setPlannerBar((prev) => {
                        const next = {
                          ...prev,
                          width: clamp(Number(event.target.value || 100), 70, 280),
                        };
                        if (!isDemo) void updateAdminFloorBar(next);
                        return next;
                      });
                    }}
                  />
                </div>
                <div>
                  <span className="text-xs font-medium">Alto barra</span>
                  <Input
                    type="number"
                    value={plannerBar.height}
                    onChange={(event) => {
                      setPlannerBar((prev) => {
                        const next = {
                          ...prev,
                          height: clamp(Number(event.target.value || 60), 45, 200),
                        };
                        if (!isDemo) void updateAdminFloorBar(next);
                        return next;
                      });
                    }}
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
        <h2 className="mb-2 text-lg font-semibold">Todas las mesas</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Lista vertical: edita el nombre, el aforo (min.–máx.) o elimina. El nombre no puede repetirse.
        </p>
        <div className="max-h-[min(70vh,720px)] space-y-6 overflow-y-auto pr-1">
          {([
            { key: "sala" as const, label: "Sala" },
            { key: "barra" as const, label: "Barra" },
            { key: "terraza" as const, label: "Terraza" },
          ] as const).map(({ key, label }) => {
            const group = listGroups[key];
            if (group.length === 0) {
              return (
                <div key={key}>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">{label}</h3>
                  <p className="text-sm text-muted-foreground">No hay mesas en esta zona.</p>
                </div>
              );
            }
            return (
              <div key={key}>
                <h3 className="mb-3 text-sm font-semibold text-foreground">{label}</h3>
                <ul className="space-y-3">
                  {group.map((table) => (
                    <li
                      key={table.id}
                      className={cn(
                        "flex flex-col gap-3 rounded-xl border border-border/80 bg-card/50 p-3 sm:flex-row sm:items-end sm:justify-between",
                        selectedTableId === table.id && "ring-2 ring-primary/40",
                      )}
                    >
                      <div className="grid w-full min-w-0 flex-1 gap-3 sm:grid-cols-[1fr,auto,auto] sm:items-end">
                        <div className="space-y-1">
                          <Label className="text-xs" htmlFor={`name-${table.id}`}>
                            Nombre
                          </Label>
                          <Input
                            id={`name-${table.id}`}
                            value={table.code}
                            onChange={(e) => patchTable(table.id, { code: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:max-w-[200px]">
                          <div className="space-y-1">
                            <Label className="text-xs" htmlFor={`min-${table.id}`}>
                              Mín. pax
                            </Label>
                            <Input
                              id={`min-${table.id}`}
                              type="number"
                              min={1}
                              max={99}
                              className="min-w-0"
                              value={table.minPax}
                              onChange={(e) =>
                                patchTable(table.id, { minPax: Number(e.target.value || 1) })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs" htmlFor={`max-${table.id}`}>
                              Máx. pax
                            </Label>
                            <Input
                              id={`max-${table.id}`}
                              type="number"
                              min={1}
                              max={99}
                              className="min-w-0"
                              value={table.maxPax}
                              onChange={(e) =>
                                patchTable(table.id, { maxPax: Number(e.target.value || 1) })
                              }
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant={selectedTableId === table.id ? "default" : "secondary"}
                            onClick={() => {
                              setSelectedTableId(table.id);
                              setFloorView(table.zone === "Terraza" ? "terraza" : "salaBarra");
                            }}
                          >
                            Ver en plano
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="text-primary"
                            onClick={() => {
                              if (window.confirm("¿Eliminar esta mesa?")) {
                                void deleteTable(table.id);
                              }
                            }}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>
        </>
      )}
    </section>
  );
}
