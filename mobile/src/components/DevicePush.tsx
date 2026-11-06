import { pushBanner, unblockSteps, type DevicePush } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { Bell } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { AppState, View } from "react-native";

import { Steps } from "@/components/Steps";
import { Button } from "@/components/ui/button";
import { Muted, Text } from "@/components/ui/text";
import {
  devicePush,
  dismissPush,
  pushDismissed,
  registerPush,
  unblockPlatform,
} from "@/lib/push";
import { colors } from "@/lib/theme";

const P = strings.push;

/**
 * This phone's notification state and what the Avisos tab does with it:
 * `enable` asks the permission inside the tap, `notNow` hides the banner for
 * good on this device. Read again when the app returns from the settings.
 */
export function useDevicePush() {
  const [state, setState] = useState<DevicePush | null>(null);
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const read = () =>
      void devicePush()
        .then((next) => alive && setState(next))
        .catch(() => alive && setState("unsupported"));
    read();
    void pushDismissed()
      .then((value) => alive && setDismissed(value))
      .catch(() => alive && setDismissed(false));
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") read();
    });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  const enable = useCallback(async () => {
    setFailed(false);
    const outcome = await registerPush({ ask: true });
    if (outcome === "registered") setState("active");
    else if (outcome === "denied") setState(await devicePush());
    else setFailed(true);
  }, []);

  const notNow = useCallback(() => {
    setDismissed(true);
    void dismissPush();
  }, []);

  // Until "Agora não" is read from the device, no banner: it would flash.
  return { state, banner: pushBanner(state, dismissed ?? true), enable, notNow, failed };
}

export type DevicePushControls = ReturnType<typeof useDevicePush>;

/** The invitation over the list to switch the notification on. */
export function PushBanner({ push }: { push: DevicePushControls }) {
  const [busy, setBusy] = useState(false);
  if (push.banner !== "ask") return null;
  return (
    <View
      testID="push-banner"
      className="gap-2 rounded-2xl border border-border bg-card p-3"
    >
      <View>
        <Text className="text-sm font-semibold">{P.askTitle}</Text>
        <Muted>{P.askBody}</Muted>
      </View>
      <View className="flex-row items-center gap-1">
        <Button
          size="sm"
          label={P.enable}
          busy={busy}
          testID="enable-push"
          icon={<Bell color={colors["primary-foreground"]} size={16} />}
          onPress={() => {
            setBusy(true);
            void push.enable().finally(() => setBusy(false));
          }}
        />
        <Button size="sm" variant="ghost" testID="push-not-now" onPress={push.notNow}>
          <Text className="text-sm font-medium text-muted-foreground">{P.notNow}</Text>
        </Button>
      </View>
    </View>
  );
}

/** What "Ativar notificações" shows when the system will not ask again. */
export function BlockedSteps({ onClose }: { onClose: () => void }) {
  return (
    <View testID="push-blocked" className="gap-3">
      <Text role="heading" className="font-semibold">
        {P.blockedTitle}
      </Text>
      <Muted>{P.blockedBody}</Muted>
      <Steps steps={unblockSteps(unblockPlatform())} />
      <Muted>{P.stillHere}</Muted>
      <Button size="lg" label={P.gotIt} onPress={onClose} testID="push-got-it" />
    </View>
  );
}
