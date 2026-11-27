import type { ConfirmIn, ProposalOut } from "@pets/core/api/generated";
import { formatMonth, parseKg, RECORD_KIND_LABEL } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { useState } from "react";
import { View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateInput, MonthInput } from "@/components/ui/date-input";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MultiSelect, Segmented } from "@/components/ui/segmented";
import { Text } from "@/components/ui/text";
import { dayText, readDay, readMonth } from "@/lib/dates";

type Field = { value: string | null; read: boolean };

const text = (field: Field) => (field.read && field.value ? field.value : "");
const unread = (field: { read: boolean }) => (field.read ? undefined : strings.intake.unread);

/**
 * One line the reading proposed. Each field comes as `{value, read}`: an unread
 * field shows empty and marked, an inferred "repeat on" says so. Nothing is
 * written until the tutor taps confirm.
 */
export function ProposalCard({
  proposal,
  diseases,
  onConfirm,
  onDiscard,
}: {
  proposal: ProposalOut;
  diseases: { value: string; label: string }[];
  onConfirm(record: ConfirmIn["record"]): Promise<void>;
  onDiscard(): Promise<void>;
}) {
  const p = proposal;
  const n = p.index + 1;
  const [date, setDate] = useState(p.date.read && p.date.value ? dayText(p.date.value) : "");
  const [brand, setBrand] = useState(text(p.brand));
  const [lot, setLot] = useState(text(p.lot));
  const [lotExpiry, setLotExpiry] = useState(p.lot_expiry.read && p.lot_expiry.value ? formatMonth(p.lot_expiry.value) : "");
  const [codes, setCodes] = useState<string[]>(p.diseases.read ? p.diseases.value : []);
  const [parasite, setParasite] = useState<"internal" | "external">(
    p.diseases.value.includes("external") ? "external" : "internal",
  );
  const [repeatOn, setRepeatOn] = useState(p.repeat_on.read && p.repeat_on.value ? dayText(p.repeat_on.value) : "");
  const [vet, setVet] = useState(text(p.vet_name));
  const [crmv, setCrmv] = useState(text(p.vet_crmv));
  const [dose, setDose] = useState(text(p.dose));
  const [kg, setKg] = useState(
    p.weight_kg.read && p.weight_kg.value !== null ? String(p.weight_kg.value).replace(".", ",") : "",
  );
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState<"confirm" | "discard" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  if (p.review !== "pending") {
    return (
      <Card className="flex-row items-center justify-between p-3" testID={`proposal-${n}`}>
        <Text className="font-medium">{strings.intake.lineTitle(n, RECORD_KIND_LABEL[p.kind])}</Text>
        <Badge
          text={p.review === "confirmed" ? strings.intake.confirmed : strings.intake.discarded}
          tone={p.review === "confirmed" ? "ok" : "none"}
        />
      </Card>
    );
  }

  const inferred = p.repeat_on.origin === "inferred" && repeatOn === dayText(p.repeat_on.value);

  function build(): ConfirmIn["record"] | null {
    const day = readDay(date);
    const next = readDay(repeatOn);
    const weight = kg.trim() ? parseKg(kg) : null;
    const expiry = readMonth(lotExpiry);
    const found: Record<string, string | null> = {
      date: day ? null : strings.records.dateRequired,
      repeat_on: next === false ? strings.records.dateRequired : null,
      kg: (p.kind === "weight" && !weight) || (kg.trim() && !weight) ? strings.records.kgInvalid : null,
      diseases: p.kind === "vaccine" && codes.length === 0 ? strings.records.diseasesRequired : null,
      lot_expiry: p.kind === "vaccine" && expiry === false ? strings.records.monthInvalid : null,
    };
    setErrors(found);
    if (Object.values(found).some(Boolean) || !day) return null;
    const origin = next ? (next === p.repeat_on.value && p.repeat_on.origin ? p.repeat_on.origin : "written") : "";
    if (p.kind === "vaccine") {
      return {
        kind: "vaccine",
        date: day,
        diseases: codes as never,
        brand: brand.trim(),
        lot: lot.trim(),
        lot_expiry: expiry || "",
        repeat_on: next || null,
        repeat_on_origin: origin,
        vet_name: vet.trim(),
        vet_crmv: crmv.trim(),
      };
    }
    if (p.kind === "antiparasitic") {
      return {
        kind: "antiparasitic",
        date: day,
        parasite,
        product: brand.trim(),
        dose: dose.trim(),
        repeat_on: next || null,
        repeat_on_origin: origin,
        vet_name: vet.trim(),
        weight_kg: weight,
      };
    }
    return { kind: "weight", date: day, kg: weight! };
  }

  async function confirm() {
    const record = build();
    if (!record) return;
    setBusy("confirm");
    setFailure(null);
    try {
      await onConfirm(record);
    } catch {
      setFailure(strings.app.genericError);
    } finally {
      setBusy(null);
    }
  }

  async function discard() {
    setBusy("discard");
    setFailure(null);
    try {
      await onDiscard();
    } catch {
      setFailure(strings.app.genericError);
    } finally {
      setBusy(null);
    }
  }

  const textField = (label: string, value: string, set: (t: string) => void, source: { read: boolean }, id: string) => (
    <Field label={label} hint={unread(source)}>
      <Input testID={`${id}-${n}`} value={value} onChangeText={set} className={source.read ? "" : "border-soon"} />
    </Field>
  );

  return (
    <Card className="gap-3" testID={`proposal-${n}`}>
      <Text className="font-semibold">{strings.intake.lineTitle(n, RECORD_KIND_LABEL[p.kind])}</Text>
      <Field label={strings.records.date} required hint={unread(p.date)} error={errors.date}>
        <DateInput testID={`date-${n}`} value={date} onChange={setDate} invalid={!!errors.date} />
      </Field>
      {p.kind === "vaccine" ? (
        <>
          <Field label={strings.records.diseases} required hint={unread(p.diseases)} error={errors.diseases}>
            <MultiSelect value={codes} onChange={setCodes} options={diseases} testID={`diseases-${n}`} />
          </Field>
          {textField(strings.records.brand, brand, setBrand, p.brand, "brand")}
          {textField(strings.records.lot, lot, setLot, p.lot, "lot")}
          <Field label={strings.records.lotExpiry} hint={unread(p.lot_expiry)} error={errors.lot_expiry}>
            <MonthInput testID={`lot-expiry-${n}`} value={lotExpiry} onChange={setLotExpiry} />
          </Field>
        </>
      ) : null}
      {p.kind === "antiparasitic" ? (
        <>
          <Field label={strings.records.parasite} required>
            <Segmented
              value={parasite}
              onChange={setParasite}
              options={[
                { value: "internal", label: "Verme interno" },
                { value: "external", label: "Pulga e carrapato" },
              ]}
            />
          </Field>
          {textField(strings.records.product, brand, setBrand, p.brand, "product")}
          {textField(strings.records.dose, dose, setDose, p.dose, "dose")}
        </>
      ) : null}
      {p.kind !== "weight" ? (
        <>
          <Field
            label={strings.records.repeatOn}
            hint={inferred ? strings.records.repeatInferred : unread(p.repeat_on)}
            error={errors.repeat_on}
          >
            <DateInput testID={`repeat-on-${n}`} value={repeatOn} onChange={setRepeatOn} invalid={!!errors.repeat_on} />
          </Field>
          {textField(strings.records.vet, vet, setVet, p.vet_name, "vet")}
          {p.kind === "vaccine" ? textField(strings.records.crmv, crmv, setCrmv, p.vet_crmv, "crmv") : null}
        </>
      ) : null}
      {p.kind !== "vaccine" ? (
        <Field
          label={p.kind === "weight" ? strings.records.weightKg : strings.records.weightWithTreatment}
          required={p.kind === "weight"}
          hint={unread(p.weight_kg)}
          error={errors.kg}
        >
          <Input testID={`kg-${n}`} value={kg} onChangeText={setKg} keyboardType="decimal-pad" />
        </Field>
      ) : null}
      {failure ? (
        <Text role="alert" className="text-late">
          {failure}
        </Text>
      ) : null}
      <View className="flex-row gap-2">
        <Button className="flex-1" label={strings.intake.confirmLine} busy={busy === "confirm"} onPress={confirm} testID={`confirm-${n}`} />
        <Button className="flex-1" variant="outline" label={strings.intake.discardLine} busy={busy === "discard"} onPress={discard} testID={`discard-${n}`} />
      </View>
    </Card>
  );
}
