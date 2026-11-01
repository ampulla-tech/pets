import { useQuery } from "@tanstack/react-query";
import { listAnimalsOptions } from "@pets/core/api/query";
import { ARCHIVE_REASON_LABEL, formatDate } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { AnimalCard } from "@/components/AnimalCard";
import { EmptyText, ErrorState, Loading } from "@/components/Feedback";
import { Page } from "@/components/Page";

/** The archived animals (`GET /animals?status=archived`), read-only. */
export function Archived() {
  const animals = useQuery(listAnimalsOptions({ query: { status: "archived" } }));
  return (
    <Page title={strings.archive.listTitle} back="/">
      {animals.isPending ? (
        <Loading />
      ) : animals.isError ? (
        <ErrorState onRetry={() => void animals.refetch()} />
      ) : animals.data.length === 0 ? (
        <EmptyText>{strings.archive.empty}</EmptyText>
      ) : (
        <ul className="flex flex-col gap-3">
          {animals.data.map((animal) => (
            <li key={animal.id}>
              <AnimalCard
                animal={animal}
                aside={
                  animal.archived_reason
                    ? strings.archive.archivedOn(
                        ARCHIVE_REASON_LABEL[animal.archived_reason],
                        formatDate(animal.archived_on),
                      )
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
