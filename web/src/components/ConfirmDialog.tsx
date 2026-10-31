import type { ReactNode } from "react";
import { strings } from "@pets/core/strings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** A question with two named answers; the confirm runs `onConfirm`. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
  busy?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{strings.app.cancel}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={(event) => {
              // The caller closes the dialog when its work is done.
              event.preventDefault();
              onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
