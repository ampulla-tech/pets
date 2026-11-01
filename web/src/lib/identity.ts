import { createIdentity } from "@pets/core/identity";
import { csrfToken } from "@/lib/csrf";
import { API_URL } from "@/lib/env";

/** allauth's "browser" client: the session is its cookie, writes carry CSRF (ADR-0002). */
export const identity = createIdentity({
  baseUrl: API_URL,
  client: "browser",
  csrfToken,
});
