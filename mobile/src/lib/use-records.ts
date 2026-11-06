import { listRecordsOptions } from "@pets/core/api/query";
import { useQuery } from "@tanstack/react-query";

import type { AnyRecord } from "@/lib/records";

/** An animal's history, newest first, each record with its kind. */
export function useRecords(animalId: string) {
  const query = useQuery(listRecordsOptions({ path: { animal_id: animalId } }));
  return { ...query, data: query.data as AnyRecord[] | undefined };
}
