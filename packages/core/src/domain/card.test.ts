import { describe, expect, it } from "vitest";

import { doseBadge, ofAnimal } from "./card";

describe("the badge of a dose on the card", () => {
  const dose = { current: true, state: "due_soon" as const, due_in_days: 0 };

  it("is on a current dose due within 30 days or late", () => {
    expect(doseBadge(dose)).toEqual({ text: "Vence hoje", tone: "soon" });
    expect(doseBadge({ ...dose, due_in_days: 1 })?.text).toBe("Vence amanhã");
    expect(doseBadge({ ...dose, due_in_days: 12 })?.text).toBe("Vence em 12 dias");
    expect(doseBadge({ ...dose, state: "overdue", due_in_days: -5 })).toEqual({
      text: "Atrasado",
      tone: "late",
    });
  });

  it("is not on an old dose, a dose with no date or one far away", () => {
    expect(doseBadge({ current: false, state: null, due_in_days: null })).toBeNull();
    expect(doseBadge({ ...dose, state: "no_date", due_in_days: null })).toBeNull();
    expect(doseBadge({ ...dose, state: "ok", due_in_days: 124 })).toBeNull();
  });
});

describe("the animal after 'of'", () => {
  it("takes the article of its sex", () => {
    expect(ofAnimal({ name: "Nina", sex: "female" })).toBe("da Nina");
    expect(ofAnimal({ name: "Thor", sex: "male" })).toBe("do Thor");
    expect(ofAnimal({ name: "Bug", sex: "" })).toBe("de Bug");
  });
});
