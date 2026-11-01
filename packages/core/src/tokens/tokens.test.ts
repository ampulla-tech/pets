import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { nativeTheme, themeCss } from "./generate";

describe("the generated theme", () => {
  it("is what the token source produces now", () => {
    const dir = new URL("../generated/", import.meta.url);
    expect(readFileSync(new URL("theme.css", dir), "utf8")).toBe(themeCss());
    expect(readFileSync(new URL("native-theme.ts", dir), "utf8")).toBe(nativeTheme());
  });

  it("names the variables shadcn/ui reads", () => {
    expect(themeCss()).toContain("--color-primary: var(--primary);");
    expect(themeCss()).toContain("--color-muted-foreground: var(--muted-foreground);");
  });
});
