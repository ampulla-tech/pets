/**
 * Expo push (ADR-0004): ask the permission, get this phone's Expo
 * push token, register it with the API, and forget it at sign-out.
 *
 * The token needs the EAS project id; a build without one (a local dev build)
 * skips the registration and the reminders still arrive by e-mail.
 */

import { registerExpoToken, removeExpoToken } from "@pets/core/api/generated";
import type { DevicePush, UnblockPlatform } from "@pets/core/domain";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { easProjectId } from "./env";

const TOKEN_KEY = "pets.expoPushToken";
const NOT_NOW_KEY = "pets.push.notNow";

export type PushOutcome = "registered" | "denied" | "skipped" | "failed";

export type PushPermission = "granted" | "denied" | "undetermined";

/** Show a notice that arrives with the app open, like one in the background. */
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === "android") {
    void Notifications.setNotificationChannelAsync("default", {
      name: "Lembretes",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export async function pushPermission(): Promise<PushPermission> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted"
    ? "granted"
    : status === "denied"
      ? "denied"
      : "undetermined";
}

/**
 * This phone's notification state, as the Avisos tab shows it. Only a
 * registered token is `active`; a permission granted alone is not.
 */
export async function devicePush(): Promise<DevicePush> {
  if (Platform.OS === "web" || !Device.isDevice || !easProjectId()) return "unsupported";
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status === "granted") {
    return (await SecureStore.getItemAsync(TOKEN_KEY)) ? "active" : "askable";
  }
  if (permission.status === "undetermined" || permission.canAskAgain) return "askable";
  return "blocked";
}

/** Whose settings the unblock steps walk through. */
export function unblockPlatform(): UnblockPlatform {
  return Platform.OS === "ios" ? "ios" : "android";
}

/** "Agora não" is kept per device: the notification is a device's own. */
export async function pushDismissed(): Promise<boolean> {
  return (await SecureStore.getItemAsync(NOT_NOW_KEY)) === "1";
}

export async function dismissPush(): Promise<void> {
  await SecureStore.setItemAsync(NOT_NOW_KEY, "1");
}

/**
 * Register this phone for pushes. With `ask`, the system prompt is shown when
 * the system still lets the app ask; without it, only an earlier yes counts.
 */
export async function registerPush({ ask }: { ask: boolean }): Promise<PushOutcome> {
  let permission = await pushPermission();
  if (permission !== "granted" && ask) {
    const answer = await Notifications.requestPermissionsAsync();
    permission = answer.status === "granted" ? "granted" : "denied";
  }
  if (permission !== "granted") return "denied";
  const projectId = easProjectId();
  if (!projectId) return "skipped";
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerExpoToken({ body: { token }, throwOnError: true });
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    return "registered";
  } catch {
    return "failed";
  }
}

/** Sign-out: the API stops sending this phone the signed-out person's notices. */
export async function forgetPushToken(): Promise<void> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return;
  try {
    await removeExpoToken({ body: { token }, throwOnError: true });
  } finally {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

/**
 * When the permission was taken away in the system's settings while this
 * phone still holds a token: forget it on the server and here, so the server
 * stops pushing to nobody.
 */
export async function forgetIfRevoked(): Promise<void> {
  if ((await pushPermission()) === "granted") return;
  await forgetPushToken();
}

/**
 * At start-up, signed in: refresh the registration after an earlier yes, or
 * forget the token when the yes was taken back. Never asks.
 */
export async function syncPush(): Promise<void> {
  if ((await pushPermission()) === "granted") await registerPush({ ask: false });
  else await forgetPushToken();
}

/** The notice a tapped push carries, and where it leads. */
export interface NotificationTarget {
  path: string;
  noticeId: string | null;
}

/**
 * Where a tapped push leads: the path of its link (the web address of the
 * animal at the reminder's subject), or the animal when the link is missing.
 */
export function notificationTarget(data: unknown): NotificationTarget | null {
  const payload = (data ?? {}) as {
    notice_id?: unknown;
    animal_id?: unknown;
    url?: unknown;
  };
  const noticeId =
    typeof payload.notice_id === "string" && payload.notice_id ? payload.notice_id : null;
  const path = typeof payload.url === "string" ? pathOf(payload.url) : null;
  if (path) return { path, noticeId };
  if (typeof payload.animal_id === "string" && payload.animal_id) {
    return { path: `/animais/${payload.animal_id}`, noticeId };
  }
  return null;
}

/** "https://pets.ampulla.tech/animais/a1?assunto=rabies" as "/animais/a1?assunto=rabies". */
function pathOf(url: string): string | null {
  const match = /^(?:[a-z][a-z0-9+.-]*:\/\/[^/?#]*)?(\/[^#]*)/i.exec(url.trim());
  return match ? match[1] : null;
}
