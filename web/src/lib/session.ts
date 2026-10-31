/**
 * The signed-in session: allauth's session token and the account's e-mail,
 * kept in localStorage (ADR-0002) and read by React through a tiny store.
 */
import { useSyncExternalStore } from "react";
import type { Session } from "@pets/core/identity";

const KEY = "pets.session";

let current: Session | null = read();
const listeners = new Set<() => void>();

function read(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    return parsed.token ? { token: parsed.token, email: parsed.email ?? "" } : null;
  } catch {
    return null;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

export const session = {
  get(): Session | null {
    return current;
  },
  token(): string | null {
    return current?.token ?? null;
  },
  set(next: Session) {
    current = next;
    localStorage.setItem(KEY, JSON.stringify(next));
    emit();
  },
  clear() {
    current = null;
    localStorage.removeItem(KEY);
    emit();
  },
  /** Re-read the storage (tests, and another tab signing out). */
  reload() {
    current = read();
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === KEY) session.reload();
  });
}

export function useSession(): Session | null {
  return useSyncExternalStore(session.subscribe, session.get, session.get);
}
