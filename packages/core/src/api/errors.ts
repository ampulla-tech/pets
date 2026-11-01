/**
 * Reading what went wrong with a call: the status, and the machine-readable
 * `code` the API puts on the errors a screen must tell apart (an expired
 * invite, a last tutor leaving).
 */

export type ApiErrorCode =
  "invite_expired" | "invite_used" | "already_member" | "last_tutor";

export interface ApiFailure {
  status: number;
  code: ApiErrorCode | null;
  detail: string | null;
}

/** What the generated client throws (its error body), read into one shape. */
export function readFailure(error: unknown): ApiFailure {
  const body = (error ?? {}) as { code?: unknown; detail?: unknown; status?: unknown };
  const code = typeof body.code === "string" ? (body.code as ApiErrorCode) : null;
  const detail = typeof body.detail === "string" ? body.detail : null;
  const status = typeof body.status === "number" ? body.status : 0;
  return { status, code, detail };
}
