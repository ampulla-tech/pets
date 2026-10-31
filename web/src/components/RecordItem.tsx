import { Link } from "react-router";
import { ClipboardList, NotebookPen, Pencil, Scale, ShieldPlus, Syringe } from "lucide-react";
import { formatDate, formatKg, formatMonth, PARASITE_LABEL, RECORD_KIND_LABEL } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { AttachmentLink } from "@/components/AttachmentsField";
import { editRecordPath, type RecordOut } from "@/lib/types";

const ICON = {
  vaccine: Syringe,
  antiparasitic: ShieldPlus,
  weight: Scale,
  note: NotebookPen,
  visit: ClipboardList,
} as const;

/** One record of the history, with what it says and its attachments. */
export function RecordItem({
  animalId,
  record,
  labels,
  editable,
}: {
  animalId: string;
  record: RecordOut;
  /** Disease code → label, from the catalog. */
  labels: Record<string, string>;
  editable: boolean;
}) {
  const kind = record.kind ?? "note";
  const Icon = ICON[kind];
  let title: string = RECORD_KIND_LABEL[kind];
  const lines: string[] = [];
  if (record.kind === "vaccine") {
    if (record.brand) title = `${title} · ${record.brand}`;
    lines.push(strings.records.against(record.diseases.map((code) => labels[code] ?? code).join(", ")));
    if (record.lot) lines.push(`${strings.records.lotShort(record.lot)}${record.lot_expiry ? ` · ${formatMonth(record.lot_expiry)}` : ""}`);
    lines.push(repeatLine(record.repeat_on, record.repeat_on_origin));
    const vet = [record.vet_name, record.vet_crmv].filter(Boolean).join(" · ");
    if (vet) lines.push(vet);
  } else if (record.kind === "antiparasitic") {
    if (record.product) title = `${title} · ${record.product}`;
    lines.push([PARASITE_LABEL[record.parasite], record.dose].filter(Boolean).join(" · "));
    lines.push(repeatLine(record.repeat_on, record.repeat_on_origin));
    if (record.vet_name) lines.push(record.vet_name);
    if (record.weight_kg) lines.push(strings.records.weightAlso(formatKg(record.weight_kg)));
  } else if (record.kind === "weight") {
    title = `${title} · ${formatKg(record.kg)}`;
  } else if (record.kind === "note") {
    lines.push(record.text);
  } else if (record.kind === "visit") {
    if (record.clinic) title = `${title} · ${record.clinic}`;
    for (const line of [record.reason, record.vet_name, record.notes]) if (line) lines.push(line);
  }

  return (
    <article className="flex gap-3 rounded-2xl border bg-card p-3" aria-label={`${title} ${formatDate(record.date)}`}>
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold break-words">{title}</h3>
            <p className="text-xs text-muted-foreground">
              {formatDate(record.date)}
              {record.created_by.email ? ` · ${strings.records.by(record.created_by.email)}` : ""}
            </p>
          </div>
          {editable ? (
            <Link
              to={editRecordPath(animalId, record.id)}
              aria-label={`${strings.app.edit}: ${title}`}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Pencil className="size-4" />
            </Link>
          ) : null}
        </div>
        {lines.map((line, i) => (
          <p key={i} className="text-sm whitespace-pre-line break-words text-foreground/90">
            {line}
          </p>
        ))}
        {record.attachments.length ? (
          <ul className="mt-1 flex flex-col gap-1.5">
            {record.attachments.map((attachment) => (
              <li key={attachment.id}>
                <AttachmentLink attachment={attachment} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

function repeatLine(repeatOn: string | null, origin: string) {
  if (!repeatOn) return strings.records.noRepeat;
  const text = strings.records.repeatOnShort(formatDate(repeatOn));
  return origin === "inferred" ? `${text} (${strings.records.repeatInferred})` : text;
}
