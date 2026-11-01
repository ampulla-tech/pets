/**
 * The calls that send files (multipart). React Native sends a file as a
 * `{ uri, name, type }` FormData part, which only its XMLHttpRequest knows how
 * to stream: the generated SDK would serialise the part as JSON, and the
 * runtime's fetch refuses it ("Unsupported FormDataPart implementation"). So
 * these go through XMLHttpRequest, with the session header the API client
 * would put on.
 */

import { apiBase, authHeaders } from "@pets/core/api";
import type { AnimalOut, AttachmentOut, ExtractionOut } from "@pets/core/api/generated";

/** A file picked on the phone, as React Native's FormData takes it. */
export interface PickedFile {
  uri: string;
  name: string;
  type: string;
}

function send(url: string, headers: Record<string, string>, form: FormData) {
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
    request.onload = () => resolve({ status: request.status, text: request.responseText });
    request.onerror = () => reject({ status: 0, detail: "network" });
    request.send(form);
  });
}

async function postFiles<T>(path: string, field: string, files: PickedFile[]): Promise<T> {
  const form = new FormData();
  for (const file of files) form.append(field, file as unknown as Blob);
  const { status, text } = await send(
    `${apiBase()}${path}`,
    { Accept: "application/json", ...authHeaders() },
    form,
  );
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // An empty body: the status says enough.
  }
  if (status < 200 || status >= 300) {
    const detail = typeof body === "object" && body !== null ? body : {};
    throw { ...detail, status };
  }
  return body as T;
}

/** Store photos or PDFs for an animal; their ids go in a record's `attachment_ids`. */
export function uploadAttachments(animalId: string, files: PickedFile[]) {
  return postFiles<AttachmentOut[]>(`/animals/${animalId}/attachments`, "files", files);
}

export function uploadAnimalPhoto(animalId: string, file: PickedFile) {
  return postFiles<AnimalOut>(`/animals/${animalId}/photo`, "file", [file]);
}

/** Send a card page's photos to be read (ADR-0005). */
export function sendExtraction(animalId: string, files: PickedFile[]) {
  return postFiles<ExtractionOut>(`/animals/${animalId}/extractions`, "files", files);
}
