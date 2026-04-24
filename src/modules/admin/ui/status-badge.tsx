import { cn } from "@/lib/utils/cn";
import type { AdminReservationStatus } from "@/modules/admin/domain/admin.types";

const statusMap: Record<AdminReservationStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Confirmada", className: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Cancelada", className: "bg-zinc-200 text-zinc-700" },
  seated: { label: "Seated", className: "bg-blue-100 text-blue-700" },
  finished: { label: "Finalizada", className: "bg-indigo-100 text-indigo-700" },
  no_show: { label: "No-show", className: "bg-rose-100 text-rose-700" },
};

export function StatusBadge({ status }: { status: AdminReservationStatus }) {
  const config = statusMap[status];
  return (
    <span
      className={cn("inline-flex rounded-full px-2 py-1 text-xs font-medium", config.className)}
    >
      {config.label}
    </span>
  );
}
