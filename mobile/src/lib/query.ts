import { QueryClient, type QueryKey } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 15_000 },
    },
  });
}

/**
 * A predicate over the generated query keys (`[{ _id: "listRecords", ... }]`),
 * to invalidate every query of some operations at once.
 */
export function byOperation(...ids: string[]) {
  return {
    predicate: (query: { queryKey: QueryKey }) => {
      const head = query.queryKey[0] as { _id?: string } | undefined;
      return !!head?._id && ids.includes(head._id);
    },
  };
}
