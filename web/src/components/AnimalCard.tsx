import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { badgeText, formatAge, SPECIES_LABEL } from "@pets/core/domain";
import type { AnimalOut } from "@/lib/types";
import { AnimalAvatar } from "./AnimalAvatar";
import { StatusBadge } from "./StatusBadge";

/**
 * An animal on the home or the archived list: photo, name, species and age,
 * and under them the badge of what is due, only when something is.
 */
export function AnimalCard({ animal, aside }: { animal: AnimalOut; aside?: ReactNode }) {
  const badge = animal.status === "active" ? badgeText(animal.badge) : null;
  const age = formatAge(animal.age);
  return (
    <Link
      to={`/animais/${animal.id}`}
      className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-xs transition-colors hover:bg-muted/60"
    >
      <AnimalAvatar
        name={animal.name}
        species={animal.species}
        photoUrl={animal.photo_url}
      />
      <div className="flex min-w-0 flex-1 flex-col items-start">
        <p className="max-w-full truncate text-base font-semibold">{animal.name}</p>
        <p className="max-w-full truncate text-sm text-muted-foreground">
          {[SPECIES_LABEL[animal.species], age].filter(Boolean).join(" · ")}
        </p>
        {aside ? (
          <p className="max-w-full truncate text-sm text-muted-foreground">{aside}</p>
        ) : null}
        {badge ? (
          <StatusBadge tone={badge.tone} className="mt-1.5">
            {badge.text}
          </StatusBadge>
        ) : null}
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
