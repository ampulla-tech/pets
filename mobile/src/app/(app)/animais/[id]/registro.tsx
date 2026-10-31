import type { AttachmentOut } from "@pets/core/api/generated";
import { getAnimalOptions } from "@pets/core/api/query";
import { formatMonth, parseKg, RECORD_KIND_LABEL, todayIso } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { FilePicker } from "@/components/FilePicker";
import type { AnyRecord } from "@/components/RecordItem";
import { Button } from "@/components/ui/button";
import { DateInput, MonthInput } from "@/components/ui/date-input";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorState, Loading, Notice, Screen } from "@/components/ui/screen";
import { MultiSelect, Segmented } from "@/components/ui/segmented";
import { Text } from "@/components/ui/text";
import { useCatalog } from "@/lib/catalog";
import { dayText, readDay, readMonth } from "@/lib/dates";
import { uploadAttachments, type PickedFile } from "@/lib/files";
import { refreshAnimal } from "@/lib/invalidate";
import { deleteRecord, saveRecord, type RecordKind } from "@/lib/records";
import { useRecords } from "@/lib/use-records";

type Params = {
  id: string;
  tipo?: RecordKind;
  registro?: string;
  assunto?: string;
  anexos?: string;
  campo?: string;
};

type Values = Record<string, string>;

function initialValues(record: AnyRecord | undefined): Values {
  const today = dayText(todayIso());
  if (!record) return { date: today };
  const base: Values = { date: dayText(record.date) };
  switch (record.kind) {
    case "vaccine":
      return {
        ...base,
        brand: record.brand,
        lot: record.lot,
        lot_expiry: record.lot_expiry ? formatMonth(record.lot_expiry) : "",
        repeat_on: dayText(record.repeat_on),
        vet_name: record.vet_name,
        vet_crmv: record.vet_crmv,
      };
    case "antiparasitic":
      return {
        ...base,
        product: record.product,
        dose: record.dose,
        repeat_on: dayText(record.repeat_on),
        vet_name: record.vet_name,
        weight_kg: record.weight_kg ? String(Number(record.weight_kg)).replace(".", ",") : "",
      };
    case "weight":
      return { ...base, kg: String(Number(record.kg)).replace(".", ",") };
    case "note":
      return { ...base, text: record.text };
    case "visit":
      return { ...base, clinic: record.clinic, vet_name: record.vet_name, reason: record.reason, notes: record.notes };
  }
}

/** Register or edit one record of any kind; the kind decides the fields. */
export default function RecordScreen() {
  const params = useLocalSearchParams<Params>();
  const id = params.id;
  const animal = useQuery(getAnimalOptions({ path: { animal_id: id } }));
  const records = useRecords(id);
  const editing = params.registro ?? null;
  const record = editing ? records.data?.find((r) => r.id === editing) : undefined;

  if (animal.isPending || (editing && records.isPending)) return <Loading />;
  if (animal.isError) return <ErrorState message={strings.animal.notFound} />;
  if (editing && !record) return <ErrorState message={strings.records.notFound} />;

  const kind = (record?.kind ?? params.tipo ?? "vaccine") as RecordKind;
  return (
    <RecordForm
      key={record?.id ?? kind}
      animalId={id}
      species={animal.data.species}
      tutor={animal.data.role === "tutor"}
      kind={kind}
      record={record}
      subject={params.assunto}
      presetAttachments={params.anexos ? params.anexos.split(",").filter(Boolean) : []}
      focus={params.campo}
    />
  );
}

