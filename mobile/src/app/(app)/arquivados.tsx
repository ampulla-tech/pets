import { listAnimalsOptions } from "@pets/core/api/query";
import { strings } from "@pets/core/strings";
import { useQuery } from "@tanstack/react-query";

import { AnimalCard } from "@/components/AnimalCard";
import { ErrorState, Loading, Screen } from "@/components/ui/screen";
import { Muted } from "@/components/ui/text";

export default function ArchivedScreen() {
  const animals = useQuery(listAnimalsOptions({ query: { status: "archived" } }));
  if (animals.isPending) return <Loading />;
  if (animals.isError) return <ErrorState onRetry={() => void animals.refetch()} />;
  return (
    <Screen>
      {animals.data.length === 0 ? <Muted>{strings.archive.empty}</Muted> : null}
      {animals.data.map((animal) => (
        <AnimalCard key={animal.id} animal={animal} />
      ))}
    </Screen>
  );
}
