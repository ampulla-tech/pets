import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { sheetCloses, sheetOffset } from "@pets/core/domain";
import { cn } from "@/lib/utils";

/** Where a drag by the handle started, and the latest sample for its speed. */
type Drag = { startY: number; lastY: number; lastT: number; velocity: number };

/**
 * A sheet from the bottom of the screen, with a grab handle and its title. It
 * slides up when it opens and down when it closes; dragging the handle moves
 * it with the finger, and letting go far enough down (or with a flick) closes
 * it, otherwise it settles back. Tapping the backdrop or Esc also closes it.
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
  const content = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Each opening starts where the sheet rests.
  useEffect(() => {
    if (open) setOffset(0);
  }, [open]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = {
      startY: event.clientY,
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocity: 0,
    };
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const dt = event.timeStamp - d.lastT;
    if (dt > 0) d.velocity = (event.clientY - d.lastY) / dt;
    d.lastY = event.clientY;
    d.lastT = event.timeStamp;
    setOffset(sheetOffset(event.clientY - d.startY));
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    const dy = event.clientY - d.startY;
    const height = content.current?.offsetHeight ?? 0;
    // Closing keeps the dragged offset: the exit animation slides on from it.
    if (sheetCloses(dy, d.velocity, height)) onClose();
    else setOffset(0);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          ref={content}
          // No description is the common case here; without this Radix points
          // the dialog at an element that does not exist.
          aria-describedby={undefined}
          style={{
            transform: offset ? `translateY(${offset}px)` : undefined,
            transition: dragging ? "none" : "transform 200ms ease-out",
          }}
          className={cn(
            "fixed bottom-0 left-0 z-50 grid max-h-[calc(100dvh-2rem)] w-full gap-3 overflow-y-auto rounded-t-2xl border-t bg-background px-5 pb-[calc(1.75rem+env(safe-area-inset-bottom))] shadow-lg ease-out data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=closed]:duration-200 data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-300 motion-reduce:animate-none sm:left-1/2 sm:max-w-xl sm:-translate-x-1/2",
            className,
          )}
        >
          {/* The handle's hit area is the whole strip above the title. */}
          <div
            data-testid="sheet-handle"
            aria-hidden
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="-mx-5 -mb-3 flex h-[30px] cursor-grab touch-none items-center justify-center active:cursor-grabbing"
          >
            <span className="h-1.5 w-10 rounded-full bg-border" />
          </div>
          <DialogPrimitive.Title className="text-base font-semibold tracking-tight">
            {title}
          </DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
