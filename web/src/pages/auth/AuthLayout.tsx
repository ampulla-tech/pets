import type { ReactNode } from "react";
import { PawPrint } from "lucide-react";
import { strings } from "@pets/core/strings";

/** The signed-out screens: the mark, the title and one card. */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <PawPrint className="size-7" aria-hidden />
          </span>
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">{strings.app.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-xs">{children}</div>
      </div>
    </div>
  );
}
