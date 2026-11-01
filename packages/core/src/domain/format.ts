/**
 * The domain as the screens say it, in pt-BR: ages, dates, badges, labels.
 * Pure functions, shared by the web and the native app.
 */

import type {
  AgeOut,
  AnimalOut,
  BadgeOut,
  BirthOut,
  ReminderOut,
} from "../generated/api/types.gen";

export type Species = AnimalOut["species"];

const pluralize = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** "2 anos e 3 meses", "cerca de 4 anos", "3 meses", "menos de 1 mês"; null when unknown. */
export function formatAge(age: AgeOut | null | undefined): string | null {
  if (!age) return null;
  const parts: string[] = [];
  if (age.years) parts.push(pluralize(age.years, "ano", "anos"));
  if (age.months) parts.push(pluralize(age.months, "mês", "meses"));
  const text =
    parts.join(" e ") || (age.months === null ? "menos de 1 ano" : "menos de 1 mês");
  return age.approximate ? `cerca de ${text}` : text;
}

/** An ISO day ("2026-11-06") as "06/11/2026". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

/** A label's lot expiry, "2027-09" as "09/2027"; other text as it came. */
export function formatMonth(value: string | null | undefined): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  return match ? `${match[2]}/${match[1]}` : value;
}

/** "06/11/2026" (or "6/11/26") as "2026-11-06"; null when it is not a day. */
export function parseDate(text: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text.trim());
  if (!match) return /^\d{4}-\d{2}-\d{2}$/.test(text.trim()) ? text.trim() : null;
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  const iso = `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  const parsed = new Date(`${iso}T12:00:00`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso
    ? null
    : iso;
}

/** Today in the device's own calendar, as an ISO day. */
export function todayIso(now: Date = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** The birth as the profile says it. */
export function formatBirth(birth: BirthOut): string {
  if (birth.precision === "unknown" || !birth.value) return "Desconhecido";
  if (birth.precision === "exact") return formatDate(birth.value);
  if (birth.precision === "month") {
    const [year, month] = birth.value.split("-");
    return `${MONTHS[Number(month) - 1]} de ${year} (aproximado)`;
  }
  return `${birth.value} (aproximado)`;
}

export const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export type BadgeTone = "ok" | "soon" | "late";

/** The card's badge: its text and its tone; null when there is nothing to say yet. */
export function badgeText(badge: BadgeOut): { text: string; tone: BadgeTone } | null {
  switch (badge.state) {
    case "overdue":
      return { text: "Atrasado", tone: "late" };
    case "due_soon": {
      const days = badge.days ?? 0;
      const text =
        days <= 0 ? "Vence hoje" : days === 1 ? "Vence amanhã" : `Vence em ${days} dias`;
      return { text, tone: "soon" };
    }
    case "up_to_date":
      return { text: "Em dia", tone: "ok" };
    default:
      return null;
  }
}

/** A reminder's state in words, from its days left. */
export function reminderText(
  reminder: Pick<ReminderOut, "state" | "days" | "due_on">,
): string {
  const days = reminder.days;
  switch (reminder.state) {
    case "no_date":
      return "Sem data: informe quando repetir";
    case "closed":
      return "Feito";
    case "suspended":
      return "Suspenso";
    case "overdue":
      return days === -1 ? "Atrasado há 1 dia" : `Atrasado há ${-(days ?? 0)} dias`;
    case "due":
      return "Vence hoje";
    default:
      if (days === 1) return "Vence amanhã";
      return `Vence em ${days} dias`;
  }
}

export function reminderTone(state: ReminderOut["state"]): BadgeTone | "none" {
  if (state === "overdue") return "late";
  if (state === "due" || state === "upcoming") return "soon";
  if (state === "scheduled" || state === "closed") return "ok";
  return "none";
}

export const SPECIES_LABEL: Record<Species, string> = { dog: "Cão", cat: "Gato" };
export const SEX_LABEL: Record<"male" | "female" | "", string> = {
  male: "Macho",
  female: "Fêmea",
  "": "Não informado",
};
export const ROLE_LABEL = { tutor: "Tutor", guest: "Convidado" } as const;
export const ARCHIVE_REASON_LABEL = {
  died: "Faleceu",
  rehomed: "Doado",
  other: "Outro motivo",
} as const;
export const PARASITE_LABEL = {
  internal: "Verme interno",
  external: "Pulga e carrapato",
} as const;
export const RECORD_KIND_LABEL = {
  vaccine: "Vacina",
  antiparasitic: "Antiparasitário",
  weight: "Peso",
  note: "Observação",
  visit: "Consulta ou exame",
} as const;

/** "4,9 kg" from the API's decimal string. */
export function formatKg(kg: string | number | null | undefined): string {
  if (kg === null || kg === undefined || kg === "") return "—";
  const value = Number(kg);
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg`;
}

/** A typed weight ("4,9" or "4.9") as the API's decimal string; null when not a weight. */
export function parseKg(text: string): string | null {
  const value = Number(text.trim().replace(",", "."));
  return Number.isFinite(value) && value > 0
    ? String(Math.round(value * 1000) / 1000)
    : null;
}
