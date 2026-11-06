import { readNotice } from "@pets/core/api/generated";
import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { forgetIfRevoked, notificationTarget, syncPush } from "@/lib/push";
import { useSession } from "@/lib/session";

/**
 * A tapped push opens its link (the animal at the reminder's subject) and
 * marks its notice read, whether the tap woke the app (cold start: the hook
 * answers the launching response) or found it open. Signed in, it also keeps
 * this phone's registration in step with the permission: refreshed after an
 * earlier yes, forgotten on the server once the yes was taken back in the
 * system's settings. It never asks: asking is a tap in the Avisos tab.
 */
export function NotificationRouting() {
  const { state } = useSession();
  const queryClient = useQueryClient();
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  const signedIn = state.status === "signedIn";

  useEffect(() => {
    if (!signedIn) return;
    void syncPush().catch(() => undefined);
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void forgetIfRevoked().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn || !response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    const target = notificationTarget(response.notification.request.content.data);
    if (!target) return;
    handled.current = id;
    router.push(target.path as never);
    Notifications.clearLastNotificationResponse();
    if (target.noticeId) {
      void readNotice({ path: { notice_id: target.noticeId } })
        .then(() => queryClient.invalidateQueries())
        .catch(() => undefined);
    }
  }, [response, signedIn, queryClient]);

  return null;
}
