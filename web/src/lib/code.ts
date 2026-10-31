/** allauth's reset code as typed: upper case, letters and digits, `XXXX-XXXX`. */
export function formatCode(text: string): string {
  const raw = text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}

export function isCode(text: string): boolean {
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(text);
}
