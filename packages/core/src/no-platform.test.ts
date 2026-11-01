import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = new URL(".", import.meta.url).pathname;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "generated" ? [] : sources(path);
    return name.endsWith(".ts") && !name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("the shared package", () => {
  it("imports no platform and reads no DOM", () => {
    for (const file of sources(root)) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/from ["'](react-native|expo|react-dom)([/"'-])/);
      expect(text, file).not.toMatch(/\b(document|window|localStorage)\./);
    }
  });
});
