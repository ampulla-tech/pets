/**
 * Web push for the notices (ADR-0004, ADR-0009): the service worker, the
 * browser's subscription and its registration with the API, and the state of
 * the notification in this browser as the Avisos tab shows it.
 *
 * On an iPhone, a site receives pushes only when it runs from the Home Screen
 * (iOS 16.4+, `display: standalone`), and the permission may be asked only in
 * response to a tap.
 */
import { getWebpushKey, registerWebpush, removeWebpush } from "@pets/core/api/generated";
import type { DevicePush, UnblockPlatform } from "@pets/core/domain";

export type PushSupport = "available" | "ios-install" | "unsupported";

export function isIos(nav: Navigator = navigator): boolean {
  const ua = nav.userAgent;
  // iPadOS reports itself as a Mac with touch.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return (
    navigator.standalone === true ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches)
  );
}

export function pushSupport(): PushSupport {
  if (isIos() && !isStandalone()) return "ios-install";
  const capable =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return capable ? "available" : "unsupported";
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {
    // No worker, no push; the app works the same.
  });
}

/** The VAPID key, from base64url to the bytes `subscribe` takes. */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** The API's public key; empty when push is off on the server. */
export async function fetchPushKey(): Promise<string> {
  const { data } = await getWebpushKey({ throwOnError: true });
  return data.public_key;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/**
 * This browser's notification state. `publicKey` is the server's VAPID key
 * (empty when push is off there). Only a live subscription is `active`.
 */
export async function devicePush(publicKey: string): Promise<DevicePush> {
  const support = pushSupport();
  if (support === "ios-install") return "ios-install";
  if (support === "unsupported" || !publicKey) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission === "granted" && (await currentSubscription())) {
    return "active";
  }
  return "askable";
}

/**
 * When the permission was taken away in the browser's or the system's
 * settings while this browser still holds a subscription: forget it on the
 * server and here, so the server stops pushing to nobody.
 */
export async function forgetIfRevoked(): Promise<void> {
  if (pushSupport() !== "available" || Notification.permission === "granted") return;
  await disablePush();
}

const NOT_NOW = "pets.push.notNow";

/** "Agora não" is kept per device: the notification is a device's own. */
export function pushDismissed(): boolean {
  return localStorage.getItem(NOT_NOW) === "1";
}

export function dismissPush(): void {
  localStorage.setItem(NOT_NOW, "1");
}

/** Whose settings the unblock steps walk through, from the browser's name. */
export function unblockPlatform(nav: Navigator = navigator): UnblockPlatform {
  const ua = nav.userAgent;
  if (isIos(nav)) return "ios";
  if (/Android/.test(ua)) {
    // Installed, the site is an app of its own in Android's settings.
    if (isStandalone()) return "android";
    return /Chrome\//.test(ua) ? "chromeAndroid" : "other";
  }
  if (/Edg\//.test(ua)) return "edge";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Macintosh/.test(ua) && /Safari\//.test(ua)) return "safariMac";
  return "other";
}

export type EnableResult = "enabled" | "denied" | "off" | "failed";

/**
 * Ask the permission and subscribe. Call it straight from the tap handler,
 * with the key already fetched, so the permission prompt keeps the gesture.
 */
export async function enablePush(publicKey: string): Promise<EnableResult> {
  if (!publicKey) return "off";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey),
      }));
    const json = subscription.toJSON();
    await registerWebpush({
      body: {
        endpoint: subscription.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
      },
      throwOnError: true,
    });
    return "enabled";
  } catch {
    return "failed";
  }
}

/** On sign-out: forget this browser on the server and drop the subscription. */
export async function disablePush(): Promise<void> {
  try {
    const subscription = await currentSubscription();
    if (!subscription) return;
    await removeWebpush({ body: { endpoint: subscription.endpoint } }).catch(
      () => undefined,
    );
    await subscription.unsubscribe();
  } catch {
    // Signing out never fails on account of push.
  }
}
