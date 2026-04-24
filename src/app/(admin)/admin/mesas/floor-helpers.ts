import type { AdminFloorPlanTable } from "@/modules/admin/infrastructure/admin-api";

export type PlannerZone = "Interior" | "Terraza";

export interface PlannerTable {
  id: string;
  code: string;
  zone: PlannerZone;
  minPax: number;
  maxPax: number;
  x: number;
  y: number;
}

export function isLikelyServerTableId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function toPlanner(t: AdminFloorPlanTable): PlannerTable {
  return {
    id: t.id,
    code: t.table_code,
    zone: t.dining_area === "terraza" ? "Terraza" : "Interior",
    minPax: t.min_capacity,
    maxPax: t.max_capacity,
    x: t.plan_x ?? 100,
    y: t.plan_y ?? 100,
  };
}

export function toDiningArea(table: { code: string; zone: PlannerZone }): "sala" | "barra" | "terraza" {
  if (table.zone === "Terraza") return "terraza";
  if (table.code.toUpperCase().startsWith("B")) return "barra";
  return "sala";
}
