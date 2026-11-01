import { useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import {
  deleteAntiparasitic,
  deleteNote,
  deleteVaccine,
  deleteVisit,
  deleteWeight,
} from "@pets/core/api/generated";
import { strings } from "@pets/core/strings";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Notice } from "@/components/Feedback";
import { Button } from "@/components/ui/button";
import { refreshAll } from "@/lib/queries";
import type { AnimalOut, RecordKind, RecordOut } from "@/lib/types";

export interface RecordFormProps<R extends RecordOut = RecordOut> {
  animal: AnimalOut;
  record?: R;
  /** A reminder's subject the new dose is for (`?assunto=`). */
  subject?: string | null;
  /** Attachments the new record starts with (a reading's photos). */
  attachments?: import("@pets/core/api/generated").AttachmentOut[];
  fromPhoto?: boolean;
}

const DELETE = {
  vaccine: deleteVaccine,
  antiparasitic: deleteAntiparasitic,
  weight: deleteWeight,
  note: deleteNote,
  visit: deleteVisit,
} as const;

/** Save, and on success go back to the animal with everything re-read. */
export function useSaver(animalId: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<string | null>(null);
  async function save(write: () => Promise<unknown>) {
    setFailure(null);
    try {
      await write();
    } catch {
      setFailure(strings.app.genericError);
      return;
    }
    await refreshAll(queryClient);
    navigate(`/animais/${animalId}`, { replace: true });
  }
  return { save, failure };
}

/** The form's foot: the failure, save, and (editing) delete with a confirm. */
export function FormFoot({
  animalId,
  kind,
  record,
  failure,
  submitting,
}: {
  animalId: string;
  kind: RecordKind;
  record?: RecordOut;
  failure: string | null;
  submitting: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  async function onDelete() {
    if (!record) return;
    setBusy(true);
    try {
      await DELETE[kind]({
        path: { animal_id: animalId, record_id: record.id },
        throwOnError: true,
      });
      await refreshAll(queryClient);
      navigate(`/animais/${animalId}`, { replace: true });
    } catch {
      setBusy(false);
      setConfirming(false);
      setDeleteFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {failure || deleteFailed ? (
        <Notice tone="error">{failure ?? strings.app.genericError}</Notice>
      ) : null}
      <Button type="submit" size="xl" disabled={submitting}>
        {submitting ? strings.app.saving : strings.app.save}
      </Button>
      {record ? (
        <>
          <Button
            type="button"
            variant="destructive"
            size="xl"
            onClick={() => setConfirming(true)}
          >
            <Trash2 />
            {strings.app.delete}
          </Button>
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={strings.records.deleteConfirm}
            confirmLabel={strings.app.delete}
            destructive
            busy={busy}
            onConfirm={() => void onDelete()}
          />
        </>
      ) : null}
    </div>
  );
}

/** A typed weight as it reads back in the field: "4,9". */
export function kgText(kg: string | number | null | undefined): string {
  if (kg === null || kg === undefined || kg === "") return "";
  return Number(kg).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}
