import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PawPrint } from "lucide-react";
import { readFailure } from "@pets/core/api";
import { acceptInvite } from "@pets/core/api/generated";
import { previewInviteOptions } from "@pets/core/api/query";
import { formatDate, ROLE_LABEL } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { AnimalAvatar } from "@/components/AnimalAvatar";
import { ErrorState, Loading, Notice } from "@/components/Feedback";
import { Button } from "@/components/ui/button";
import { refreshAll } from "@/lib/queries";
import { useSession } from "@/lib/session";

const V = strings.invite;

/**
 * `/convite/:token` (the backend builds this link): who invited, the animal and
 * the role, open to someone with no account; accepting needs one, so a
 * signed-out visitor signs in or up and comes back here (`?volta=`).
 */
export function InvitePage() {
  const { token = "" } = useParams();
  const account = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // The preview reads differently signed in (already a member?), so the key
  // carries who is asking.
  const preview = useQuery({
    ...previewInviteOptions({ path: { token } }),
    queryKey: [...previewInviteOptions({ path: { token } }).queryKey, account?.email ?? null] as never,
    retry: false,
  });
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const here = `/convite/${token}`;

  async function accept() {
    setBusy(true);
    setFailure(null);
    try {
      const { data } = await acceptInvite({ path: { token }, throwOnError: true });
      await refreshAll(queryClient);
      navigate(`/animais/${data.animal_id}`, { replace: true });
    } catch (error) {
      const { code } = readFailure(error);
      setFailure(
        code === "invite_expired"
          ? V.expired
          : code === "invite_used"
            ? V.used
            : code === "already_member"
              ? V.alreadyMember
              : strings.app.genericError,
      );
      setBusy(false);
    }
  }

  let body;
  if (preview.isPending) body = <Loading />;
  else if (preview.isError)
    body = <ErrorState message={readFailure(preview.error).status === 404 ? V.notFound : strings.app.genericError} />;
  else {
    const invite = preview.data;
    const role = ROLE_LABEL[invite.role];
    body = (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <AnimalAvatar name={invite.animal.name} species={invite.animal.species} photoUrl={invite.animal.photo_url} className="size-24 rounded-3xl" />
          <p className="text-2xl font-semibold">{invite.animal.name}</p>
          <p>{V.body(invite.invited_by, invite.animal.name, role)}</p>
          <p className="text-sm text-muted-foreground">
            {invite.role === "guest" ? strings.people.guestHint : strings.people.tutorHint}
          </p>
          {invite.access_ends_on ? <p className="text-sm font-medium">{V.endsOn(formatDate(invite.access_ends_on))}</p> : null}
        </div>
        {invite.state === "expired" ? (
          <Notice tone="warn">{V.expired}</Notice>
        ) : invite.state === "used" ? (
          <Notice tone="warn">{V.used}</Notice>
        ) : invite.already_member ? (
          <div className="flex flex-col gap-3">
            <Notice>{V.alreadyMember}</Notice>
            {invite.animal_id ? (
              <Button asChild size="xl">
                <Link to={`/animais/${invite.animal_id}`}>{V.openAnimal}</Link>
              </Button>
            ) : null}
          </div>
        ) : account ? (
          <div className="flex flex-col gap-3">
            {failure ? <Notice tone="error">{failure}</Notice> : null}
            <Button size="xl" onClick={() => void accept()} disabled={busy}>
              {V.accept}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-center text-sm text-muted-foreground">{V.signInToAccept}</p>
            <Button asChild size="xl">
              <Link to={`/cadastro?volta=${encodeURIComponent(here)}`}>{strings.auth.signUp}</Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <Link to={`/entrar?volta=${encodeURIComponent(here)}`}>{strings.auth.signIn}</Link>
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center justify-center gap-2 text-primary">
          <PawPrint className="size-5" aria-hidden />
          <span className="text-sm font-semibold tracking-wide uppercase">{strings.app.name}</span>
        </div>
        <h1 className="sr-only">{V.title}</h1>
        <div className="rounded-2xl border bg-card p-5 shadow-xs">{body}</div>
        {account ? (
          <Link to="/" className="text-center text-sm text-primary hover:underline">
            {strings.app.goHome}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
