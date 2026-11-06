import type { CardItemOut, CardSectionOut } from "@pets/core/api/generated";
import { getCardOptions } from "@pets/core/api/query";
import { animalLine, doseBadge, formatDate, ofAnimal } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Download, Plus, Syringe } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { AnimalAvatar } from "@/components/AnimalAvatar";
import { newRecordHref, RegisterSheet } from "@/components/RegisterSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, Loading, Notice, Screen } from "@/components/ui/screen";
import { Muted, Text } from "@/components/ui/text";
import { shareCardPdf } from "@/lib/sharing";
import { colors } from "@/lib/theme";
import { cn } from "@/lib/utils";

const C = strings.card;

/**
 * The card: everything recorded, like the paper card. A section per kind, a
 * line per record, the newest first; a line opens its record, and back
 * returns here.
 */
export default function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const card = useQuery(getCardOptions({ path: { animal_id: id } }));
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  if (card.isPending) return <Loading />;
  if (card.isError) return <ErrorState onRetry={() => void card.refetch()} />;
  const { animal, sections } = card.data;

  async function share() {
    setSharing(true);
    setError(null);
    try {
      await shareCardPdf(id, animal.name, C.sharePdf);
    } catch {
      setError(C.pdfFailed);
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight:
            sections.length > 0
              ? () => (
                  <Pressable
                    role="button"
                    accessibilityLabel={C.sharePdf}
                    testID="share-pdf"
                    hitSlop={8}
                    disabled={sharing}
                    onPress={() => void share()}
                    className="flex-row items-center gap-1.5 px-1 active:opacity-60"
                  >
                    {sharing ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Download color={colors.primary} size={16} />
                    )}
                    <Text className="font-semibold text-primary">{C.pdf}</Text>
                  </Pressable>
                )
              : undefined,
        }}
      />
      <Screen>
        <View className="flex-row items-center gap-3.5">
          <AnimalAvatar animal={animal} size={48} initial />
          <View className="flex-1">
            <Text className="font-semibold">{animal.name}</Text>
            <Muted>{animalLine(animal, { sex: true })}</Muted>
            {animal.microchip ? <Muted>{C.microchip(animal.microchip)}</Muted> : null}
          </View>
        </View>
        {error ? <Notice tone="late">{error}</Notice> : null}
        {sections.length === 0 ? (
          <View testID="card-empty" className="items-center gap-2 px-5 py-10">
            <View className="mb-1 h-16 w-16 items-center justify-center rounded-full bg-accent">
              <Syringe color={colors.primary} size={28} />
            </View>
            <Text className="font-semibold">{C.empty}</Text>
            <Muted className="text-center">{C.emptyHint(ofAnimal(animal))}</Muted>
            {animal.status === "active" ? (
              <Button
                className="mt-2"
                label={strings.animal.addRecord}
                testID="card-register"
                icon={<Plus color={colors["primary-foreground"]} size={18} />}
                onPress={() => setRegistering(true)}
              />
            ) : null}
          </View>
        ) : (
          sections.map((section) => (
            <View key={section.kind} className="gap-2" testID={`card-${section.kind}`}>
              <Text
                role="heading"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {C.sections[section.kind]}
              </Text>
              <View className="overflow-hidden rounded-2xl border border-border bg-card">
                {section.items.map((item, i) => (
                  <Pressable
                    key={item.record_id}
                    testID={`card-item-${item.record_id}`}
                    disabled={!item.can_edit}
                    accessibilityRole={item.can_edit ? "button" : undefined}
                    onPress={() =>
                      router.push(newRecordHref(id, section.kind, { registro: item.record_id }) as never)
                    }
                    className={cn("active:bg-muted", i > 0 && "border-t border-border")}
                  >
                    <CardLine kind={section.kind} item={item} />
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        )}
      </Screen>
      <RegisterSheet
        animalId={id}
        tutor={animal.role === "tutor"}
        visible={registering}
        onClose={() => setRegistering(false)}
      />
    </>
  );
}

/** One record: a dose like the label on the paper card, or a weight or a note. */
function CardLine({ kind, item }: { kind: CardSectionOut["kind"]; item: CardItemOut }) {
  const dose = kind === "vaccine" || kind === "antiparasitic";
  const old = dose && !item.current;
  if (kind === "weight" || kind === "note") {
    return (
      <View className="flex-row items-center gap-3 px-3 py-2.5">
        <View className="flex-1">
          <Text className={kind === "weight" ? "font-semibold" : "text-sm"}>{item.title}</Text>
          {item.detail ? <Muted className={kind === "note" ? "text-xs" : undefined}>{item.detail}</Muted> : null}
        </View>
        <Muted className="text-xs">{formatDate(item.date)}</Muted>
      </View>
    );
  }
  const badge = doseBadge(item);
  return (
    <View className="px-3 py-2.5">
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className={cn("flex-1", old ? "font-medium text-muted-foreground" : "font-semibold")}>{item.title}</Text>
        <Text className={cn("text-sm", old ? "font-medium text-muted-foreground" : "font-semibold")}>
          {formatDate(item.date)}
        </Text>
      </View>
      {item.detail ? <Muted className="text-xs">{item.detail}</Muted> : null}
      {dose && item.current ? (
        item.repeat_on ? (
          <View className="mt-1 flex-row flex-wrap items-center gap-1.5">
            <Text className="text-sm">{C.repeatOn(formatDate(item.repeat_on))}</Text>
            {badge ? <Badge text={badge.text} tone={badge.tone} /> : null}
          </View>
        ) : (
          <Muted className="mt-1">{C.repeatNoDate}</Muted>
        )
      ) : null}
    </View>
  );
}
