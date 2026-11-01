/**
 * The CSRF cookie Django sets with every allauth answer (ADR-0002). The web
 * sends it back as `X-CSRFToken` on every write. Locally the API's cookies are
 * host-only, and a port does not separate cookies, so the page on :5180 reads
 * what the API on :8300 set; in production the API sets it for
 * `pets.ampulla.tech`, the web app's own host.
 */
export const CSRF_COOKIE = "csrftoken";

export function readCookie(
  name: string,
  cookies: string = document.cookie,
): string | null {
  for (const part of cookies.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export function csrfToken(): string | null {
  return readCookie(CSRF_COOKIE);
}
