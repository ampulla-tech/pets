import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { PawPrint, Plus } from "lucide-react";
import { listAnimalsOptions } from "@pets/core/api/query";
import { strings } from "@pets/core/strings";
import { AnimalCard } from "@/components/AnimalCard";
import { ErrorState, Loading } from "@/components/Feedback";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/button";

/** The Pets tab: "Meus pets", the add button, and only the animals' cards. */
export function Home() {
  const animals = useQuery(listAnimalsOptions());

  const add = (
    <Button asChild variant="ghost" className="font-semibold text-primary">
      <Link to="/animais/novo">
        <Plus />
        {strings.home.addShort}
      </Link>
    </Button>
  );

  let body;
  if (animals.isPending) body = <Loading />;
  else if (animals.isError) body = <ErrorState onRetry={() => void animals.refetch()} />;
  else if (animals.data.length === 0) {
    body = (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <PawPrint className="size-8" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold">{strings.home.empty}</p>
          <p className="text-sm text-muted-foreground">{strings.home.emptyHint}</p>
        </div>
        <Button asChild size="xl">
          <Link to="/animais/novo">
            <Plus />
            {strings.home.add}
          </Link>
        </Button>
      </div>
    );
  } else {
    body = (
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {animals.data.map((animal) => (
          <li key={animal.id}>
            <AnimalCard animal={animal} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Page title={strings.home.title} actions={add} className="gap-3">
      {body}
    </Page>
  );
}
