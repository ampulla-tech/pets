import type { AnimalOut, CardItemOut } from "../generated/api/types.gen";
import type { BadgeTone } from "./format";

/**
 * The badge of a current dose on the card, by the home badge's rule: due
 * within 30 days ("Vence hoje", "Vence em 6 dias") or late ("Atrasado"). Null
 * for an old dose, a dose with no date and one further away: the colour shows
 * only what needs care.
 */
export function doseBadge(
  item: Pick<CardItemOut, "current" | "state" | "due_in_days">,
): { text: string; tone: BadgeTone } | null {
  if (!item.current) return null;
  if (item.state === "overdue") return { text: "Atrasado", tone: "late" };
  if (item.state !== "due_soon") return null;
  const days = item.due_in_days ?? 0;
  const text =
    days <= 0 ? "Vence hoje" : days === 1 ? "Vence amanhã" : `Vence em ${days} dias`;
  return { text, tone: "soon" };
}

/** "da Nina", "do Thor", "de Bug" (sex not told): the animal after "of". */
export function ofAnimal(animal: Pick<AnimalOut, "name" | "sex">): string {
  const article = animal.sex === "female" ? "da" : animal.sex === "male" ? "do" : "de";
  return `${article} ${animal.name}`;
}
