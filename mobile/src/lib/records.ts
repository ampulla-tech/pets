/**
 * The five kinds of record behind one interface: create, update and delete by
 * kind, over the generated SDK.
 */

import {
  createAntiparasitic,
  createNote,
  createVaccine,
  createVisit,
  createWeight,
  deleteAntiparasitic,
  deleteNote,
  deleteVaccine,
  deleteVisit,
  deleteWeight,
  updateAntiparasitic,
  updateNote,
  updateVaccine,
  updateVisit,
  updateWeight,
  type AntiparasiticIn,
  type NoteIn,
  type VaccineIn,
  type VisitIn,
  type WeightIn,
} from "@pets/core/api/generated";

export type RecordKind = "vaccine" | "antiparasitic" | "weight" | "note" | "visit";

export type RecordPayload = {
  vaccine: VaccineIn;
  antiparasitic: AntiparasiticIn;
  weight: WeightIn;
  note: NoteIn;
  visit: VisitIn;
};

type Path = { animal_id: string };
type RecordPath = Path & { record_id: string };

const create = {
  vaccine: createVaccine,
  antiparasitic: createAntiparasitic,
  weight: createWeight,
  note: createNote,
  visit: createVisit,
} as const;

const update = {
  vaccine: updateVaccine,
  antiparasitic: updateAntiparasitic,
  weight: updateWeight,
  note: updateNote,
  visit: updateVisit,
} as const;

const remove = {
  vaccine: deleteVaccine,
  antiparasitic: deleteAntiparasitic,
  weight: deleteWeight,
  note: deleteNote,
  visit: deleteVisit,
} as const;

type Call = (options: { path: Path | RecordPath; body?: unknown; throwOnError: true }) => Promise<unknown>;

export function saveRecord<K extends RecordKind>(
  kind: K,
  animalId: string,
  recordId: string | null,
  body: RecordPayload[K],
) {
  if (recordId) {
    const call = update[kind] as unknown as Call;
    return call({ path: { animal_id: animalId, record_id: recordId }, body, throwOnError: true });
  }
  const call = create[kind] as unknown as Call;
  return call({ path: { animal_id: animalId }, body, throwOnError: true });
}

export function deleteRecord(kind: RecordKind, animalId: string, recordId: string) {
  const call = remove[kind] as unknown as Call;
  return call({ path: { animal_id: animalId, record_id: recordId }, throwOnError: true });
}
