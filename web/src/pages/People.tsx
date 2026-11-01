import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, LogOut, Share2, UserMinus, UserPlus } from "lucide-react";
import { readFailure } from "@pets/core/api";
import {
  createInvite,
  deleteAnimal,
  removeAccess,
  type AccessOut,
  type InviteOut,
} from "@pets/core/api/generated";
import { listAccessesOptions } from "@pets/core/api/query";
import { formatDate, ROLE_LABEL, todayIso } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ChoiceGroup, Field } from "@/components/Field";
import { ErrorState, Loading, Notice } from "@/components/Feedback";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { refreshAll, useAnimal } from "@/lib/queries";
import type { AnimalOut } from "@/lib/types";

const P = strings.people;

/** `/animais/:id/pessoas`: who has access, invites, removing and leaving. */
export function People() {
  const { id = "" } = useParams();
  const animal = useAnimal(id);
  const back = `/animais/${id}`;
  if (animal.isPending)
    return (
      <Page title={P.title} back={back}>
        <Loading />
      </Page>
    );
  if (animal.isError)
    return (
      <Page title={P.title} back={back}>
        <ErrorState message={strings.animal.notFound} />
      </Page>
    );
  return <PeopleOf animal={animal.data} />;
}

function PeopleOf({ animal }: { animal: AnimalOut }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accesses = useQuery(listAccessesOptions({ path: { animal_id: animal.id } }));
  const tutor = animal.role === "tutor";
  const active = animal.status === "active";
  const [inviting, setInviting] = useState<"tutor" | "guest" | null>(null);
  const [removing, setRemoving] = useState<AccessOut | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [lastTutor, setLastTutor] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const mine = accesses.data?.find((a) => a.is_me);

  async function remove(access: AccessOut, self: boolean) {
    setBusy(true);
    setFailure(null);
    try {
      await removeAccess({
        path: { animal_id: animal.id, access_id: access.id },
        throwOnError: true,
      });
      if (self) {
        queryClient.clear();
        navigate("/", { replace: true });
        return;
      }
      await refreshAll(queryClient);
    } catch (error) {
      if (readFailure(error).code === "last_tutor") setLastTutor(true);
      else setFailure(strings.app.genericError);
    } finally {
      setBusy(false);
      setRemoving(null);
      setLeaving(false);
    }
  }

  async function onDelete() {
    setBusy(true);
    try {
      await deleteAnimal({ path: { animal_id: animal.id }, throwOnError: true });
      queryClient.clear();
      navigate("/", { replace: true });
    } catch {
      setBusy(false);
      setFailure(strings.app.genericError);
    }
  }

  return (
    <Page title={`${P.title} · ${animal.name}`} back={`/animais/${animal.id}`}>
      {accesses.isPending ? (
        <Loading />
      ) : accesses.isError ? (
        <ErrorState onRetry={() => void accesses.refetch()} />
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border bg-card">
          {accesses.data.map((access) => (
            <li key={access.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {access.email}
                  {access.is_me ? (
                    <span className="font-normal text-muted-foreground"> ({P.you})</span>
                  ) : null}
                </p>
                <p className="text-sm text-muted-foreground">
                  {ROLE_LABEL[access.role]}
                  {access.ends_on ? ` · ${P.until(formatDate(access.ends_on))}` : ""}
                </p>
              </div>
              {tutor && !access.is_me ? (
                <Button variant="ghost" size="sm" onClick={() => setRemoving(access)}>
                  <UserMinus />
                  {P.remove}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {failure ? <Notice tone="error">{failure}</Notice> : null}

      <div className="flex flex-col gap-2">
        {tutor && active ? (
          <Button size="xl" onClick={() => setInviting("guest")}>
            <UserPlus />
            {P.invite}
          </Button>
        ) : null}
        {mine ? (
          <Button size="xl" variant="outline" onClick={() => setLeaving(true)}>
            <LogOut />
            {strings.animal.leave}
          </Button>
        ) : null}
      </div>

      {inviting ? (
        <InviteDialog
          animal={animal}
          initialRole={inviting}
          onClose={() => setInviting(null)}
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => (open ? null : setRemoving(null))}
        title={P.remove}
        description={removing ? P.removeConfirm(removing.email) : undefined}
        confirmLabel={P.remove}
        destructive
        busy={busy}
        onConfirm={() => removing && void remove(removing, false)}
      />
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={strings.animal.leave}
        description={P.leaveConfirm(animal.name)}
        confirmLabel={strings.animal.leave}
        destructive
        busy={busy}
        onConfirm={() => mine && void remove(mine, true)}
      />

      <Dialog open={lastTutor} onOpenChange={setLastTutor}>
        <DialogContent closeLabel={strings.app.close}>
          <DialogHeader>
            <DialogTitle>{P.lastTutorTitle}</DialogTitle>
            <p className="text-sm text-muted-foreground">{P.lastTutorBody}</p>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              size="xl"
              onClick={() => {
                setLastTutor(false);
                setInviting("tutor");
              }}
            >
              <UserPlus />
              {P.inviteTutor}
            </Button>
            <Button
              size="xl"
              variant="destructive"
              onClick={() => {
                setLastTutor(false);
                setDeleting(true);
              }}
            >
              {P.deleteInstead}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={strings.animal.deleteAnimal}
        description={strings.animal.deleteConfirm(animal.name)}
        confirmLabel={strings.app.delete}
        destructive
        busy={busy}
        onConfirm={() => void onDelete()}
      />
    </Page>
  );
}

function InviteDialog({
  animal,
  initialRole,
  onClose,
}: {
  animal: AnimalOut;
  initialRole: "tutor" | "guest";
  onClose: () => void;
}) {
  const [role, setRole] = useState<"tutor" | "guest">(initialRole);
  const [endsOn, setEndsOn] = useState("");
  const [invite, setInvite] = useState<InviteOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === "function";

  async function generate() {
    if (role === "guest" && endsOn && endsOn < todayIso()) {
      setFailure(P.endsOnPast);
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const { data } = await createInvite({
        path: { animal_id: animal.id },
        body: { role, access_ends_on: role === "guest" && endsOn ? endsOn : null },
        throwOnError: true,
      });
      setInvite(data);
    } catch {
      setFailure(strings.app.genericError);
    } finally {
      setBusy(false);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent closeLabel={strings.app.close}>
        <DialogHeader>
          <DialogTitle>{P.inviteTitle}</DialogTitle>
        </DialogHeader>
        {invite ? (
          <div className="flex flex-col gap-3">
            <Notice tone="ok">{P.linkReady}</Notice>
            <p className="text-sm">
              {ROLE_LABEL[invite.role]}
              {invite.access_ends_on
                ? ` · ${P.until(formatDate(invite.access_ends_on))}`
                : ""}
            </p>
            <Input
              readOnly
              value={invite.url}
              aria-label={P.copy}
              onFocus={(e) => e.target.select()}
              className="font-mono text-sm"
            />
            <Button size="xl" onClick={() => void copy(invite.url)}>
              {copied ? <Check /> : <Copy />}
              {copied ? P.copied : P.copy}
            </Button>
            {canShare ? (
              <Button
                size="xl"
                variant="outline"
                onClick={() =>
                  void navigator
                    .share({ title: P.shareTitle(animal.name), url: invite.url })
                    .catch(() => undefined)
                }
              >
                <Share2 />
                {P.share}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <ChoiceGroup
              label={P.role}
              name="invite-role"
              value={role}
              onChange={setRole}
              options={[
                { value: "tutor", label: P.tutor, hint: P.tutorHint },
                { value: "guest", label: P.guest, hint: P.guestHint },
              ]}
            />
            {role === "guest" ? (
              <Field label={P.endsOn} optional hint={P.endsOnHint}>
                {(control) => (
                  <Input
                    {...control}
                    type="date"
                    min={todayIso()}
                    value={endsOn}
                    onChange={(e) => setEndsOn(e.target.value)}
                  />
                )}
              </Field>
            ) : null}
            {failure ? <Notice tone="error">{failure}</Notice> : null}
            <DialogFooter>
              <Button variant="outline" size="lg" onClick={onClose}>
                {strings.app.cancel}
              </Button>
              <Button size="lg" onClick={() => void generate()} disabled={busy}>
                {P.generate}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
