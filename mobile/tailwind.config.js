/**
 * The Pets theme as NativeWind / Tailwind v3 utilities. The values come from
 * `@pets/core/native-theme` (generated from the shared token source), so the
 * native app and the web read the same palette.
 *
 * @type {import('tailwindcss').Config}
 */
const fs = require("fs");

// native-theme.ts is TypeScript, which this config cannot require: read its two
// object literals (plain JSON, generated) straight from the file.
const source = fs.readFileSync(require.resolve("@pets/core/native-theme"), "utf8");
const literal = (name) =>
  JSON.parse(new RegExp(`export const ${name} = (\\{[\\s\\S]*?\\}) as const`).exec(source)[1]);
const c = literal("colors");
const radius = literal("radius");

module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: c.background,
        foreground: c.foreground,
        card: { DEFAULT: c.card, foreground: c["card-foreground"] },
        primary: { DEFAULT: c.primary, foreground: c["primary-foreground"] },
        secondary: { DEFAULT: c.secondary, foreground: c["secondary-foreground"] },
        muted: { DEFAULT: c.muted, foreground: c["muted-foreground"] },
        accent: { DEFAULT: c.accent, foreground: c["accent-foreground"] },
        destructive: { DEFAULT: c.destructive, foreground: c["destructive-foreground"] },
        border: c.border,
        input: c.input,
        ring: c.ring,
        ok: { DEFAULT: c.ok, tint: c["ok-tint"] },
        soon: { DEFAULT: c.soon, tint: c["soon-tint"] },
        late: { DEFAULT: c.late, tint: c["late-tint"] },
      },
      borderRadius: {
        sm: `${radius.sm}px`,
        md: `${radius.md}px`,
        lg: `${radius.lg}px`,
        xl: `${radius.xl}px`,
      },
    },
  },
  plugins: [],
};
