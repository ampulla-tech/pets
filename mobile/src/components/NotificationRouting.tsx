import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useRef } from "react";

import { notificationTarget, registerPush } from "@/lib/push";
import { useSession } from "@/lib/session";

/**
 * A tapped reminder opens the animal at its subject, whether the tap woke the
 * app (cold start: the hook answers the launching response) or found it open.
 * Also refreshes this phone's push registration once signed in, when the
 * person already said yes (never asks here: asking is a tap on the home).
 */
export function NotificationRouting() {
  const { state } = useSession();
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  const signedIn = state.status === "signedIn";

  useEffect(() => {
    if (signedIn) void registerPush({ ask: false }).catch(() => undefined);
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn || !response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    const target = notificationTarget(response.notification.request.content.data);
    if (!target) return;
    handled.current = id;
    router.push(target as never);
    Notifications.clearLastNotificationResponse();
  }, [response, signedIn]);

  return null;
}
