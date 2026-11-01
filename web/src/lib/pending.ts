import type { PendingVerification } from "@pets/core/identity";

// The account waiting for its e-mail code. It survives the tab going to the
// background while the person reads the e-mail, and dies with the tab; the
// flow itself is in allauth's session cookie.
const KEY = "pets.verify";

export const pendingVerification = {
  get(): PendingVerification | null {
    try {
      const raw = sessionStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as PendingVerification) : null;
    } catch {
      return null;
    }
  },
  set(pending: PendingVerification) {
    sessionStorage.setItem(KEY, JSON.stringify(pending));
  },
  clear() {
    sessionStorage.removeItem(KEY);
  },
};
