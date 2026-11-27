import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  createVaccine,
  updateVaccine,
  type AttachmentOut,
  type VaccineIn,
} from "@pets/core/api/generated";
import { todayIso } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { AttachmentsField } from "@/components/AttachmentsField";
import { Field } from "@/components/Field";
import { Loading, Notice } from "@/components/Feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { monthValue } from "@/lib/dates";
import { useCatalog } from "@/lib/queries";
import type { VaccineOut } from "@/lib/types";
import { FormFoot, useSaver, type RecordFormProps } from "./shared";

const R = strings.records;

const schema = z.object({
  date: z.string().min(1, R.dateRequired),
  diseases: z.array(z.string()).min(1, R.diseasesRequired),
  brand: z.string(),
  lot: z.string(),
  lotExpiry: z
    .string()
    .refine((v) => !v.trim() || monthValue(v) !== null, R.monthInvalid),
  repeatOn: z.string(),
  vetName: z.string(),
  vetCrmv: z.string(),
});
type Values = z.infer<typeof schema>;

/** A vaccine: only the diseases of the animal's species, one or more. */
export function VaccineForm({
  animal,
  record,
  subject,
  previous,
  attachments,
  fromPhoto,
}: RecordFormProps<VaccineOut>) {
  const last = previous?.kind === "vaccine" ? previous : undefined;
  // Copied from the last dose, the diseases stay folded: the person registers
  // the vaccine, and opens the list only when the vet changed it.
  const [pickDiseases, setPickDiseases] = useState(!last);
  const catalog = useCatalog();
  const { save, failure } = useSaver(animal.id);
  const [files, setFiles] = useState<AttachmentOut[]>(
    record?.attachments ?? attachments ?? [],
  );
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: record?.date ?? todayIso(),
      diseases: record?.diseases ?? last?.diseases ?? (subject ? [subject] : []),
      brand: record?.brand ?? last?.brand ?? "",
      lot: record?.lot ?? "",
      // The month picker's own value, "2027-09": the API stores no other form.
      lotExpiry: record?.lot_expiry ?? "",
      repeatOn: record?.repeat_on ?? "",
      vetName: record?.vet_name ?? "",
      vetCrmv: record?.vet_crmv ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const repeatOn = form.watch("repeatOn");
  const inferred =
    record?.repeat_on_origin === "inferred" && repeatOn === record.repeat_on;

  const onSubmit = form.handleSubmit((values) =>
    save(() => {
      const body: VaccineIn = {
        date: values.date,
        // The codes come from the catalog of the animal's species.
        diseases: values.diseases as VaccineIn["diseases"],
        brand: values.brand.trim(),
        lot: values.lot.trim(),
        lot_expiry: values.lotExpiry.trim() ? (monthValue(values.lotExpiry) ?? "") : "",
        repeat_on: values.repeatOn || null,
        repeat_on_origin: values.repeatOn ? (inferred ? "inferred" : "written") : "",
        vet_name: values.vetName.trim(),
        vet_crmv: values.vetCrmv.trim(),
        attachment_ids: files.map((f) => f.id),
      };
      return record
        ? updateVaccine({
            path: { animal_id: animal.id, record_id: record.id },
            body,
            throwOnError: true,
          })
        : createVaccine({ path: { animal_id: animal.id }, body, throwOnError: true });
    }),
  );

  if (catalog.isPending) return <Loading />;
  const diseases = catalog.data?.[animal.species] ?? [];
  const chosen = form.watch("diseases");
  const chosenLabels = diseases
    .filter((d) => chosen.includes(d.code))
    .map((d) => d.label)
    .join(", ");

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {fromPhoto ? <Notice>{R.fromPhoto}</Notice> : null}
      {last ? <Notice>{R.fromLastDose}</Notice> : null}
      <Field label={R.date} error={errors.date?.message}>
        {(control) => <Input {...control} type="date" {...form.register("date")} />}
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">{R.diseases}</legend>
        {pickDiseases ? null : (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-input bg-card px-3 py-2.5">
            <p className="min-w-0 text-sm">{chosenLabels}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickDiseases(true)}
            >
              {R.changeDiseases}
            </Button>
          </div>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" hidden={!pickDiseases}>
          {diseases.map((disease) => (
            <label
              key={disease.code}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-input bg-card px-3 py-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent"
            >
              <input
                type="checkbox"
                value={disease.code}
                className="size-4"
                {...form.register("diseases")}
              />
              {disease.label}
            </label>
          ))}
        </div>
        {errors.diseases?.message ? (
          <p className="text-sm text-destructive">{errors.diseases.message}</p>
        ) : null}
      </fieldset>
      <Field label={R.brand} optional>
        {(control) => <Input {...control} {...form.register("brand")} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={R.lot} optional>
          {(control) => <Input {...control} {...form.register("lot")} />}
        </Field>
        <Field label={R.lotExpiry} optional error={errors.lotExpiry?.message}>
          {(control) => (
            // A picker on phones; plain text, typed "09/2027", where the
            // browser has none (Safari and Firefox on a computer).
            <Input
              {...control}
              type="month"
              placeholder={R.monthPlaceholder}
              {...form.register("lotExpiry")}
            />
          )}
        </Field>
      </div>
      <Field
        label={R.repeatOn}
        optional
        hint={repeatOn ? (inferred ? R.repeatInferred : undefined) : R.noRepeat}
      >
        {(control) => <Input {...control} type="date" {...form.register("repeatOn")} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={R.vet} optional>
          {(control) => <Input {...control} {...form.register("vetName")} />}
        </Field>
        <Field label={R.crmv} optional>
          {(control) => <Input {...control} {...form.register("vetCrmv")} />}
        </Field>
      </div>
      <AttachmentsField
        animalId={animal.id}
        value={files}
        onChange={setFiles}
        accept="image/*"
        label={R.photo}
      />
      <FormFoot
        animalId={animal.id}
        kind="vaccine"
        record={record}
        failure={failure}
        submitting={isSubmitting}
      />
    </form>
  );
}
