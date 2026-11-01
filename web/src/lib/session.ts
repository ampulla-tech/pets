/**
 * Who is signed in. The session itself is allauth's cookie (ADR-0002), which
 * no script reads; the web keeps only the account's e-mail in localStorage, so
 * the first screen renders at once, and checks it against the server at start
 * (`sync`). A 401 from the API clears it.
 */
import { useSyncExternalStore } from "react";

export interface Account {
  email: string;
}

const KEY = "pets.session";

let current: Account | null = read();
const listeners = new Set<() => void>();

function read(): Account | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Account>;
    return parsed.email ? { email: parsed.email } : null;
  } catch {
    return null;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

export const session = {
  get(): Account | null {
    return current;
  },
  /** Signed in (sign-in, the e-mail confirmed, a new password). */
  set(next: Account) {
    current = { email: next.email };
    localStorage.setItem(KEY, JSON.stringify(current));
    emit();
  },
  clear() {
    if (current === null && localStorage.getItem(KEY) === null) return;
    current = null;
    localStorage.removeItem(KEY);
    emit();
  },
  /** Agree with the server: its session wins, whichever way. */
  async sync(check: () => Promise<Account | null>) {
    try {
      const account = await check();
      if (account) {
        if (account.email !== current?.email) session.set(account);
      } else session.clear();
    } catch {
      // Offline: keep what we knew; the next call to the API settles it.
    }
  },
  /** Re-read the storage (tests, and another tab signing in or out). */
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

export function useSession(): Account | null {
  return useSyncExternalStore(session.subscribe, session.get, session.get);
}
