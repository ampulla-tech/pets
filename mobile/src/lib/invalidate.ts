import type { QueryClient } from "@tanstack/react-query";

import { byOperation } from "./query";

/** After a write about an animal, everything that shows it is read again. */
export function refreshAnimal(queryClient: QueryClient) {
  return queryClient.invalidateQueries(
    byOperation(
      "getAnimal",
      "listAnimals",
      "listRecords",
      "listAnimalReminders",
      "listUpcoming",
      "getCard",
      "listAccesses",
    ),
  );
}
