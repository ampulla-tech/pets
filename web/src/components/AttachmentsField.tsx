import { useId, useRef, useState } from "react";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import type { AttachmentOut } from "@pets/core/api/generated";
import { uploadAttachments } from "@pets/core/api/generated";
import { strings } from "@pets/core/strings";
import { Button } from "@/components/ui/button";

export function isImage(attachment: Pick<AttachmentOut, "content_type">) {
  return attachment.content_type.startsWith("image/");
}

/** One attachment, opened in a new tab through its signed link. */
export function AttachmentLink({ attachment }: { attachment: AttachmentOut }) {
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="flex min-w-0 items-center gap-2 rounded-lg border bg-card p-1.5 pr-3 text-sm hover:bg-muted"
    >
      {isImage(attachment) ? (
        <img src={attachment.url} alt="" className="size-10 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
          <FileText className="size-5 text-muted-foreground" aria-hidden />
        </span>
      )}
      <span className="truncate">{attachment.name}</span>
    </a>
  );
}

/**
 * Photos and PDFs of a record: each file goes up as soon as it is picked
 * (`POST /animals/{id}/attachments`) and the record keeps the ids.
 */
export function AttachmentsField({
  animalId,
  value,
  onChange,
  accept = "image/*,application/pdf",
  label = strings.records.attachments,
  addLabel = strings.records.addAttachment,
}: {
  animalId: string;
  value: AttachmentOut[];
  onChange: (next: AttachmentOut[]) => void;
  accept?: string;
  label?: string;
  addLabel?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function upload(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    setFailed(false);
    try {
      const { data } = await uploadAttachments({
        path: { animal_id: animalId },
        body: { files },
        throwOnError: true,
      });
      onChange([...value, ...data]);
    } catch {
      setFailed(true);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">
        {label} <span className="font-normal text-muted-foreground">({strings.app.optional})</span>
      </span>
      {value.length ? (
        <ul className="flex flex-col gap-2">
          {value.map((attachment) => (
            <li key={attachment.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <AttachmentLink attachment={attachment} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={strings.records.removeAttachment(attachment.name)}
                onClick={() => onChange(value.filter((a) => a.id !== attachment.id))}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        ref={input}
        id={id}
        type="file"
        multiple
        accept={accept}
        className="sr-only"
        aria-label={addLabel}
        onChange={(event) => void upload(Array.from(event.target.files ?? []))}
      />
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="self-start"
        disabled={uploading}
        onClick={() => input.current?.click()}
      >
        {uploading ? <Loader2 className="animate-spin" /> : <Paperclip />}
        {uploading ? strings.records.uploading : addLabel}
      </Button>
      {failed ? <p className="text-sm text-destructive">{strings.records.uploadFailed}</p> : null}
    </div>
  );
}
