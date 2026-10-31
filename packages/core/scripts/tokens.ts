/** Write (or, with --check, verify) the generated theme files. */
import { readFileSync, writeFileSync } from "node:fs";

import { nativeTheme, themeCss } from "../src/tokens/generate.ts";

const dir = new URL("../src/generated/", import.meta.url);
const outputs: [string, string][] = [
  ["theme.css", themeCss()],
  ["native-theme.ts", nativeTheme()],
];
const check = process.argv.includes("--check");
let stale = false;
for (const [name, content] of outputs) {
  const file = new URL(name, dir);
  if (check) {
    let current = "";
    try {
      current = readFileSync(file, "utf8");
    } catch {
      // missing counts as stale
    }
    if (current !== content) {
      console.error(`${name} is stale: run pnpm --filter @pets/core generate:tokens`);
      stale = true;
    }
  } else {
    writeFileSync(file, content);
  }
}
if (stale) process.exit(1);
