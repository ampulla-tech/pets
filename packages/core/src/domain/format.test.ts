import { describe, expect, it } from "vitest";

import {
  badgeText,
  formatAge,
  formatBirth,
  formatDate,
  formatKg,
  formatMonth,
  parseDate,
  parseKg,
  reminderText,
  todayIso,
} from "./format";

describe("ages", () => {
  it("say what is known, approximate when it is", () => {
    expect(formatAge({ years: 2, months: 3, approximate: false })).toBe(
      "2 anos e 3 meses",
    );
    expect(formatAge({ years: 1, months: 7, approximate: true })).toBe(
      "cerca de 1 ano e 7 meses",
    );
    expect(formatAge({ years: 4, months: null, approximate: true })).toBe(
      "cerca de 4 anos",
    );
    expect(formatAge({ years: 0, months: 1, approximate: false })).toBe("1 mês");
    expect(formatAge({ years: 0, months: 0, approximate: false })).toBe("menos de 1 mês");
    expect(formatAge(null)).toBeNull();
  });
});

describe("dates", () => {
  it("are written and read the Brazilian way", () => {
    expect(formatDate("2026-11-06")).toBe("06/11/2026");
    expect(parseDate("06/11/2026")).toBe("2026-11-06");
    expect(parseDate("6/11/26")).toBe("2026-11-06");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("2026-11-06")).toBe("2026-11-06");
    expect(formatMonth("2027-09")).toBe("09/2027");
    expect(todayIso(new Date("2026-10-31T23:30:00-03:00"))).toBe("2026-10-31");
  });

  it("say a coarse birth as approximate", () => {
    expect(formatBirth({ precision: "month", value: "2025-03" })).toBe(
      "março de 2025 (aproximado)",
    );
    expect(formatBirth({ precision: "year", value: "2022" })).toBe("2022 (aproximado)");
    expect(formatBirth({ precision: "unknown", value: null })).toBe("Desconhecido");
  });
});

describe("badges and reminders", () => {
  it("say the state of an animal at a glance", () => {
    expect(badgeText({ state: "overdue", days: null })).toEqual({
      text: "Atrasado",
      tone: "late",
    });
    expect(badgeText({ state: "due_soon", days: 6 })).toEqual({
      text: "Vence em 6 dias",
      tone: "soon",
    });
    expect(badgeText({ state: "due_soon", days: 0 })?.text).toBe("Vence hoje");
    expect(badgeText({ state: "up_to_date", days: null })?.text).toBe("Em dia");
    expect(badgeText({ state: "none", days: null })).toBeNull();
  });

  it("say how far a reminder is", () => {
    expect(reminderText({ state: "upcoming", days: 6, due_on: "2026-11-06" })).toBe(
      "Vence em 6 dias",
    );
    expect(reminderText({ state: "overdue", days: -8, due_on: "2026-10-23" })).toBe(
      "Atrasado há 8 dias",
    );
    expect(reminderText({ state: "no_date", days: null, due_on: null })).toMatch(
      /Sem data/,
    );
  });
});

describe("weights", () => {
  it("are read with a comma and written with one", () => {
    expect(parseKg("4,9")).toBe("4.9");
    expect(parseKg("0")).toBeNull();
    expect(formatKg("4.285")).toBe("4,285 kg");
  });
});
