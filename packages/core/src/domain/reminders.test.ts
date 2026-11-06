import { describe, expect, it } from "vitest";

import type { ReminderOut } from "../generated/api/types.gen";
import { groupReminders, groupTitle } from "./reminders";

function reminder(
  subject: string,
  label: string,
  extra: Partial<ReminderOut> = {},
): ReminderOut {
  return {
    animal_id: "a1",
    animal_name: "Bug",
    species: "dog",
    subject,
    subject_label: label,
    state: "due",
    due_on: "2026-11-06",
    days: 0,
    record_kind: "vaccine",
    record_id: "r1",
    dose_date: "2025-11-06",
    ...extra,
  };
}

describe("reminder groups", () => {
  it("read the diseases of one dose on one day as one line", () => {
    const groups = groupReminders([
      reminder("distemper", "Cinomose"),
      reminder("parvovirus", "Parvovirose"),
      reminder("rabies", "Raiva", { record_id: "r2" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].subjects).toEqual(["distemper", "parvovirus"]);
    expect(groups[0].labels).toEqual(["Cinomose", "Parvovirose"]);
    expect(groups[1].subjects).toEqual(["rabies"]);
  });

  it("keep apart the same dose on another day or in another state", () => {
    const groups = groupReminders([
      reminder("distemper", "Cinomose"),
      reminder("parvovirus", "Parvovirose", { due_on: "2026-12-06", state: "scheduled" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("are named by the brand, else the one disease, else the dose's day", () => {
    const [combined] = groupReminders([
      reminder("distemper", "Cinomose"),
      reminder("parvovirus", "Parvovirose"),
    ]);
    expect(groupTitle(combined, "Vanguard Plus")).toEqual({
      title: "Vanguard Plus",
      detail: "Cinomose, Parvovirose",
    });
    expect(groupTitle(combined, " ")).toEqual({
      title: "Vacina de 06/11/2025",
      detail: "Cinomose, Parvovirose",
    });
    const [single] = groupReminders([reminder("rabies", "Raiva")]);
    expect(groupTitle(single)).toEqual({ title: "Raiva", detail: null });
  });
});
