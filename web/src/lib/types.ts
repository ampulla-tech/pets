import type {
  AnimalOut,
  AntiparasiticOut,
  ListRecordsResponse,
  NoteOut,
  VaccineOut,
  VisitOut,
  WeightOut,
} from "@pets/core/api/generated";

export type RecordOut = ListRecordsResponse[number];
// `kind` is optional in the generated outputs (it has a default on the server),
// but the server always sends it.
export type RecordKind = NonNullable<RecordOut["kind"]>;
export type { AnimalOut, AntiparasiticOut, NoteOut, VaccineOut, VisitOut, WeightOut };

/** The kinds as the addresses say them (pt-BR), both ways. */
export const KIND_SLUG: Record<RecordKind, string> = {
  vaccine: "vacina",
  antiparasitic: "antiparasitario",
  weight: "peso",
  note: "observacao",
  visit: "consulta",
};

export function kindFromSlug(slug: string | undefined): RecordKind | null {
  const entry = Object.entries(KIND_SLUG).find(([, value]) => value === slug);
  return entry ? (entry[0] as RecordKind) : null;
}

export function newRecordPath(animalId: string, kind: RecordKind, query = "") {
  return `/animais/${animalId}/registrar/${KIND_SLUG[kind]}${query}`;
}

export function editRecordPath(animalId: string, recordId: string) {
  return `/animais/${animalId}/registros/${recordId}`;
}