function RecordForm({
  animalId,
  species,
  tutor,
  kind,
  record,
  subject,
  presetAttachments,
  focus,
}: {
  animalId: string;
  species: "dog" | "cat";
  tutor: boolean;
  kind: RecordKind;
  record?: AnyRecord;
  subject?: string;
  presetAttachments: string[];
  focus?: string;
}) {
  const queryClient = useQueryClient();
  const { diseasesOf, catalog } = useCatalog();
  const [values, setValues] = useState<Values>(() => initialValues(record));
  const [diseases, setDiseases] = useState<string[]>(
    record?.kind === "vaccine" ? record.diseases : subject && kind === "vaccine" ? [subject] : [],
  );
  const [parasite, setParasite] = useState<"internal" | "external">(
    record?.kind === "antiparasitic"
      ? record.parasite
      : subject === "external"
        ? "external"
        : "internal",
  );
  const [existing, setExisting] = useState<AttachmentOut[]>(record?.attachments ?? []);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const set = (name: string) => (text: string) => setValues((v) => ({ ...v, [name]: text }));
  const v = (name: string) => values[name] ?? "";
  const title = record ? strings.records.editTitle(RECORD_KIND_LABEL[kind]) : strings.records.newTitle(RECORD_KIND_LABEL[kind]);
  const attachable = tutor && (kind === "vaccine" || kind === "antiparasitic" || kind === "visit");

  function originOf(repeatOn: string | null): "written" | "inferred" | "" {
    if (!repeatOn) return "";
    if (record && (record.kind === "vaccine" || record.kind === "antiparasitic") && record.repeat_on === repeatOn) {
      return record.repeat_on_origin;
    }
    return "written";
  }

  function build(): { body: Record<string, unknown> } | null {
    const date = readDay(v("date"));
    const repeatOn = readDay(v("repeat_on"));
    const found: Record<string, string | null> = {
      date: date ? null : strings.records.dateRequired,
      repeat_on: repeatOn === false ? strings.records.dateRequired : null,
    };
    let body: Record<string, unknown> = { date };
    if (kind === "vaccine") {
      const expiry = readMonth(v("lot_expiry"));
      const unchangedExpiry = record?.kind === "vaccine" && v("lot_expiry") === formatMonth(record.lot_expiry);
      found.diseases = diseases.length ? null : strings.records.diseasesRequired;
      found.lot_expiry = expiry === false && !unchangedExpiry ? strings.records.monthInvalid : null;
      body = {
        ...body,
        diseases,
        brand: v("brand").trim(),
        lot: v("lot").trim(),
        lot_expiry: unchangedExpiry && record?.kind === "vaccine" ? record.lot_expiry : expiry || "",
        repeat_on: repeatOn || null,
        repeat_on_origin: originOf(repeatOn || null),
        vet_name: v("vet_name").trim(),
        vet_crmv: v("vet_crmv").trim(),
      };
    } else if (kind === "antiparasitic") {
      const weight = v("weight_kg").trim() ? parseKg(v("weight_kg")) : null;
      found.weight_kg = v("weight_kg").trim() && !weight ? strings.records.kgInvalid : null;
      body = {
        ...body,
        parasite,
        product: v("product").trim(),
        dose: v("dose").trim(),
        repeat_on: repeatOn || null,
        repeat_on_origin: originOf(repeatOn || null),
        vet_name: v("vet_name").trim(),
        weight_kg: weight,
      };
    } else if (kind === "weight") {
      const kg = parseKg(v("kg"));
      found.kg = kg ? null : strings.records.kgInvalid;
      body = { ...body, kg };
    } else if (kind === "note") {
      found.text = v("text").trim() ? null : strings.records.textRequired;
      body = { ...body, text: v("text").trim() };
    } else {
      body = {
        ...body,
        clinic: v("clinic").trim(),
        vet_name: v("vet_name").trim(),
        reason: v("reason").trim(),
        notes: v("notes").trim(),
      };
    }
    setErrors(found);
    return Object.values(found).some(Boolean) ? null : { body };
  }

  async function submit() {
    const built = build();
    if (!built) return;
    setBusy(true);
    setFailure(null);
    try {
      let uploaded: string[] = [];
      if (files.length) {
        try {
          uploaded = (await uploadAttachments(animalId, files)).map((a) => a.id);
        } catch {
          setFailure(strings.records.uploadFailed);
          return;
        }
      }
      const attachmentIds = [...existing.map((a) => a.id), ...presetAttachments, ...uploaded];
      await saveRecord(kind, animalId, record?.id ?? null, {
        ...built.body,
        attachment_ids: attachmentIds,
      } as never);
      await refreshAnimal(queryClient);
      router.back();
    } catch {
      setFailure(strings.app.genericError);
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (!record) return;
    Alert.alert(strings.records.deleteConfirm, undefined, [
      { text: strings.app.cancel, style: "cancel" },
      {
        text: strings.app.delete,
        style: "destructive",
        onPress: async () => {
          try {
            await deleteRecord(record.kind, animalId, record.id);
            await refreshAnimal(queryClient);
            router.back();
          } catch {
            setFailure(strings.app.genericError);
          }
        },
      },
    ]);
  }

  const date = (
    <Field label={strings.records.date} error={errors.date}>
      <DateInput testID="date" value={v("date")} onChange={set("date")} invalid={!!errors.date} />
    </Field>
  );
  const repeatOn = (
    <Field
      label={strings.records.repeatOn}
      optional
      error={errors.repeat_on}
      hint={
        record && "repeat_on_origin" in record && record.repeat_on_origin === "inferred" && v("repeat_on") === dayText(record.repeat_on)
          ? strings.records.repeatInferred
          : v("repeat_on")
            ? undefined
            : strings.records.noRepeat
      }
    >
      <DateInput testID="repeat-on" value={v("repeat_on")} onChange={set("repeat_on")} invalid={!!errors.repeat_on} />
    </Field>
  );
  const text = (name: string, label: string, opts: { optional?: boolean; multiline?: boolean } = { optional: true }) => (
    <Field label={label} optional={opts.optional} error={errors[name]}>
      <Input testID={name} value={v(name)} onChangeText={set(name)} multiline={opts.multiline} invalid={!!errors[name]} />
    </Field>
  );

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Screen>
        {focus === "repeat_on" ? <Notice tone="soon">{strings.records.noRepeat}</Notice> : null}
        {date}
        {kind === "vaccine" ? (
          <>
            <Field label={strings.records.diseases} error={errors.diseases}>
              {catalog.isPending ? <Loading /> : null}
              <MultiSelect
                testID="diseases"
                value={diseases}
                onChange={setDiseases}
                options={diseasesOf(species).map((d) => ({ value: d.code, label: d.label }))}
              />
            </Field>
            {text("brand", strings.records.brand)}
            {text("lot", strings.records.lot)}
            <Field label={strings.records.lotExpiry} optional error={errors.lot_expiry}>
              <MonthInput testID="lot-expiry" value={v("lot_expiry")} onChange={set("lot_expiry")} invalid={!!errors.lot_expiry} />
            </Field>
            {repeatOn}
            {text("vet_name", strings.records.vet)}
            {text("vet_crmv", strings.records.crmv)}
          </>
        ) : null}
        {kind === "antiparasitic" ? (
          <>
            <Field label={strings.records.parasite}>
              <Segmented
                testID="parasite"
                value={parasite}
                onChange={setParasite}
                options={[
                  { value: "internal", label: "Verme interno" },
                  { value: "external", label: "Pulga e carrapato" },
                ]}
              />
            </Field>
            {text("product", strings.records.product)}
            {text("dose", strings.records.dose)}
            {repeatOn}
            {text("vet_name", strings.records.vet)}
            <Field label={strings.records.weightWithTreatment} error={errors.weight_kg}>
              <Input testID="weight_kg" value={v("weight_kg")} onChangeText={set("weight_kg")} keyboardType="decimal-pad" invalid={!!errors.weight_kg} />
            </Field>
          </>
        ) : null}
        {kind === "weight" ? (
          <Field label={strings.records.weightKg} error={errors.kg}>
            <Input testID="kg" value={v("kg")} onChangeText={set("kg")} keyboardType="decimal-pad" invalid={!!errors.kg} />
          </Field>
        ) : null}
        {kind === "note" ? text("text", strings.records.text, { multiline: true }) : null}
        {kind === "visit" ? (
          <>
            {text("clinic", strings.records.clinic)}
            {text("vet_name", strings.records.vet)}
            {text("reason", strings.records.reason)}
            {text("notes", strings.records.notes, { optional: true, multiline: true })}
          </>
        ) : null}
        {attachable ? (
          <Field label={kind === "visit" ? strings.records.attachments : strings.records.photo} optional>
            {presetAttachments.length ? <Notice>{strings.records.fromPhoto}</Notice> : null}
            <FilePicker
              files={files}
              onChange={setFiles}
              existing={existing}
              onRemoveExisting={(removed) => setExisting((list) => list.filter((a) => a.id !== removed))}
              allowPdf={kind === "visit"}
            />
          </Field>
        ) : null}
        {failure ? (
          <Text role="alert" className="text-late">
            {failure}
          </Text>
        ) : null}
        <View className="gap-2 pt-2">
          <Button size="lg" label={busy ? strings.app.saving : strings.app.save} busy={busy} onPress={submit} testID="save-record" />
          {record ? <Button variant="destructive" label={strings.app.delete} onPress={remove} testID="delete-record" /> : null}
        </View>
      </Screen>
    </>
  );
}
