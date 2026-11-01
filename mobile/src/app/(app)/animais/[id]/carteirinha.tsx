import type { AttachmentOut } from "@pets/core/api/generated";
import { getCardOptions } from "@pets/core/api/query";
import { formatDate, reminderTone } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Share2 } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { AnimalAvatar } from "@/components/AnimalAvatar";
import { PhotoViewer } from "@/components/Attachments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, Loading, Notice, Screen } from "@/components/ui/screen";
import { Muted, Text } from "@/components/ui/text";
import { shareCardPdf } from "@/lib/sharing";
import { colors } from "@/lib/theme";

type CardState = Parameters<typeof reminderTone>[0];

/** The card for the clinic's counter: per subject, the last dose and the next. */
export default function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const card = useQuery(getCardOptions({ path: { animal_id: id } }));
  const [photo, setPhoto] = useState<AttachmentOut | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (card.isPending) return <Loading />;
  if (card.isError) return <ErrorState onRetry={() => void card.refetch()} />;
  const { animal, rows } = card.data;

  async function share() {
    setSharing(true);
    setError(null);
    try {
      await shareCardPdf(id, animal.name, strings.card.sharePdf);
    } catch {
      setError(strings.card.pdfFailed);
    } finally {
      setSharing(false);
    }
  }

  return (
    <Screen>
      <View className="flex-row items-center gap-3">
        <AnimalAvatar animal={animal} size={56} />
        <View className="flex-1">
          <Text className="text-xl font-bold">{animal.name}</Text>
          <Muted>{strings.card.intro}</Muted>
        </View>
      </View>
      {rows.length === 0 ? <Muted>{strings.card.empty}</Muted> : null}
      {rows.map((row) => (
        <Card key={row.subject} className="gap-1.5 p-3" testID={`card-row-${row.subject}`}>
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 font-semibold">{row.label}</Text>
            <Badge
              text={row.next_on ? formatDate(row.next_on) : strings.card.noDate}
              tone={reminderTone(row.state as CardState)}
            />
          </View>
          <Muted>{`${strings.card.lastDose}: ${formatDate(row.last_date)}${row.last_product ? ` · ${row.last_product}` : ""}`}</Muted>
          {row.last_vet ? <Muted>{`${strings.records.vet}: ${row.last_vet}`}</Muted> : null}
          <Muted>{`${strings.card.nextDose}: ${row.next_on ? formatDate(row.next_on) : strings.card.noDate}`}</Muted>
          {row.photos[0] ? (
            <Button
              size="sm"
              variant="ghost"
              className="self-start px-0"
              label={strings.card.labelPhoto}
              testID={`label-photo-${row.subject}`}
              onPress={() => setPhoto(row.photos[0])}
            />
          ) : null}
        </Card>
      ))}
      {error ? <Notice tone="late">{error}</Notice> : null}
      <Button
        size="lg"
        label={sharing ? strings.card.downloading : strings.card.sharePdf}
        busy={sharing}
        onPress={share}
        testID="share-pdf"
        icon={<Share2 color={colors["primary-foreground"]} size={18} />}
      />
      <PhotoViewer attachment={photo} onClose={() => setPhoto(null)} />
    </Screen>
  );
}
