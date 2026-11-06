import { useLocation } from "react-router";

/**
 * Where a screen opened from an animal goes back to: the screen that opened
 * it, when it said so in the navigation state (the card, Avisos), or else the
 * animal's profile.
 */
export function useBack(animalId: string): string {
  const state = useLocation().state as { back?: string } | null;
  return state?.back ?? `/animais/${animalId}`;
}
