/**
 * The API base. In production it is baked in at build time
 * (`.env.production`); in development it is the compose stack's port on the
 * page's own host, so the same dev server works from localhost and from the
 * machine's LAN address on a phone.
 */
const API_DEV_PORT = 8300;

export const API_URL: string =
  import.meta.env.VITE_API_URL ??
  `http://${typeof window === "undefined" ? "localhost" : window.location.hostname}:${API_DEV_PORT}`;
