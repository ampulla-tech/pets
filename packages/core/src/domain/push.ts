/**
 * The notification on one device, as the Avisos tab treats it. Each app works
 * out its own state; these rules decide what the tab shows for it.
 *
 * - `active`: this device is registered (a push subscription in this browser, a
 *   token for this phone). A permission granted alone is not active.
 * - `askable`: the permission can be asked.
 * - `ios-install`: an iPhone in Safari, outside the Home Screen: Safari pushes
 *   only to an installed site.
 * - `blocked`: the system denied the permission and will not ask again.
 * - `unsupported`: no push here, or none on the server (no VAPID key).
 */
import { strings } from "../strings";

export type DevicePush = "active" | "askable" | "ios-install" | "blocked" | "unsupported";

/** Which banner tops the list, given whether "Agora não" was tapped on this device. */
export function pushBanner(
  state: DevicePush | null,
  dismissed: boolean,
): "ask" | "install" | null {
  if (dismissed) return null;
  if (state === "askable") return "ask";
  if (state === "ios-install") return "install";
  return null;
}

/** Whether the ⋯ menu offers "Ativar notificações". */
export function canOfferPush(state: DevicePush | null): boolean {
  return state === "askable" || state === "ios-install" || state === "blocked";
}

export type UnblockPlatform = keyof typeof strings.push.unblockSteps;

/** A step in pieces; the odd pieces are names on the device's screens, in bold. */
export type Step = readonly string[];

export function unblockSteps(platform: UnblockPlatform): readonly Step[] {
  return strings.push.unblockSteps[platform];
}
