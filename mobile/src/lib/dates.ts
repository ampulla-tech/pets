/** Typing dates on a phone keyboard: the digits, with the slashes put in as you go. */

import { formatDate, parseDate } from "@pets/core/domain";

/** "06112026" → "06/11/2026", as typed. */
export function maskDay(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** "092027" → "09/2027", as typed. */
export function maskMonth(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 6);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/** An ISO day as the field shows it; empty when there is none. */
export function dayText(iso: string | null | undefined): string {
  return iso ? formatDate(iso) : "";
}

/** The field's text as an ISO day: null when empty, false when not a day. */
export function readDay(text: string): string | null | false {
  if (!text.trim()) return null;
  return parseDate(text) ?? false;
}

/** "09/2027" as "2027-09": null when empty, false when not a month. */
export function readMonth(text: string): string | null | false {
  const value = text.trim();
  if (!value) return null;
  const match = /^(\d{1,2})\/(\d{4})$/.exec(value);
  if (!match) return /^\d{4}-\d{2}$/.test(value) ? value : false;
  const month = Number(match[1]);
  if (month < 1 || month > 12) return false;
  return `${match[2]}-${String(month).padStart(2, "0")}`;
}
