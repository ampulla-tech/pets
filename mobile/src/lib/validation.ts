/** The checks a form makes before calling the API, with the shared messages. */

import { strings } from "@pets/core/strings";

export function emailError(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : strings.auth.invalidEmail;
}

export function passwordError(password: string): string | null {
  return password.length >= 8 ? null : strings.auth.shortPassword;
}

/** The reset code, typed with or without its dash: "abcd1234" counts as "ABCD-1234". */
export function normaliseCode(code: string): string | null {
  const plain = code.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{8}$/.test(plain) ? `${plain.slice(0, 4)}-${plain.slice(4)}` : null;
}
