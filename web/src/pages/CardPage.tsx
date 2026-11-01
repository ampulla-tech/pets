import { useState } from "react";
import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Image as ImageIcon, Loader2 } from "lucide-react";
import { apiFetch, cardPdfUrl } from "@pets/core/api";
import type { AttachmentOut, CardRowOut } from "@pets/core/api/generated";
import { getCardOptions } from "@pets/core/api/query";
import {
  formatAge,
  formatBirth,
  formatDate,
  SEX_LABEL,
  SPECIES_LABEL,
} from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { AnimalAvatar } from "@/components/AnimalAvatar";
import { EmptyText, ErrorState, Loading, Notice } from "@/components/Feedback";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

/** `/animais/:id/carteirinha`: what to show at the clinic's counter. */
export function CardPage() {
  const { id = "" } = useParams();
  const card = useQuery(getCardOptions({ path: { animal_id: id } }));
  const [downloading, setDownloading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [photo, setPhoto] = useState<{
    row: CardRowOut;
    attachment: AttachmentOut;
  } | null>(null);

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

  return (
    <Page title={C.title} back={`/animais/${id}`}>
      {card.isPending ? (
        <Loading />
      ) : card.isError ? (
        <ErrorState onRetry={() => void card.refetch()} />
      ) : (
        <>
          <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">
            <AnimalAvatar
              name={card.data.animal.name}
              species={card.data.animal.species}
              photoUrl={card.data.animal.photo_url}
              className="size-16"
            />
            <div className="min-w-0 text-sm">
              <p className="text-xl font-semibold">{card.data.animal.name}</p>
              <p className="text-muted-foreground">
                {[
                  SPECIES_LABEL[card.data.animal.species],
                  card.data.animal.breed,
                  card.data.animal.sex ? SEX_LABEL[card.data.animal.sex] : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="text-muted-foreground">
                {strings.animal.birth}: {formatBirth(card.data.animal.birth)}
                {formatAge(card.data.animal.age)
                  ? ` (${formatAge(card.data.animal.age)})`
                  : ""}
              </p>
              {card.data.animal.microchip ? (
                <p className="text-muted-foreground">
                  {strings.animal.microchip}: {card.data.animal.microchip}
                </p>
              ) : null}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{C.intro}</p>
          {card.data.rows.length === 0 ? (
            <EmptyText>{C.empty}</EmptyText>
          ) : (
            <ul className="flex flex-col gap-2">
              {card.data.rows.map((row) => (
                <li key={row.subject} className="rounded-2xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{C.against}</p>
                      <p className="font-semibold">{row.label}</p>
                    </div>
                    {row.photos[0] ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPhoto({ row, attachment: row.photos[0] })}
                      >
                        <ImageIcon />
                        {C.labelPhoto}
                      </Button>
                    ) : null}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">{C.lastDose}</dt>
                      <dd className="font-medium">{formatDate(row.last_date)}</dd>
                      {row.last_product ? (
                        <dd className="text-muted-foreground">{row.last_product}</dd>
                      ) : null}
                      {row.last_vet ? (
                        <dd className="text-muted-foreground">{row.last_vet}</dd>
                      ) : null}
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{C.nextDose}</dt>
                      <dd className="font-medium">
                        {row.next_on ? formatDate(row.next_on) : C.noDate}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
          {failed ? <Notice tone="error">{C.pdfFailed}</Notice> : null}
          <Button
            size="xl"
            onClick={() => void onDownload(card.data.animal.name)}
            disabled={downloading}
          >
            {downloading ? <Loader2 className="animate-spin" /> : <Download />}
            {downloading ? C.downloading : C.pdf}
          </Button>
        </>
      )}
      <Dialog
        open={photo !== null}
        onOpenChange={(open) => (open ? null : setPhoto(null))}
      >
        <DialogContent closeLabel={strings.app.close}>
          <DialogHeader>
            <DialogTitle>
              {C.labelPhoto}: {photo?.row.label}
            </DialogTitle>
          </DialogHeader>
          {photo ? (
            <img
              src={photo.attachment.url}
              alt={`${C.labelPhoto}: ${photo.row.label}`}
              className="max-h-[70dvh] w-full rounded-lg object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Page>
  );
}
