import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  createAntiparasitic,
  updateAntiparasitic,
  type AntiparasiticIn,
  type AttachmentOut,
} from "@pets/core/api/generated";
import { parseKg, PARASITE_LABEL, todayIso } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { AttachmentsField } from "@/components/AttachmentsField";
import { ChoiceGroup, Field } from "@/components/Field";
import { Input } from "@/components/ui/input";
import type { AntiparasiticOut } from "@/lib/types";
import { FormFoot, kgText, useSaver, type RecordFormProps } from "./shared";

const R = strings.records;

const schema = z.object({
  date: z.string().min(1, R.dateRequired),
  parasite: z.enum(["internal", "external"]),
  product: z.string(),
  dose: z.string(),
  repeatOn: z.string(),
  vetName: z.string(),
  weight: z.string().refine((v) => !v.trim() || parseKg(v) !== null, R.kgInvalid),
});
type Values = z.infer<typeof schema>;

/** A dewormer or a flea-and-tick dose, with an optional weight taken the same day. */
export function AntiparasiticForm({ animal, record, subject, attachments }: RecordFormProps<AntiparasiticOut>) {
  const { save, failure } = useSaver(animal.id);
  const [files, setFiles] = useState<AttachmentOut[]>(record?.attachments ?? attachments ?? []);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: record?.date ?? todayIso(),
      parasite: record?.parasite ?? (subject === "external" ? "external" : "internal"),
      product: record?.product ?? "",
      dose: record?.dose ?? "",
      repeatOn: record?.repeat_on ?? "",
      vetName: record?.vet_name ?? "",
      weight: kgText(record?.weight_kg),
    },
  });
  const { errors, isSubmitting } = form.formState;
  const repeatOn = form.watch("repeatOn");
  const inferred = record?.repeat_on_origin === "inferred" && repeatOn === record.repeat_on;

  const onSubmit = form.handleSubmit((values) =>
    save(() => {
      const body: AntiparasiticIn = {
        date: values.date,
        parasite: values.parasite,
        product: values.product.trim(),
        dose: values.dose.trim(),
        repeat_on: values.repeatOn || null,
        repeat_on_origin: values.repeatOn ? (inferred ? "inferred" : "written") : "",
        vet_name: values.vetName.trim(),
        weight_kg: values.weight.trim() ? parseKg(values.weight) : null,
        attachment_ids: files.map((f) => f.id),
      };
      return record
        ? updateAntiparasitic({ path: { animal_id: animal.id, record_id: record.id }, body, throwOnError: true })
        : createAntiparasitic({ path: { animal_id: animal.id }, body, throwOnError: true });
    }),
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field label={R.date} error={errors.date?.message}>
        {(control) => <Input {...control} type="date" {...form.register("date")} />}
      </Field>
      <Controller
        control={form.control}
        name="parasite"
        render={({ field }) => (
          <ChoiceGroup
            label={R.parasite}
            name="parasite"
            value={field.value}
            onChange={field.onChange}
            options={[
              { value: "internal", label: PARASITE_LABEL.internal },
              { value: "external", label: PARASITE_LABEL.external },
            ]}
          />
        )}
      />
      <Field label={R.product} optional>
        {(control) => <Input {...control} {...form.register("product")} />}
      </Field>
      <Field label={R.dose} optional>
        {(control) => <Input {...control} {...form.register("dose")} />}
      </Field>
      <Field label={R.repeatOn} optional hint={repeatOn ? (inferred ? R.repeatInferred : undefined) : R.noRepeat}>
        {(control) => <Input {...control} type="date" {...form.register("repeatOn")} />}
      </Field>
      <Field label={R.vet} optional>
        {(control) => <Input {...control} {...form.register("vetName")} />}
      </Field>
      <Field label={R.weightWithTreatment} error={errors.weight?.message}>
        {(control) => <Input {...control} inputMode="decimal" placeholder="4,9" {...form.register("weight")} />}
      </Field>
      <AttachmentsField animalId={animal.id} value={files} onChange={setFiles} accept="image/*" label={R.photo} />
      <FormFoot animalId={animal.id} kind="antiparasitic" record={record} failure={failure} submitting={isSubmitting} />
    </form>
  );
}
