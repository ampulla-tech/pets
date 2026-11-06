import { Link } from "react-router";
import {
  Bug,
  Camera,
  ChevronRight,
  NotebookPen,
  Scale,
  Stethoscope,
  Syringe,
} from "lucide-react";
import { RECORD_KIND_LABEL } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { BottomSheet } from "@/components/BottomSheet";
import { newRecordPath, type AnimalOut, type RecordKind } from "@/lib/types";

const S = strings.animal;

export const KIND_ICON = {
  vaccine: Syringe,
  antiparasitic: Bug,
  weight: Scale,
  note: NotebookPen,
  visit: Stethoscope,
} as const;

const TUTOR_KINDS: RecordKind[] = ["vaccine", "antiparasitic", "weight", "note", "visit"];
const GUEST_KINDS: RecordKind[] = ["weight", "note"];

/**
 * "Registrar": every way to record something, by the viewer's role. A tutor
 * gets the reading of the paper card's photos first, standing out, and the
 * five kinds by hand below it; a guest, weight and note.
 */
export function RegisterSheet({
  animal,
  open,
  onClose,
  back,
}: {
  animal: Pick<AnimalOut, "id" | "role">;
  open: boolean;
  onClose: () => void;
  /** Where the form returns once saved, when not the animal's profile. */
  back?: string;
}) {
  const tutor = animal.role === "tutor";
  const kinds = tutor ? TUTOR_KINDS : GUEST_KINDS;
  const state = back ? { back } : undefined;
  return (
    <BottomSheet open={open} onClose={onClose} title={S.addRecord}>
      {tutor ? (
        <>
          <Link
            to={`/animais/${animal.id}/foto`}
            state={state}
            className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-accent p-3.5 hover:bg-accent/80"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Camera className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-primary">{S.readPhotos}</span>
              <span className="block text-sm text-foreground/75">{S.readPhotosHint}</span>
            </span>
          </Link>
          <p className="mt-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {S.byHand}
          </p>
        </>
      ) : null}
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {kinds.map((kind) => {
          const Icon = KIND_ICON[kind];
          return (
            <li key={kind}>
              <Link
                to={newRecordPath(animal.id, kind)}
                state={state}
                className="flex items-center gap-3 px-3.5 py-3 font-medium hover:bg-muted"
              >
                <Icon className="size-5 text-primary" aria-hidden />
                {RECORD_KIND_LABEL[kind]}
                <ChevronRight
                  className="ml-auto size-4 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
