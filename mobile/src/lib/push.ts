/**
 * Expo push (ADR-0004): ask the permission, get this phone's Expo
 * push token, register it with the API, and forget it at sign-out.
 *
 * The token needs the EAS project id; a build without one (a local dev build)
 * skips the registration and the reminders still arrive by e-mail.
 */

import { registerExpoToken, removeExpoToken } from "@pets/core/api/generated";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { easProjectId } from "./env";

const TOKEN_KEY = "pets.expoPushToken";

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
  return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
}

/**
 * Register this phone for pushes. With `ask`, the system prompt is shown when
 * the person has not answered yet; without it, only an earlier yes counts.
 */
export async function registerPush({ ask }: { ask: boolean }): Promise<PushOutcome> {
  let permission = await pushPermission();
  if (permission === "undetermined" && ask) {
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

/** Where a tapped notice leads: the animal, at the reminder's subject. */
export function notificationTarget(data: unknown): string | null {
  const payload = (data ?? {}) as { animal_id?: unknown; subject?: unknown };
  if (typeof payload.animal_id !== "string" || !payload.animal_id) return null;
  const subject = typeof payload.subject === "string" ? payload.subject : "";
  return subject
    ? `/animais/${payload.animal_id}?assunto=${encodeURIComponent(subject)}`
    : `/animais/${payload.animal_id}`;
}
