import { getCatalogOptions } from "@pets/core/api/query";
import { useQuery } from "@tanstack/react-query";

/** The closed lists (ADR-0003), and a code's label whatever its species. */
export function useCatalog() {
  const catalog = useQuery({ ...getCatalogOptions(), staleTime: Infinity });
  const labels = new Map<string, string>();
  for (const entry of [
    ...(catalog.data?.dog ?? []),
    ...(catalog.data?.cat ?? []),
    ...(catalog.data?.parasites ?? []),
  ]) {
    labels.set(entry.code, entry.label);
  }
  return {
    catalog,
    label: (code: string) => labels.get(code) ?? code,
    diseasesOf: (species: "dog" | "cat") => catalog.data?.[species] ?? [],
  };
}
