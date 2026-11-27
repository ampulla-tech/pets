import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createVisit, updateVisit, type AttachmentOut } from "@pets/core/api/generated";
import { todayIso } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { AttachmentsField } from "@/components/AttachmentsField";
import { Field, TextArea } from "@/components/Field";
import { Input } from "@/components/ui/input";
import type { VisitOut } from "@/lib/types";
import { FormFoot, useSaver, type RecordFormProps } from "./shared";

const R = strings.records;

const schema = z.object({
  date: z.string().min(1, R.dateRequired),
  clinic: z.string(),
  vetName: z.string(),
  reason: z.string(),
  notes: z.string(),
});

/** A visit or an exam, with photos and PDFs attached as files only. */
export function VisitForm({ animal, record }: RecordFormProps<VisitOut>) {
  const { save, failure } = useSaver(animal.id);
  const [files, setFiles] = useState<AttachmentOut[]>(record?.attachments ?? []);
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      date: record?.date ?? todayIso(),
      clinic: record?.clinic ?? "",
      vetName: record?.vet_name ?? "",
      reason: record?.reason ?? "",
      notes: record?.notes ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit((values) =>
    save(() => {
      const body = {
        date: values.date,
        clinic: values.clinic.trim(),
        vet_name: values.vetName.trim(),
        reason: values.reason.trim(),
        notes: values.notes.trim(),
        attachment_ids: files.map((f) => f.id),
      };
      return record
        ? updateVisit({
            path: { animal_id: animal.id, record_id: record.id },
            body,
            throwOnError: true,
          })
        : createVisit({ path: { animal_id: animal.id }, body, throwOnError: true });
    }),
  );
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field label={R.date} required error={errors.date?.message}>
        {(control) => <Input {...control} type="date" {...form.register("date")} />}
      </Field>
      <Field label={R.clinic}>
        {(control) => <Input {...control} {...form.register("clinic")} />}
      </Field>
      <Field label={R.vet}>
        {(control) => <Input {...control} {...form.register("vetName")} />}
      </Field>
      <Field label={R.reason}>
        {(control) => <Input {...control} {...form.register("reason")} />}
      </Field>
      <Field label={R.notes}>
        {(control) => <TextArea {...control} rows={4} {...form.register("notes")} />}
      </Field>
      <AttachmentsField animalId={animal.id} value={files} onChange={setFiles} />
      <FormFoot
        animalId={animal.id}
        kind="visit"
        record={record}
        failure={failure}
        submitting={isSubmitting}
      />
    </form>
  );
}
