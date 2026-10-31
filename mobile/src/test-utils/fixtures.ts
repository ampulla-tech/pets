/** API answers shaped like the backend's, for the screens' tests. */

import type { AccessOut, AnimalOut, CatalogOut, ReminderOut } from "@pets/core/api/generated";

export const ANIMAL_ID = "a1";

export function animal(over: Partial<AnimalOut> = {}): AnimalOut {
  return {
    id: ANIMAL_ID,
    species: "cat",
    name: "Lacan",
    breed: "SRD",
    sex: "male",
    neutered: true,
    coat: "",
    microchip: "",
    birth: { precision: "year", value: "2021" },
    adopted_on: null,
    age: { years: 5, months: null, approximate: true },
    photo_url: null,
    status: "active",
    archived_reason: "",
    archived_on: null,
    role: "tutor",
    badge: { state: "up_to_date", days: null },
    last_weight: { kg: "4.900", date: "2026-10-12" },
    ...over,
  };
}

export const CATALOG: CatalogOut = {
  dog: [
    { code: "distemper", label: "Cinomose" },
    { code: "rabies", label: "Raiva" },
  ],
  cat: [
    { code: "rhinotracheitis", label: "Rinotraqueíte" },
    { code: "calicivirus", label: "Calicivirose" },
    { code: "panleukopenia", label: "Panleucopenia" },
    { code: "chlamydiosis", label: "Clamidiose" },
    { code: "felv", label: "FeLV" },
    { code: "rabies", label: "Raiva" },
  ],
  parasites: [
    { code: "internal", label: "Verme interno" },
    { code: "external", label: "Pulga e carrapato" },
  ],
};

export function reminder(over: Partial<ReminderOut> = {}): ReminderOut {
  return {
    animal_id: ANIMAL_ID,
    animal_name: "Lacan",
    species: "cat",
    subject: "rabies",
    subject_label: "Raiva",
    state: "upcoming",
    due_on: "2026-11-06",
    days: 6,
    record_kind: "vaccine",
    record_id: "v1",
    dose_date: "2025-11-06",
    ...over,
  };
}

const author = { id: "u1", email: "ana@example.com" };
const stamps = {
  attachments: [],
  created_by: author,
  created_at: "2026-10-12T10:00:00Z",
  updated_by: author,
  updated_at: "2026-10-12T10:00:00Z",
  can_edit: true,
};

export function vaccine(over: Record<string, unknown> = {}) {
  return {
    id: "v1",
    kind: "vaccine",
    date: "2025-11-06",
    brand: "Quantum Raiva",
    lot: "L123",
    lot_expiry: "2027-09",
    diseases: ["rabies"],
    repeat_on: "2026-11-06",
    repeat_on_origin: "written",
    vet_name: "Dra. Paula",
    vet_crmv: "SP-1234",
    ...stamps,
    ...over,
  };
}

export function weight(id: string, date: string, kg: string, over: Record<string, unknown> = {}) {
  return { id, kind: "weight", date, kg, ...stamps, ...over };
}

export function antiparasitic(over: Record<string, unknown> = {}) {
  return {
    id: "p1",
    kind: "antiparasitic",
    date: "2026-10-22",
    parasite: "internal",
    product: "Drontal",
    dose: "1 comprimido",
    repeat_on: null,
    repeat_on_origin: "",
    vet_name: "",
    weight_kg: null,
    ...stamps,
    ...over,
  };
}

export function access(over: Partial<AccessOut> = {}): AccessOut {
  return { id: 1, user_id: "u1", email: "ana@example.com", role: "tutor", ends_on: null, is_me: true, ...over };
}

/** The routes every animal screen reads, answered for one animal. */
export function animalRoutes(a: AnimalOut, records: unknown[] = [], reminders: ReminderOut[] = []) {
  return {
    [`GET /animals/${a.id}`]: { body: a },
    [`GET /animals/${a.id}/records`]: { body: records },
    [`GET /animals/${a.id}/reminders`]: { body: reminders },
    "GET /catalog": { body: CATALOG },
    // The home sits beneath every animal screen.
    "GET /animals": { body: [a] },
    "GET /reminders/upcoming": { body: reminders },
  };
}
