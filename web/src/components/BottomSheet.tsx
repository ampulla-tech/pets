import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * A sheet from the bottom of the screen: the app's dialog anchored at the
 * bottom, with a grab handle and its title. Tapping the backdrop closes it.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "top-auto bottom-0 left-0 w-full max-w-none translate-x-0 translate-y-0 gap-3 rounded-t-2xl rounded-b-none border-x-0 border-b-0 px-5 pt-3 pb-[calc(1.75rem+env(safe-area-inset-bottom))] sm:left-1/2 sm:max-w-xl sm:-translate-x-1/2",
          className,
        )}
      >
        <span
          aria-hidden
          className="h-1.5 w-10 justify-self-center rounded-full bg-border"
        />
        <DialogTitle className="text-base">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
