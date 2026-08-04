import { cn } from "../lib/cn.js";

export interface CardProps {
  className?: string;
  children: React.ReactNode;
}

/** Rounded white/dark surface on top of the page background — the base container for tables, forms, and metric groups. */
export function Card({ className, children }: CardProps) {
  return (
    <div className={cn("k-rounded-2xl k-border k-border-border k-bg-card k-text-card-foreground k-p-6", className)}>
      {children}
    </div>
  );
}
