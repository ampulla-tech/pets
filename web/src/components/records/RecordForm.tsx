import type { RecordKind } from "@/lib/types";
import type { RecordFormProps } from "./shared";
import { VaccineForm } from "./VaccineForm";
import { AntiparasiticForm } from "./AntiparasiticForm";
import { WeightForm, NoteForm } from "./SimpleForms";
import { VisitForm } from "./VisitForm";

/** The form of one record kind, new or editing. */
export function RecordForm({
  kind,
  record,
  ...props
}: RecordFormProps & { kind: RecordKind }) {
  switch (kind) {
    case "vaccine":
      return (
        <VaccineForm
          {...props}
          record={record?.kind === "vaccine" ? record : undefined}
        />
      );
    case "antiparasitic":
      return (
        <AntiparasiticForm
          {...props}
          record={record?.kind === "antiparasitic" ? record : undefined}
        />
      );
    case "weight":
      return (
        <WeightForm {...props} record={record?.kind === "weight" ? record : undefined} />
      );
    case "note":
      return (
        <NoteForm {...props} record={record?.kind === "note" ? record : undefined} />
      );
    case "visit":
      return (
        <VisitForm {...props} record={record?.kind === "visit" ? record : undefined} />
      );
  }
}
