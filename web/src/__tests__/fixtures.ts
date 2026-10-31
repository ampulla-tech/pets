import type {
  AccessOut,
  AnimalOut,
  CatalogOut,
  ReminderOut,
  VaccineOut,
} from "@pets/core/api/generated";

export const CATALOG: CatalogOut = {
  dog: [
    { code: "distemper", label: "Cinomose" },
    { code: "parvovirus", label: "Parvovirose" },
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

export function animal(over: Partial<AnimalOut> = {}): AnimalOut {
  return {
    id: "a1",
    species: "cat",
    name: "Lacan",
    breed: "SRD",
    sex: "male",
    neutered: null,
    coat: "",
    microchip: "",
    birth: { precision: "unknown", value: null },
    adopted_on: null,
    age: null,
    photo_url: null,
    status: "active",
    archived_reason: "",
    archived_on: null,
    role: "tutor",
    badge: { state: "up_to_date", days: null },
    last_weight: null,
    ...over,
  };
}

const author = { id: "u1", email: "ana@example.com" };

export function vaccine(over: Partial<VaccineOut> = {}): VaccineOut {
  return {
    kind: "vaccine",
    id: "v1",
    date: "2026-06-06",
    attachments: [],
    created_by: author,
    created_at: "2026-06-06T10:00:00Z",
    updated_by: author,
    updated_at: "2026-06-06T10:00:00Z",
    can_edit: true,
    brand: "Bioraiva Pet",
    lot: "011/25",
    lot_expiry: "2027-09",
    diseases: ["rabies"],
    repeat_on: "2027-06-06",
    repeat_on_origin: "written",
    vet_name: "Dra. Exemplo",
    vet_crmv: "CRMV-SC 00001",
    ...over,
  };
}

export function weight(id: string, date: string, kg: string) {
  return {
    kind: "weight" as const,
    id,
    date,
    kg,
    attachments: [],
    created_by: author,
    created_at: `${date}T10:00:00Z`,
    updated_by: author,
    updated_at: `${date}T10:00:00Z`,
    can_edit: true,
  };
}

export function reminder(over: Partial<ReminderOut> = {}): ReminderOut {
  return {
    animal_id: "a1",
    animal_name: "Lacan",
    species: "cat",
    subject: "rabies",
    subject_label: "Raiva",
    state: "scheduled",
    due_on: "2027-06-06",
    days: 218,
    record_kind: "vaccine",
    record_id: "v1",
    dose_date: "2026-06-06",
    ...over,
  };
}

export function access(over: Partial<AccessOut> = {}): AccessOut {
  return { id: 1, user_id: "u1", email: "ana@example.com", role: "tutor", ends_on: null, is_me: true, ...over };
}

/** The routes every animal screen reads, for one animal. */
export function animalRoutes(a: AnimalOut, records: unknown[] = [], reminders: ReminderOut[] = []) {
  return {
    "GET /catalog": CATALOG,
    [`GET /animals/${a.id}`]: a,
    [`GET /animals/${a.id}/records`]: records,
    [`GET /animals/${a.id}/reminders`]: reminders,
  };
}
