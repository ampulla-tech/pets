import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  createNote,
  createWeight,
  updateNote,
  updateWeight,
  type AttachmentOut,
} from "@pets/core/api/generated";
import { parseKg, todayIso } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { AttachmentsField } from "@/components/AttachmentsField";
import { Field, TextArea } from "@/components/Field";
import { Input } from "@/components/ui/input";
import type { NoteOut, WeightOut } from "@/lib/types";
import { FormFoot, kgText, useSaver, type RecordFormProps } from "./shared";

const R = strings.records;

const weightSchema = z.object({
  date: z.string().min(1, R.dateRequired),
  kg: z.string().refine((v) => parseKg(v) !== null, R.kgInvalid),
});

/** A weighing. A guest may write one; only a tutor attaches files. */
export function WeightForm({ animal, record }: RecordFormProps<WeightOut>) {
  const { save, failure } = useSaver(animal.id);
  const tutor = animal.role === "tutor";
  const [files, setFiles] = useState<AttachmentOut[]>(record?.attachments ?? []);
  const form = useForm({
    resolver: zodResolver(weightSchema),
    defaultValues: { date: record?.date ?? todayIso(), kg: kgText(record?.kg) },
  });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit((values) =>
    save(() => {
      const body = { date: values.date, kg: parseKg(values.kg) ?? "", attachment_ids: files.map((f) => f.id) };
      return record
        ? updateWeight({ path: { animal_id: animal.id, record_id: record.id }, body, throwOnError: true })
        : createWeight({ path: { animal_id: animal.id }, body, throwOnError: true });
    }),
  );
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field label={R.date} error={errors.date?.message}>
        {(control) => <Input {...control} type="date" {...form.register("date")} />}
      </Field>
      <Field label={R.weightKg} error={errors.kg?.message}>
        {(control) => <Input {...control} inputMode="decimal" placeholder="4,9" {...form.register("kg")} />}
      </Field>
      {tutor ? <AttachmentsField animalId={animal.id} value={files} onChange={setFiles} /> : null}
      <FormFoot animalId={animal.id} kind="weight" record={record} failure={failure} submitting={isSubmitting} />
    </form>
  );
}

const noteSchema = z.object({
  date: z.string().min(1, R.dateRequired),
  text: z.string().trim().min(1, R.textRequired),
});

/** A dated free-text note. A guest may write one; only a tutor attaches files. */
export function NoteForm({ animal, record }: RecordFormProps<NoteOut>) {
  const { save, failure } = useSaver(animal.id);
  const tutor = animal.role === "tutor";
  const [files, setFiles] = useState<AttachmentOut[]>(record?.attachments ?? []);
  const form = useForm({
    resolver: zodResolver(noteSchema),
    defaultValues: { date: record?.date ?? todayIso(), text: record?.text ?? "" },
  });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit((values) =>
    save(() => {
      const body = { date: values.date, text: values.text.trim(), attachment_ids: files.map((f) => f.id) };
      return record
        ? updateNote({ path: { animal_id: animal.id, record_id: record.id }, body, throwOnError: true })
        : createNote({ path: { animal_id: animal.id }, body, throwOnError: true });
    }),
  );
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field label={R.date} error={errors.date?.message}>
        {(control) => <Input {...control} type="date" {...form.register("date")} />}
      </Field>
      <Field label={R.text} error={errors.text?.message}>
        {(control) => <TextArea {...control} rows={5} {...form.register("text")} />}
      </Field>
      {tutor ? <AttachmentsField animalId={animal.id} value={files} onChange={setFiles} /> : null}
      <FormFoot animalId={animal.id} kind="note" record={record} failure={failure} submitting={isSubmitting} />
    </form>
  );
}
