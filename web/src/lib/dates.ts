/** "2025-03" or "03/2025" as "2025-03"; null otherwise. */
export function monthValue(text: string): string | null {
  const value = text.trim();
  const iso = /^(\d{4})-(\d{2})$/.exec(value);
  if (iso && Number(iso[2]) >= 1 && Number(iso[2]) <= 12) return value;
  const br = /^(\d{1,2})\/(\d{4})$/.exec(value);
  if (br && Number(br[1]) >= 1 && Number(br[1]) <= 12)
    return `${br[2]}-${br[1].padStart(2, "0")}`;
  return null;
}
