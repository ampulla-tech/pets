/**
 * Dragging a bottom sheet by its handle, the same rule on web and native.
 * Down, the sheet follows the finger; up, it resists, because a sheet sized to
 * its content has nowhere to grow. Let go past a quarter of its height, or
 * with a quick flick down, and it closes; otherwise it springs back.
 */

/** How far the sheet moves for a finger that moved `dy` (down is positive). */
export function sheetOffset(dy: number): number {
  return dy >= 0 ? dy : -Math.sqrt(-dy) * 2;
}

/** A flick faster than this (px per ms) closes the sheet however short it was. */
const FLICK = 0.5;
/** A drag past this share of the sheet's height closes it. */
const SHARE = 0.25;

/** Whether letting go after dragging `dy` at `velocity` (px/ms, down positive) closes it. */
export function sheetCloses(dy: number, velocity: number, height: number): boolean {
  if (dy <= 0) return false;
  return velocity > FLICK || dy > height * SHARE;
}
