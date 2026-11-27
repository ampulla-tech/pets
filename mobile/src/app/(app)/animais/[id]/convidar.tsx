import { createInvite, type InviteOut } from "@pets/core/api/generated";
import { getAnimalOptions } from "@pets/core/api/query";
import { todayIso } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import { Share2 } from "lucide-react-native";
import { useState } from "react";
import { Share } from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Field } from "@/components/ui/field";
import { Notice, Screen } from "@/components/ui/screen";
import { Segmented } from "@/components/ui/segmented";
import { Muted, Text } from "@/components/ui/text";
import { readDay } from "@/lib/dates";
import { colors } from "@/lib/theme";

/** A single-use link for one animal, shared through the phone's share sheet. */
export default function InviteScreen() {
  const { id, papel } = useLocalSearchParams<{ id: string; papel?: "tutor" | "guest" }>();
  const animal = useQuery(getAnimalOptions({ path: { animal_id: id } }));
  const [role, setRole] = useState<"tutor" | "guest">(papel === "guest" ? "guest" : papel === "tutor" ? "tutor" : "guest");
  const [endsOn, setEndsOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const name = animal.data?.name ?? "";

  async function generate() {
    const end = role === "guest" ? readDay(endsOn) : null;
    if (end === false) return setError(strings.records.dateRequired);
    if (end && end < todayIso()) return setError(strings.people.endsOnPast);
    setError(null);
    setBusy(true);
    try {
      const { data } = await createInvite({
        path: { animal_id: id },
        body: { role, access_ends_on: end || null },
        throwOnError: true,
      });
      setInvite(data);
    } catch {
      setError(strings.app.genericError);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!invite) return;
    await Share.share({ message: invite.url, url: invite.url, title: strings.people.shareTitle(name) });
  }

  if (invite) {
    return (
      <Screen>
        <Notice>{strings.people.linkReady}</Notice>
        <Card>
          <Text selectable testID="invite-url">
            {invite.url}
          </Text>
        </Card>
        <Button size="lg" label={strings.people.share} testID="share-invite" icon={<Share2 color={colors["primary-foreground"]} size={18} />} onPress={share} />
        <Button
          variant="outline"
          label={copied ? strings.people.copied : strings.people.copy}
          testID="copy-invite"
          onPress={async () => {
            await Clipboard.setStringAsync(invite.url);
            setCopied(true);
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Field label={strings.people.role} required>
        <Segmented
          testID="role"
          value={role}
          onChange={setRole}
          options={[
            { value: "tutor", label: strings.people.tutor },
            { value: "guest", label: strings.people.guest },
          ]}
        />
        <Muted>{role === "tutor" ? strings.people.tutorHint : strings.people.guestHint}</Muted>
      </Field>
      {role === "guest" ? (
        <Field label={strings.people.endsOn} hint={strings.people.endsOnHint} error={error}>
          <DateInput testID="ends-on" value={endsOn} onChange={setEndsOn} invalid={!!error} />
        </Field>
      ) : error ? (
        <Text role="alert" className="text-late">
          {error}
        </Text>
      ) : null}
      <Button size="lg" label={strings.people.generate} busy={busy} onPress={generate} testID="generate" />
    </Screen>
  );
}
