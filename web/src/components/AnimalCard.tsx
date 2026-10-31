import type { ReactNode } from "react";
import { Link } from "react-router";
import { badgeText, formatAge, SPECIES_LABEL } from "@pets/core/domain";
import type { AnimalOut } from "@/lib/types";
import { AnimalAvatar } from "./AnimalAvatar";
import { StatusBadge } from "./StatusBadge";

/** An animal on the home or the archived list: photo, name, age and badge. */
export function AnimalCard({ animal, aside }: { animal: AnimalOut; aside?: ReactNode }) {
  const badge = badgeText(animal.badge);
  const age = formatAge(animal.age);
  return (
    <Link
      to={`/animais/${animal.id}`}
      className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-xs transition-colors hover:bg-muted/60"
    >
      <AnimalAvatar name={animal.name} species={animal.species} photoUrl={animal.photo_url} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold">{animal.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {[SPECIES_LABEL[animal.species], age].filter(Boolean).join(" · ")}
        </p>
        {aside ? <p className="truncate text-sm text-muted-foreground">{aside}</p> : null}
      </div>
      {badge && animal.status === "active" ? <StatusBadge tone={badge.tone}>{badge.text}</StatusBadge> : null}
    </Link>
  );
}
