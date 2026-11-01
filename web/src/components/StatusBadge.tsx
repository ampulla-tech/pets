import type { ReactNode } from "react";
import type { BadgeTone } from "@pets/core/domain";
import { cn } from "@/lib/utils";

const TONE: Record<BadgeTone | "none", string> = {
  ok: "bg-ok-tint text-ok",
  soon: "bg-soon-tint text-soon",
  late: "bg-late-tint text-late",
  none: "bg-muted text-muted-foreground",
};

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: BadgeTone | "none";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
