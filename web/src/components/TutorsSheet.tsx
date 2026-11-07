import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { removeAccess } from "@pets/core/api/generated";
import { listAccessesOptions } from "@pets/core/api/query";
import { formatDate, initialOf, ofAnimal } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { BottomSheet } from "@/components/BottomSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorState, Loading, Notice } from "@/components/Feedback";
import type { AnimalOut } from "@/lib/types";

const P = strings.people;

/**
 * Tutores, for a guest: who to talk to about the animal, when the guest's own
 * access ends, and leaving it. The server tells a guest no other guest.
 */
export function TutorsSheet({
  animal,
  open,
  onClose,
}: {
  animal: AnimalOut;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accesses = useQuery({
    ...listAccessesOptions({ path: { animal_id: animal.id } }),
    enabled: open,
  });
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const tutors = (accesses.data ?? []).filter((a) => a.role === "tutor");
  const mine = accesses.data?.find((a) => a.is_me);

  async function leave() {
    if (!mine) return;
    setBusy(true);
    setFailed(false);
    try {
      await removeAccess({
        path: { animal_id: animal.id, access_id: mine.id },
        throwOnError: true,
      });
      queryClient.clear();
      navigate("/", { replace: true });
    } catch {
      setFailed(true);
      setBusy(false);
      setLeaving(false);
    }
  }

  return (
    <>
      <BottomSheet
        open={open && !leaving}
        onClose={onClose}
        title={P.tutorsTitle(ofAnimal(animal))}
      >
        <p className="-mt-1.5 text-sm text-muted-foreground">{P.tutorsHint}</p>
        {accesses.isPending ? (
          <Loading />
        ) : accesses.isError ? (
          <ErrorState onRetry={() => void accesses.refetch()} />
        ) : (
          <>
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {tutors.map((tutor) => (
                <li key={tutor.id} className="flex items-center gap-2.5 px-3 py-2.5">
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary"
                  >
                    {initialOf(tutor.email)}
                  </span>
                  <span className="min-w-0 truncate font-medium">{tutor.email}</span>
                </li>
              ))}
            </ul>
            {mine?.ends_on ? (
              <p className="text-sm text-muted-foreground">
                {P.accessUntil(formatDate(mine.ends_on))}
              </p>
            ) : null}
            {failed ? <Notice tone="error">{strings.app.genericError}</Notice> : null}
            {mine ? (
              <button
                type="button"
                onClick={() => setLeaving(true)}
                className="justify-self-start rounded-md px-0.5 py-1 text-sm font-medium text-late hover:underline"
              >
                {strings.animal.leave}
              </button>
            ) : null}
          </>
        )}
      </BottomSheet>
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={strings.animal.leave}
        description={P.leaveConfirm(animal.name)}
        confirmLabel={strings.animal.leave}
        destructive
        busy={busy}
        onConfirm={() => void leave()}
      />
    </>
  );
}
