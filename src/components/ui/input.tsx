import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-xl border border-border/80 bg-card px-3.5 py-2 text-base shadow-sm placeholder:text-muted-foreground/90 transition-colors focus:border-primary/50 sm:text-sm",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
