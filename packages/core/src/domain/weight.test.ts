import { describe, expect, it } from "vitest";

import { sparkline, timeBetween, weightChange } from "./weight";

describe("the change of weight", () => {
  it("is the latest weighing minus the one before, with the time between", () => {
    expect(
      weightChange([
        { date: "2026-11-06", kg: 8.4 },
        { date: "2026-08-01", kg: 8.1 },
      ]),
    ).toBe("+0,3 kg em 3 meses");
    expect(
      weightChange([
        { date: "2026-10-25", kg: 4.0 },
        { date: "2026-11-06", kg: 3.8 },
      ]),
    ).toBe("−0,2 kg em 12 dias");
  });

  it("needs two weighings", () => {
    expect(weightChange([{ date: "2026-11-06", kg: 8.4 }])).toBeNull();
    expect(weightChange([])).toBeNull();
  });

  it("says the time in days, months or years", () => {
    expect(timeBetween("2026-11-05", "2026-11-06")).toBe("1 dia");
    expect(timeBetween("2026-10-06", "2026-11-06")).toBe("1 mês");
    expect(timeBetween("2025-11-06", "2026-11-06")).toBe("1 ano");
    expect(timeBetween("2023-03-01", "2026-02-28")).toBe("2 anos");
  });
});

describe("the curve of the weights", () => {
  it("runs from the first weighing to the latest, the latest highest when it is heaviest", () => {
    const curve = sparkline(
      [
        { date: "2026-08-01", kg: 8.1 },
        { date: "2026-05-01", kg: 7.9 },
        { date: "2026-11-06", kg: 8.4 },
      ],
      160,
      56,
    )!;
    expect(curve.line.startsWith("M6,50")).toBe(true);
    expect(curve.last).toEqual({ x: 154, y: 6 });
    expect(curve.area.endsWith("L154,56 L6,56 Z")).toBe(true);
  });

  it("is not drawn for one weighing", () => {
    expect(sparkline([{ date: "2026-11-06", kg: 8.4 }], 160, 56)).toBeNull();
  });
});
