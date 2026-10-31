/**
 * Opening and sharing what the API serves outside JSON: an attachment through
 * its signed link, and the card PDF, which needs the session header and so is
 * downloaded into the cache before the share sheet opens.
 */

import { authHeaders, cardPdfUrl } from "@pets/core/api";
import type { AttachmentOut } from "@pets/core/api/generated";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";

export function isPdf(attachment: Pick<AttachmentOut, "content_type" | "name">) {
  return attachment.content_type === "application/pdf" || /\.pdf$/i.test(attachment.name);
}

/** A PDF opens in the in-app browser; a photo opens in the app's own viewer. */
export async function openInBrowser(url: string) {
  await WebBrowser.openBrowserAsync(url);
}

function fileName(animalName: string) {
  const slug = animalName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `carteirinha-${slug || "animal"}.pdf`;
}

/** Download the card PDF with the session and open the share sheet on it. */
export async function shareCardPdf(animalId: string, animalName: string, dialogTitle: string) {
  const folder = new Directory(Paths.cache, "cards");
  if (!folder.exists) folder.create({ intermediates: true });
  const destination = new File(folder, fileName(animalName));
  if (destination.exists) destination.delete();
  const file = await File.downloadFileAsync(cardPdfUrl(animalId), destination, {
    headers: authHeaders(),
    idempotent: true,
  });
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle,
  });
}
