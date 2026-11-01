import { archiveAnimal } from "@pets/core/api/generated";
import { getAnimalOptions } from "@pets/core/api/query";
import { ARCHIVE_REASON_LABEL, todayIso } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Field } from "@/components/ui/field";
import { Notice, Screen } from "@/components/ui/screen";
import { Segmented } from "@/components/ui/segmented";
import { Text } from "@/components/ui/text";
import { dayText, readDay } from "@/lib/dates";
import { refreshAnimal } from "@/lib/invalidate";

type Reason = "died" | "rehomed" | "other";

export default function ArchiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const animal = useQuery(getAnimalOptions({ path: { animal_id: id } }));
  const [reason, setReason] = useState<Reason>("rehomed");
  const [on, setOn] = useState(dayText(todayIso()));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function archive() {
    const day = readDay(on);
    if (!day) return setError(strings.archive.dateRequired);
    setBusy(true);
    setError(null);
    try {
      await archiveAnimal({ path: { animal_id: id }, body: { reason, on: day }, throwOnError: true });
      await refreshAnimal(queryClient);
      router.back();
    } catch {
      setError(strings.app.genericError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      {animal.data ? <Text className="text-xl font-bold">{animal.data.name}</Text> : null}
      <Notice>{strings.archive.intro}</Notice>
      <Field label={strings.archive.reason}>
        <Segmented
          testID="reason"
          value={reason}
          onChange={setReason}
          options={(Object.keys(ARCHIVE_REASON_LABEL) as Reason[]).map((value) => ({
            value,
            label: ARCHIVE_REASON_LABEL[value],
          }))}
        />
      </Field>
      <Field label={strings.archive.on} error={error}>
        <DateInput testID="archived-on" value={on} onChange={setOn} invalid={!!error} />
      </Field>
      <Button size="lg" label={strings.archive.confirm} busy={busy} onPress={archive} testID="confirm-archive" />
    </Screen>
  );
}
