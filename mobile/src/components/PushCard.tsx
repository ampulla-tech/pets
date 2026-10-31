import { strings } from "@pets/core/strings";
import { Bell } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Muted, Text } from "@/components/ui/text";
import { pushPermission, registerPush, type PushPermission } from "@/lib/push";
import { colors } from "@/lib/theme";

/**
 * The invitation to turn notifications on, asked in response to a tap, never
 * at launch. Gone once the person answered yes; says so when they said no.
 */
export function PushCard() {
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    pushPermission()
      .then((value) => alive && setPermission(value))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (permission === null || permission === "granted") return null;

  async function enable() {
    setBusy(true);
    try {
      const outcome = await registerPush({ ask: true });
      setPermission(outcome === "denied" ? "denied" : "granted");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex-row gap-3" testID="push-card">
      <Bell color={colors.primary} size={22} />
      <View className="flex-1 gap-2">
        <Text className="font-semibold">{strings.push.title}</Text>
        {permission === "denied" ? (
          <Muted>{strings.push.denied}</Muted>
        ) : (
          <>
            <Muted>{strings.push.hint}</Muted>
            <Button size="sm" className="self-start" label={strings.push.enable} busy={busy} onPress={enable} testID="enable-push" />
          </>
        )}
      </View>
    </Card>
  );
}
