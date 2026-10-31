import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronLeft } from "lucide-react";
import { strings } from "@pets/core/strings";
import { cn } from "@/lib/utils";

/** A screen: a sticky top bar (back, title, actions) over a phone-width column. */
export function Page({
  title,
  back,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  /** Where the back arrow goes; no arrow when absent. */
  back?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-1 px-2">
          {back ? (
            <Link
              to={back}
              aria-label={strings.app.back}
              className="inline-flex size-10 items-center justify-center rounded-full text-foreground hover:bg-muted"
            >
              <ChevronLeft className="size-5" />
            </Link>
          ) : (
            <span className="w-2" />
          )}
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">{title}</h1>
          {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
        </div>
      </header>
      <main
        className={cn(
          "mx-auto flex max-w-xl flex-col gap-6 px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))]",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}

/** A titled block of a screen. */
export function Section({
  title,
  action,
  children,
  id,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="flex items-center justify-between gap-2">
        <h2
          id={id ? `${id}-title` : undefined}
          className="text-sm font-semibold tracking-wide text-muted-foreground uppercase"
        >
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
