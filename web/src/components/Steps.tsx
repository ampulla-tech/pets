import { Share } from "lucide-react";
import type { Step } from "@pets/core/domain";
import { cn } from "@/lib/utils";

/**
 * Numbered steps, each in its own block, the number in a green circle and the
 * names on the device's screens in bold (the odd pieces of a step). `share`
 * draws Safari's share icon after the first bold name of the first step.
 */
export function Steps({
  steps,
  share = false,
  className,
}: {
  steps: readonly Step[];
  share?: boolean;
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col gap-2", className)}>
      {steps.map((pieces, index) => (
        <li
          key={index}
          className="flex items-start gap-2.5 rounded-lg bg-muted px-2.5 py-2 text-sm leading-snug text-foreground"
        >
          <span
            aria-hidden
            className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
          >
            {index + 1}
          </span>
          <span>
            {pieces.map((piece, i) =>
              i % 2 === 1 ? (
                <b key={i} className="font-semibold">
                  {piece}
                  {share && index === 0 && i === 1 ? (
                    <Share
                      className="ml-1 inline size-3.5 align-[-2px] text-primary"
                      aria-hidden
                    />
                  ) : null}
                </b>
              ) : (
                piece
              ),
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
