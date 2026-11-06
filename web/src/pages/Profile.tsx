import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { Archive, ChevronRight, LogOut } from "lucide-react";
import { initialOf } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { Page } from "@/components/Page";
import { useSession } from "@/lib/session";
import { signOut } from "@/lib/signOut";

const P = strings.profile;

/** The Perfil tab: the account's e-mail, then Arquivados and Sair, quiet. */
export function Profile() {
  const account = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const email = account?.email ?? "";

  async function onSignOut() {
    await signOut(queryClient);
    navigate("/entrar", { replace: true });
  }

  return (
    <Page title={P.title} className="gap-3">
      <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-primary"
        >
          {initialOf(email)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{email}</p>
          <p className="text-sm text-muted-foreground">{P.account}</p>
        </div>
      </div>
      <div className="flex flex-col">
        <Link
          to="/arquivados"
          className="flex items-center gap-2 rounded-lg px-1.5 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <Archive className="size-4" aria-hidden />
          <span className="flex-1">{P.archived}</span>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={() => void onSignOut()}
          className="flex items-center gap-2 rounded-lg px-1.5 py-2 text-left text-sm text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-4" aria-hidden />
          {P.signOut}
        </button>
      </div>
    </Page>
  );
}
