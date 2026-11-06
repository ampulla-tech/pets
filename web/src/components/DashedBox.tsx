import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * An empty section that leads to what fills it: its text, and the button
 * centred below. The dashed border is drawn in SVG, because a CSS `dashed`
 * border cannot set the length of its dashes: 9 on, 7 off, 1.5 px, radius 16.
 */
export function DashedBox({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-2xl bg-card p-3 text-center",
        className,
      )}
    >
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full">
        {/* Twice the width, half of it clipped by the box: 1.5 px inside. */}
        <rect
          width="100%"
          height="100%"
          rx="16"
          ry="16"
          fill="none"
          stroke="var(--input)"
          strokeWidth="3"
          strokeDasharray="9 7"
          strokeLinecap="round"
        />
      </svg>
      <p className="text-sm text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}
