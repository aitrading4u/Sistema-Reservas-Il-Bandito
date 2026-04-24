import { Card } from "@/components/ui/card";

interface OccupancyCardProps {
  title: string;
  occupied: number;
  capacity: number;
}

export function OccupancyCard({ title, occupied, capacity }: OccupancyCardProps) {
  const percentage = Math.min(100, Math.round((occupied / Math.max(1, capacity)) * 100));
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{percentage}%</p>
      <div className="mt-3 h-2 rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {occupied} cubiertos ocupados de {capacity}
      </p>
    </Card>
  );
}
