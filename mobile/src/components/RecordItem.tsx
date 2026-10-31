import type { AntiparasiticOut, NoteOut, VaccineOut, VisitOut, WeightOut } from "@pets/core/api/generated";
import { formatDate, formatKg, formatMonth, PARASITE_LABEL, RECORD_KIND_LABEL } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { View } from "react-native";

import { AttachmentList } from "@/components/Attachments";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Muted, Text } from "@/components/ui/text";

/** A record of the history; the API always sends its `kind`, the generated type leaves it optional. */
export type AnyRecord =
  | (VaccineOut & { kind: "vaccine" })
  | (AntiparasiticOut & { kind: "antiparasitic" })
  | (WeightOut & { kind: "weight" })
  | (NoteOut & { kind: "note" })
  | (VisitOut & { kind: "visit" });

function lines(record: AnyRecord, label: (code: string) => string): { title: string; details: string[] } {
  switch (record.kind) {
    case "vaccine":
      return {
        title: [RECORD_KIND_LABEL.vaccine, record.brand].filter(Boolean).join(" · "),
        details: [
          strings.records.against(record.diseases.map(label).join(", ")),
          record.lot ? strings.records.lotShort(record.lot) : "",
          record.lot_expiry ? `${strings.records.lotExpiry}: ${formatMonth(record.lot_expiry)}` : "",
          record.repeat_on
            ? strings.records.repeatOnShort(formatDate(record.repeat_on)) +
              (record.repeat_on_origin === "inferred" ? ` (${strings.records.repeatInferred})` : "")
            : strings.records.noRepeat,
          [record.vet_name, record.vet_crmv && `${strings.records.crmv} ${record.vet_crmv}`].filter(Boolean).join(" · "),
        ],
      };
    case "antiparasitic":
      return {
        title: [PARASITE_LABEL[record.parasite], record.product].filter(Boolean).join(" · "),
        details: [
          record.dose ? `${strings.records.dose}: ${record.dose}` : "",
          record.repeat_on ? strings.records.repeatOnShort(formatDate(record.repeat_on)) : strings.records.noRepeat,
          record.weight_kg ? strings.records.weightAlso(formatKg(record.weight_kg)) : "",
          record.vet_name,
        ],
      };
    case "weight":
      return { title: `${RECORD_KIND_LABEL.weight} · ${formatKg(record.kg)}`, details: [] };
    case "note":
      return { title: RECORD_KIND_LABEL.note, details: [record.text] };
    case "visit":
      return {
        title: [RECORD_KIND_LABEL.visit, record.clinic].filter(Boolean).join(" · "),
        details: [record.vet_name, record.reason && `${strings.records.reason}: ${record.reason}`, record.notes],
      };
  }
}

/** One line of the history: what it was, its details, its files, and who wrote it. */
export function RecordItem({
  record,
  label,
  editable,
  onEdit,
  onDelete,
}: {
  record: AnyRecord;
  label: (code: string) => string;
  editable: boolean;
  onEdit(): void;
  onDelete(): void;
}) {
  const { title, details } = lines(record, label);
  return (
    <Card className="gap-1.5 p-3" testID={`record-${record.id}`}>
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="flex-1 font-semibold">{title}</Text>
        <Muted>{formatDate(record.date)}</Muted>
      </View>
      {details.filter(Boolean).map((line, i) => (
        <Text key={i} className="text-sm">
          {line}
        </Text>
      ))}
      <AttachmentList attachments={record.attachments} />
      {record.created_by.email ? <Muted className="text-xs">{strings.records.by(record.created_by.email)}</Muted> : null}
      {editable ? (
        <View className="flex-row gap-2 pt-1">
          <Button size="sm" variant="outline" label={strings.app.edit} onPress={onEdit} testID={`edit-${record.id}`} />
          <Button size="sm" variant="destructive" label={strings.app.delete} onPress={onDelete} testID={`delete-${record.id}`} />
        </View>
      ) : null}
    </Card>
  );
}
