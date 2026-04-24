import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-2xl border border-border/80 bg-card/95 text-card-foreground shadow-soft", className)}
      {...props}
    />
  );
}
