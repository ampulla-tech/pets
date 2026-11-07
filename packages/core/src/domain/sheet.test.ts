import { describe, expect, it } from "vitest";

import { sheetCloses, sheetOffset } from "./sheet";

describe("dragging a sheet by its handle", () => {
  it("follows the finger down and resists up", () => {
    expect(sheetOffset(120)).toBe(120);
    expect(sheetOffset(0)).toBe(0);
    expect(sheetOffset(-100)).toBe(-20);
  });

  it("closes past a quarter of its height or on a flick down", () => {
    expect(sheetCloses(110, 0.1, 400)).toBe(true);
    expect(sheetCloses(90, 0.1, 400)).toBe(false);
    expect(sheetCloses(30, 0.8, 400)).toBe(true);
  });

  it("never closes when let go above where it rests", () => {
    expect(sheetCloses(-40, 2, 400)).toBe(false);
    expect(sheetCloses(0, 2, 400)).toBe(false);
  });
});
