import { createIdentity } from "@pets/core/identity";

import { API_URL } from "./env";

/** allauth's "app" client against this build's API (ADR-0002). */
export const identity = createIdentity({ baseUrl: API_URL, client: "app" });
