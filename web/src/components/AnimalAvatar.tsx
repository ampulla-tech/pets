import { Cat, Dog } from "lucide-react";
import { strings } from "@pets/core/strings";
import { cn } from "@/lib/utils";

/**
 * The animal's photo in a rounded square; with none, its species drawn, or
 * (`initial`) the first letter of its name.
 */
export function AnimalAvatar({
  name,
  species,
  photoUrl,
  initial,
  className,
}: {
  name: string;
  species: "dog" | "cat";
  photoUrl: string | null | undefined;
  initial?: boolean;
  className?: string;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={strings.animal.photoAlt(name)}
        className={cn("size-14 shrink-0 rounded-2xl object-cover", className)}
      />
    );
  }
  if (initial) {
    return (
      <div
        aria-hidden
        className={cn(
          "flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent font-bold text-primary",
          className,
        )}
      >
        {name.trim().charAt(0).toUpperCase()}
      </div>
    );
  }
  const Icon = species === "cat" ? Cat : Dog;
  return (
    <div
      aria-hidden
      className={cn(
        "flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground",
        className,
      )}
    >
      <Icon className="size-1/2" strokeWidth={1.6} />
    </div>
  );
}
