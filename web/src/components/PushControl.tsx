import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellRing } from "lucide-react";
import { getWebpushKeyOptions } from "@pets/core/api/query";
import { strings } from "@pets/core/strings";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/Feedback";
import { currentSubscription, enablePush, pushSupport, type EnableResult } from "@/lib/push";

/**
 * "Ativar notificações": the permission is asked only inside the tap. On an
 * iPhone outside the Home Screen it explains how to install instead, since
 * Safari delivers pushes only to an installed site.
 */
export function PushControl() {
  const support = pushSupport();
  const key = useQuery({ ...getWebpushKeyOptions(), enabled: support === "available", staleTime: Infinity });
  const [result, setResult] = useState<EnableResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (support !== "available" || Notification.permission !== "granted") return;
    let alive = true;
    void currentSubscription().then((subscription) => {
      if (alive && subscription) setResult("enabled");
    });
    return () => {
      alive = false;
    };
  }, [support]);

  if (support === "ios-install") return <Notice>{strings.push.iosInstall}</Notice>;
  if (support === "unsupported") return <Notice>{strings.push.unsupported}</Notice>;
  if (result === "enabled") {
    return (
      <Notice tone="ok" className="flex items-center gap-2">
        <BellRing className="size-4 shrink-0" aria-hidden />
        {strings.push.enabled}
      </Notice>
    );
  }

  async function onTap() {
    if (key.data === undefined) return;
    if (!key.data.public_key) {
      setResult("off");
      return;
    }
    setBusy(true);
    try {
      setResult(await enablePush(key.data.public_key));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{strings.push.hint}</p>
      <Button
        variant="outline"
        size="lg"
        className="self-start"
        onClick={() => void onTap()}
        disabled={busy || key.data === undefined}
      >
        <Bell />
        {strings.push.enable}
      </Button>
      {result === "off" ? <Notice tone="warn">{strings.push.off}</Notice> : null}
      {result === "denied" ? <Notice tone="warn">{strings.push.denied}</Notice> : null}
      {result === "failed" ? <Notice tone="error">{strings.push.failed}</Notice> : null}
    </div>
  );
}
