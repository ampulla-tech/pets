import type { PendingVerification } from "@pets/core/identity";

/**
 * The account waiting for its e-mail code, between the sign-up (or sign-in)
 * screen and the code screen. Held in memory only: its flow token opens
 * nothing but the confirmation, and an app closed mid-way signs in again,
 * which e-mails a fresh code.
 */
let current: PendingVerification | null = null;

export const pendingVerification = {
  get: () => current,
  set(pending: PendingVerification) {
    current = pending;
  },
  clear() {
    current = null;
  },
};
