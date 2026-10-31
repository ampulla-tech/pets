/**
 * The generated API client, configured for one app.
 *
 * `configureApi` points the generated fetch client at the API's base URL and
 * puts the session token (allauth's, ADR-0002) on every call as
 * `X-Session-Token`. A 401 means the session is gone: `onUnauthorized` lets the
 * app sign out.
 */

import { client } from "../generated/api/client.gen";

export interface ApiConfig {
  /** The API's base URL: `https://api.pets.ampulla.tech`, or the dev stack's. */
  baseUrl: string;
  /** The session token held now, or null when signed out. */
  token(): string | null;
  /** Called when the API answers 401 to a call that carried a token. */
  onUnauthorized?(): void;
}

let current: ApiConfig | null = null;
let errorInterceptor: number | null = null;

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
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const token = config.token();
      if (token) request.headers.set("X-Session-Token", token);
      const response = await fetch(request);
      if (response.status === 401 && token) config.onUnauthorized?.();
      return response;
    },
  });
  return client;
}

/** The session header, for a call the generated client does not make (the PDF). */
export function authHeaders(): Record<string, string> {
  const token = current?.token();
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
