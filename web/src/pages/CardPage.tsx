import { useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Plus, Syringe } from "lucide-react";
import { apiFetch, cardPdfUrl } from "@pets/core/api";
import type { CardItemOut, CardSectionOut } from "@pets/core/api/generated";
import { getCardOptions } from "@pets/core/api/query";
import { animalLine, doseBadge, formatDate, ofAnimal } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { AnimalAvatar } from "@/components/AnimalAvatar";
import { ErrorState, Loading, Notice } from "@/components/Feedback";
import { Page, Section } from "@/components/Page";
import { RegisterSheet } from "@/components/RegisterSheet";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { editRecordPath } from "@/lib/types";

const C = strings.card;

/** The file name the server gives (`Content-Disposition`), or one of our own. */
function fileName(header: string | null, fallback: string) {
  const match = header ? /filename="?([^";]+)"?/i.exec(header) : null;
  return match?.[1] ?? fallback;
}

/** Fetch the PDF with the session and hand it to the browser as a download. */
export async function downloadCardPdf(animalId: string, animalName: string) {
  const response = await apiFetch(cardPdfUrl(animalId));
  if (!response.ok) throw new Error(`card.pdf ${response.status}`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName(
    response.headers.get("Content-Disposition"),
    `carteirinha-${animalName}.pdf`,
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * `/animais/:id/carteirinha`: everything recorded, like the paper card. A
 * section per kind, a line per record, the newest first; a line opens its
 * record, and the record comes back here.
 */
export function CardPage() {
  const { id = "" } = useParams();
  const card = useQuery(getCardOptions({ path: { animal_id: id } }));
  const [downloading, setDownloading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [registering, setRegistering] = useState(false);
  const here = `/animais/${id}/carteirinha`;

  async function onDownload(name: string) {
    setDownloading(true);
    setFailed(false);
    try {
      await downloadCardPdf(id, name);
    } catch {
      setFailed(true);
    } finally {
      setDownloading(false);
    }
  }

  const pdf =
    card.data && card.data.sections.length > 0 ? (
      <Button
        variant="ghost"
        className="h-10 px-2.5 text-sm font-semibold text-primary"
        onClick={() => void onDownload(card.data.animal.name)}
        disabled={downloading}
        aria-label={C.pdfLabel}
      >
        {downloading ? <Loader2 className="animate-spin" /> : <Download />}
        {downloading ? C.downloading : C.pdf}
      </Button>
    ) : null;

  return (
    <Page title={C.title} back={`/animais/${id}`} actions={pdf}>
      {card.isPending ? (
        <Loading />
      ) : card.isError ? (
        <ErrorState onRetry={() => void card.refetch()} />
      ) : (
        <>
          <div className="flex items-center gap-3.5">
            <AnimalAvatar
              name={card.data.animal.name}
              species={card.data.animal.species}
              photoUrl={card.data.animal.photo_url}
              initial
              className="size-12 rounded-[14px] text-lg"
            />
            <div className="min-w-0 text-sm">
              <p className="text-base font-semibold">{card.data.animal.name}</p>
              <p className="text-muted-foreground">
                {animalLine(card.data.animal, { sex: true })}
              </p>
              {card.data.animal.microchip ? (
                <p className="text-muted-foreground">
                  {C.microchip(card.data.animal.microchip)}
                </p>
              ) : null}
            </div>
          </div>
          {failed ? <Notice tone="error">{C.pdfFailed}</Notice> : null}
          {card.data.sections.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
              <span className="mb-1 flex size-16 items-center justify-center rounded-full bg-accent text-primary">
                <Syringe className="size-7" aria-hidden />
              </span>
              <p className="font-semibold">{C.empty}</p>
              <p className="text-sm text-muted-foreground">
                {C.emptyHint(ofAnimal(card.data.animal))}
              </p>
              {card.data.animal.status === "active" ? (
                <Button size="xl" className="mt-2" onClick={() => setRegistering(true)}>
                  <Plus />
                  {strings.animal.addRecord}
                </Button>
              ) : null}
            </div>
          ) : (
            card.data.sections.map((section) => (
              <CardSection
                key={section.kind}
                animalId={id}
                section={section}
                here={here}
              />
            ))
          )}
          <RegisterSheet
            animal={card.data.animal}
            open={registering}
            onClose={() => setRegistering(false)}
            back={here}
          />
        </>
      )}
    </Page>
  );
}

function CardSection({
  animalId,
  section,
  here,
}: {
  animalId: string;
  section: CardSectionOut;
  here: string;
}) {
  return (
    <Section title={C.sections[section.kind]} id={`card-${section.kind}`}>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {section.items.map((item) => (
          <li key={item.record_id}>
            {item.can_edit ? (
              <Link
                to={editRecordPath(animalId, item.record_id)}
                state={{ back: here }}
                className="block hover:bg-muted"
              >
                <CardLine kind={section.kind} item={item} />
              </Link>
            ) : (
              <CardLine kind={section.kind} item={item} />
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** One record: a dose like the label on the paper card, or a weight or a note. */
function CardLine({ kind, item }: { kind: CardSectionOut["kind"]; item: CardItemOut }) {
  const dose = kind === "vaccine" || kind === "antiparasitic";
  const old = dose && !item.current;
  if (kind === "weight" || kind === "note") {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "break-words",
              kind === "weight" ? "font-semibold" : "text-sm text-foreground",
            )}
          >
            {item.title}
          </p>
          {item.detail ? (
            <p
              className={cn(
                "text-muted-foreground",
                kind === "note" ? "text-xs" : "text-sm",
              )}
            >
              {item.detail}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {formatDate(item.date)}
        </span>
      </div>
    );
  }
  const badge = doseBadge(item);
  return (
    <div className="flex flex-col px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "min-w-0 break-words",
            old ? "font-medium text-muted-foreground" : "font-semibold",
          )}
        >
          {item.title}
        </span>
        <span
          className={cn(
            "shrink-0 text-sm tabular-nums",
            old ? "font-medium text-muted-foreground" : "font-semibold",
          )}
        >
          {formatDate(item.date)}
        </span>
      </div>
      {item.detail ? (
        <p className="text-[0.8rem] leading-snug text-muted-foreground">{item.detail}</p>
      ) : null}
      {dose && item.current ? (
        item.repeat_on ? (
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
            {C.repeatOn(formatDate(item.repeat_on))}
            {badge ? <StatusBadge tone={badge.tone}>{badge.text}</StatusBadge> : null}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{C.repeatNoDate}</p>
        )
      ) : null}
    </div>
  );
}
