import type { CSSProperties } from "react";

/**
 * Mirrors the :root / prefers-color-scheme values in app/globals.css. Kept
 * here (not derived from the CSS file) so a forced light/dark theme can be
 * expressed as inline style overrides on a wrapper element — inherited CSS
 * custom properties set closer to the DOM tree win over :root, regardless
 * of what prefers-color-scheme says, with no extra CSS rules needed.
 */
const LIGHT_VARS = {
  "--k-background": "225 22% 96%",
  "--k-foreground": "230 23% 15%",
  "--k-border": "225 18% 88%",
  "--k-card": "0 0% 100%",
  "--k-card-foreground": "230 23% 15%",
  "--k-muted": "225 20% 94%",
  "--k-muted-foreground": "225 10% 45%",
};

const DARK_VARS = {
  "--k-background": "228 28% 10%",
  "--k-foreground": "225 20% 92%",
  "--k-border": "225 20% 20%",
  "--k-card": "228 24% 13%",
  "--k-card-foreground": "225 20% 92%",
  "--k-muted": "228 20% 16%",
  "--k-muted-foreground": "225 12% 60%",
};

/** #rrggbb -> "H S% L%", the bare-triplet format --k-primary expects (consumed as hsl(var(--k-primary))). */
export function hexToHslTriplet(hex: string): string | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) return null;
  const r = parseInt(match[1]!.slice(0, 2), 16) / 255;
  const g = parseInt(match[1]!.slice(2, 4), 16) / 255;
  const b = parseInt(match[1]!.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return `0 0% ${Math.round(l * 100)}%`;

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  h *= 60;

  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function buildThemeStyle(theme: "light" | "dark" | "system", buttonColor: string | null): CSSProperties {
  const vars: Record<string, string> = {};
  if (theme === "light") Object.assign(vars, LIGHT_VARS);
  if (theme === "dark") Object.assign(vars, DARK_VARS);
  if (buttonColor) {
    const triplet = hexToHslTriplet(buttonColor);
    if (triplet) vars["--k-primary"] = triplet;
  }
  return vars as CSSProperties;
}
