import type { QueryClient } from "@tanstack/react-query";
import { identity } from "@/lib/identity";
import { disablePush } from "@/lib/push";
import { session } from "@/lib/session";

/** Sign out: drop this browser's push, end the session on the server, forget it here. */
export async function signOut(queryClient: QueryClient) {
  await disablePush();
  await identity.signOut().catch(() => undefined);
  session.clear();
  queryClient.clear();
}
