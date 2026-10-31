import { Cat, Dog } from "lucide-react";
import { strings } from "@pets/core/strings";
import { cn } from "@/lib/utils";

/** The animal's photo, or its species drawn, in a rounded square. */
export function AnimalAvatar({
  name,
  species,
  photoUrl,
  className,
}: {
  name: string;
  species: "dog" | "cat";
  photoUrl: string | null | undefined;
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
