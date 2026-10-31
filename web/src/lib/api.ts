/**
 * The generated API client, pointed at the API with the session token, and the
 * query client every screen shares.
 */
import { QueryClient } from "@tanstack/react-query";
import { configureApi } from "@pets/core/api";
import { API_URL } from "@/lib/env";
import { session } from "@/lib/session";

export function setUpApi() {
  configureApi({
    baseUrl: API_URL,
    token: () => session.token(),
    // The session is gone on the server: sign out here too.
    onUnauthorized: () => session.clear(),
  });
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 },
      mutations: { retry: false },
    },
  });
}
