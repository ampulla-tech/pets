import { createIdentity } from "@pets/core/identity";
import { API_URL } from "@/lib/env";

export const identity = createIdentity({ baseUrl: API_URL });
