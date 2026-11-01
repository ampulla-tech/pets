/**
 * The theme's source. The generator (scripts/tokens.ts) writes the web theme
 * (Tailwind v4 variables with the names shadcn/ui reads) and the same values
 * for the native app. Hex everywhere: React Native reads no OKLCH.
 */

export const colors = {
  background: "#fbfaf7",
  foreground: "#1d1b16",
  card: "#ffffff",
  "card-foreground": "#1d1b16",
  popover: "#ffffff",
  "popover-foreground": "#1d1b16",
  primary: "#2f6b57",
  "primary-foreground": "#ffffff",
  secondary: "#efece4",
  "secondary-foreground": "#1d1b16",
  muted: "#f1eee7",
  "muted-foreground": "#6b665b",
  accent: "#e7f0ec",
  "accent-foreground": "#1f4a3c",
  destructive: "#c2410c",
  "destructive-foreground": "#ffffff",
  border: "#e4dfd4",
  input: "#d9d3c6",
  ring: "#2f6b57",
  // The badge tones: up to date, due soon, overdue.
  ok: "#2f6b57",
  "ok-tint": "#e3efe9",
  soon: "#9a6700",
  "soon-tint": "#fbf0d4",
  late: "#b42318",
  "late-tint": "#fde7e4",
} as const;

export const radius = { sm: 6, md: 8, lg: 12, xl: 16 } as const;

export type ColorName = keyof typeof colors;
