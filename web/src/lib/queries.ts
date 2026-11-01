/**
 * The queries more than one screen reads, over the generated query options.
 */
import { useQuery, type QueryClient } from "@tanstack/react-query";
import {
  getAnimalOptions,
  getCatalogOptions,
  listRecordsOptions,
} from "@pets/core/api/query";
import type { AnimalOut, RecordOut } from "@/lib/types";

export function useAnimal(id: string) {
  return useQuery(getAnimalOptions({ path: { animal_id: id } }));
}

export function useRecords(id: string) {
  return useQuery(listRecordsOptions({ path: { animal_id: id } }));
}

export function useCatalog() {
  return useQuery({ ...getCatalogOptions(), staleTime: Infinity });
}

/**
 * After a write: everything an animal touches (its card, its reminders, the
 * home's badges and "Próximos") is derived on the server, so read it all again.
 */
export function refreshAll(queryClient: QueryClient) {
  return queryClient.invalidateQueries();
}

export function canWrite(animal: AnimalOut) {
  return animal.status === "active";
}

export function isTutor(animal: AnimalOut) {
  return animal.role === "tutor";
}

export type { RecordOut };
