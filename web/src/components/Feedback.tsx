import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { strings } from "@pets/core/strings";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Loading({ label = strings.app.loading }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({
  message = strings.app.genericError,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          {strings.app.retry}
        </Button>
      ) : null}
    </div>
  );
}

/** An inline notice: neutral, a warning, or an error the screen announces. */
export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "warn" | "error" | "ok";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "rounded-lg px-3 py-2.5 text-sm",
        tone === "info" && "bg-muted text-foreground",
        tone === "warn" && "bg-soon-tint text-soon",
        tone === "error" && "bg-late-tint text-late",
        tone === "ok" && "bg-ok-tint text-ok",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function EmptyText({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
