import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { getWebpushKeyOptions } from "@pets/core/api/query";
import { pushBanner, unblockSteps, type DevicePush } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { Notice } from "@/components/Feedback";
import { Steps } from "@/components/Steps";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/BottomSheet";
import {
  devicePush,
  dismissPush,
  enablePush,
  pushDismissed,
  pushSupport,
  unblockPlatform,
} from "@/lib/push";

const P = strings.push;

/**
 * This browser's notification state and what the Avisos tab does with it:
 * `enable` asks the permission inside the tap, `notNow` hides the banner for
 * good on this device.
 */
export function useDevicePush() {
  const support = pushSupport();
  const key = useQuery({
    ...getWebpushKeyOptions(),
    enabled: support === "available",
    staleTime: Infinity,
  });
  const publicKey = support === "available" ? key.data?.public_key : "";
  const [state, setState] = useState<DevicePush | null>(null);
  const [dismissed, setDismissed] = useState(pushDismissed);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (publicKey === undefined) {
      if (key.isError) setState("unsupported");
      return;
    }
    let alive = true;
    void devicePush(publicKey).then((next) => alive && setState(next));
    return () => {
      alive = false;
    };
  }, [publicKey, key.isError]);

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setFailed(false);
    const result = await enablePush(publicKey);
    if (result === "enabled") setState("active");
    else if (result === "denied") setState(await devicePush(publicKey));
    else setFailed(true);
  }, [publicKey]);

  const notNow = useCallback(() => {
    dismissPush();
    setDismissed(true);
  }, []);

  return { state, banner: pushBanner(state, dismissed), enable, notNow, failed };
}

export type DevicePushControls = ReturnType<typeof useDevicePush>;

/** The banner over the list: the invitation to switch on, or the iPhone's install steps. */
export function PushBanner({ push }: { push: DevicePushControls }) {
  const [busy, setBusy] = useState(false);
  if (push.banner === "ask") {
    return (
      <section className="flex flex-col gap-2 rounded-2xl border bg-card p-3 text-sm">
        <p>
          <b className="block font-semibold">{P.askTitle}</b>
          <span className="text-muted-foreground">{P.askBody}</span>
        </p>
        <div className="flex items-center gap-1">
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void push.enable().finally(() => setBusy(false));
            }}
          >
            <Bell />
            {P.enable}
          </Button>
          <Button variant="ghost" className="text-muted-foreground" onClick={push.notNow}>
            {P.notNow}
          </Button>
        </div>
        {push.failed ? <Notice tone="error">{P.failed}</Notice> : null}
      </section>
    );
  }
  if (push.banner === "install") {
    return (
      <section className="flex flex-col gap-2 rounded-2xl bg-muted p-3 text-sm">
        <b className="font-semibold">{P.installTitle}</b>
        <Steps steps={P.installSteps} share className="[&_li]:bg-card" />
        <Button
          variant="ghost"
          className="self-start px-0 text-muted-foreground"
          onClick={push.notNow}
        >
          {P.notNow}
        </Button>
      </section>
    );
  }
  return null;
}

/**
 * The sheet "Ativar notificações" opens when the permission cannot be asked:
 * how to unblock it on this device, or how to install on an iPhone.
 */
export function PushSheet({
  kind,
  onClose,
}: {
  kind: "blocked" | "install" | null;
  onClose: () => void;
}) {
  const blocked = kind === "blocked";
  return (
    <BottomSheet
      open={kind !== null}
      onClose={onClose}
      title={blocked ? P.blockedTitle : P.installSheetTitle}
    >
      <p className="text-sm text-muted-foreground">
        {blocked ? P.blockedBody : P.installBody}
      </p>
      <Steps
        steps={blocked ? unblockSteps(unblockPlatform()) : P.installSteps}
        share={!blocked}
      />
      <p className="text-sm text-muted-foreground">{P.stillHere}</p>
      <Button size="xl" onClick={onClose}>
        {P.gotIt}
      </Button>
    </BottomSheet>
  );
}
