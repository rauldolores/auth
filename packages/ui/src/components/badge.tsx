import { cn } from "../lib/cn.js";

export type BadgeVariant = "success" | "danger" | "warning" | "neutral" | "primary";

export interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: "k-bg-success/15 k-text-success",
  danger: "k-bg-destructive/15 k-text-destructive",
  warning: "k-bg-warning/15 k-text-warning",
  neutral: "k-bg-muted k-text-muted-foreground",
  primary: "k-bg-primary/15 k-text-primary",
};

/** Pill-shaped status badge — matches the "Modernist" design system's rounded status chips. */
export function Badge({ variant = "neutral", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "k-inline-flex k-items-center k-rounded-full k-px-2.5 k-py-0.5 k-text-[11.5px] k-font-semibold",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
