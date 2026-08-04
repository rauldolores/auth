/** Shared Tailwind preset consumed by apps/* and packages/ui. */
export const kontroliaTailwindPreset = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--k-border))",
        background: "hsl(var(--k-background))",
        foreground: "hsl(var(--k-foreground))",
        primary: {
          DEFAULT: "hsl(var(--k-primary))",
          foreground: "hsl(var(--k-primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--k-muted))",
          foreground: "hsl(var(--k-muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--k-destructive))",
          foreground: "hsl(var(--k-destructive-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--k-radius)",
        md: "calc(var(--k-radius) - 2px)",
        sm: "calc(var(--k-radius) - 4px)",
      },
    },
  },
};

export default kontroliaTailwindPreset;
