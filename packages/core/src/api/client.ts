/**
 * The generated API client, configured for one app.
 *
 * `configureApi` points the generated fetch client at the API's base URL and
 * picks how the session travels (allauth's, ADR-0002):
 *
 * - the native app passes `token()`: the session token goes on every call as
 *   `X-Session-Token`;
 * - the web passes `csrfToken()`: every call carries the cookies (allauth's
 *   session cookie), and every write sends the CSRF cookie back as
 *   `X-CSRFToken`.
 *
 * A 401 means the session is gone: `onUnauthorized` lets the app sign out.
 * `apiFetch` makes a call the generated client does not (the card's PDF) the
 * same way.
 */

import { client } from "../generated/api/client.gen";

export interface ApiConfig {
  /** The API's base URL: `https://api.pets.ampulla.tech`, or the dev stack's. */
  baseUrl: string;
  /** Native: the session token held now, or null when signed out. */
  token?(): string | null;
  /** Web: the CSRF cookie's value now. Its presence makes the session a cookie. */
  csrfToken?(): string | null;
  /** Called when the API answers 401 to a call made with a session. */
  onUnauthorized?(): void;
}

let current: ApiConfig | null = null;
let errorInterceptor: number | null = null;

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/** A call to the API with the configured session, as the generated client makes it. */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (!current) throw new Error("configureApi was not called");
  const config = current;
  const cookie = Boolean(config.csrfToken);
  const request = new Request(input, cookie ? { ...init, credentials: "include" } : init);
  const token = cookie ? null : (config.token?.() ?? null);
  if (token) request.headers.set("X-Session-Token", token);
  if (cookie && !SAFE.has(request.method)) {
    const csrf = config.csrfToken!();
    if (csrf) request.headers.set("X-CSRFToken", csrf);
  }
  const response = await fetch(request);
  if (response.status === 401 && (cookie || token)) config.onUnauthorized?.();
  return response;
}

export function configureApi(config: ApiConfig) {
  current = config;
  // A failed call throws its body with the status beside it, so a screen can
  // tell a 404 from a 409 (readFailure).
  if (errorInterceptor !== null) client.interceptors.error.eject(errorInterceptor);
  errorInterceptor = client.interceptors.error.use((error, response) => {
    const body = typeof error === "object" && error !== null ? error : { detail: error };
    return { ...body, status: response?.status ?? 0 };
  });
  client.setConfig({
    baseUrl: config.baseUrl,
    throwOnError: true,
    fetch: apiFetch,
  });
  return client;
}

/** The native app's session header, for an upload the generated client does not make. */
export function authHeaders(): Record<string, string> {
  const token = current?.token?.();
  return token ? { "X-Session-Token": token } : {};
}

/** The API base the app configured. */
export function apiBase(): string {
  if (!current) throw new Error("configureApi was not called");
  return current.baseUrl;
}

/** The address of an animal's card PDF (served outside the OpenAPI document). */
export function cardPdfUrl(animalId: string): string {
  return `${apiBase()}/animals/${animalId}/card.pdf`;
}

export { client };
