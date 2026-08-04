import { cn } from "../lib/cn.js";

export interface AvatarProps {
  name?: string | null;
  src?: string | null;
  className?: string;
  size?: number;
}

function initialsFromName(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Avatar({ name, src, className, size = 32 }: AvatarProps) {
  const style = { width: size, height: size };

  if (src) {
    // Plain <img>, not next/image — this package doesn't depend on Next.js.
    return <img src={src} alt={name ?? "avatar"} style={style} className={cn("k-rounded-full k-object-cover", className)} />;
  }

  return (
    <div
      style={style}
      className={cn(
        "k-flex k-items-center k-justify-center k-rounded-full k-bg-muted k-text-muted-foreground k-text-xs k-font-medium",
        className,
      )}
    >
      {initialsFromName(name)}
    </div>
  );
}
