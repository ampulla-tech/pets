import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { Archive, LogOut, Menu, PawPrint, Plus } from "lucide-react";
import { listAnimalsOptions, listUpcomingOptions } from "@pets/core/api/query";
import { strings } from "@pets/core/strings";
import { AnimalCard } from "@/components/AnimalCard";
import { ErrorState, Loading } from "@/components/Feedback";
import { Page, Section } from "@/components/Page";
import { PushControl } from "@/components/PushControl";
import { UpcomingList } from "@/components/UpcomingList";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/session";
import { signOut } from "@/lib/signOut";

export function Home() {
  const animals = useQuery(listAnimalsOptions());
  const upcoming = useQuery(listUpcomingOptions());
  const account = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function onSignOut() {
    await signOut(queryClient);
    navigate("/entrar", { replace: true });
  }

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={strings.app.menu}>
          <Menu className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem onSelect={() => navigate("/arquivados")}>
          <Archive />
          {strings.home.archived}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void onSignOut()}>
          <LogOut />
          {strings.auth.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const title = (
    <span className="flex items-center gap-2">
      <PawPrint className="size-5 text-primary" aria-hidden />
      {strings.app.name}
    </span>
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
      <>
        <Section title={strings.home.upcomingTitle} id="upcoming">
          {upcoming.data?.length ? (
            <UpcomingList items={upcoming.data} />
          ) : upcoming.isPending ? null : (
            <p className="text-sm text-muted-foreground">{strings.home.upcomingEmpty}</p>
          )}
        </Section>
        <Section
          title={strings.home.title}
          id="animals"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/animais/novo">
                <Plus />
                {strings.home.add}
              </Link>
            </Button>
          }
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            {animals.data.map((animal) => (
              <li key={animal.id}>
                <AnimalCard animal={animal} />
              </li>
            ))}
          </ul>
        </Section>
      </>
    );
  }

  return (
    <Page title={title} actions={menu}>
      {body}
      <Section title={strings.push.title} id="push">
        <div className="rounded-2xl border bg-card p-4">
          <PushControl />
        </div>
      </Section>
      <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
        <Link to="/arquivados" className="text-primary hover:underline">
          {strings.home.archived}
        </Link>
        {account?.email ? <span>{strings.auth.signedInAs(account.email)}</span> : null}
      </div>
    </Page>
  );
}
