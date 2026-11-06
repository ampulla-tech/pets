import type { AnimalOut } from "@pets/core/api/generated";
import {
  ARCHIVE_REASON_LABEL,
  badgeText,
  formatAge,
  formatDate,
  SPECIES_LABEL,
} from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { AnimalAvatar } from "@/components/AnimalAvatar";
import { Badge } from "@/components/ui/badge";
import { Muted, Text } from "@/components/ui/text";
import { animalHref } from "@/lib/navigation";
import { colors } from "@/lib/theme";

/**
 * An animal on the home or the archived list: photo, name, species and age,
 * and under them the badge of what is due, only when something is.
 */
export function AnimalCard({ animal }: { animal: AnimalOut }) {
  const archived = animal.status === "archived";
  const badge = archived ? null : badgeText(animal.badge);
  const age = formatAge(animal.age);
  return (
    <Pressable
      role="link"
      testID={`animal-${animal.name}`}
      accessibilityLabel={animal.name}
      onPress={() => router.push(animalHref(animal.id) as never)}
      className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-3 active:opacity-80"
    >
      <AnimalAvatar animal={animal} />
      <View className="flex-1 items-start">
        <Text className="text-lg font-semibold" numberOfLines={1}>
          {animal.name}
        </Text>
        <Muted numberOfLines={1}>
          {[SPECIES_LABEL[animal.species], age].filter(Boolean).join(" · ")}
        </Muted>
        {archived && animal.archived_reason ? (
          <Muted>
            {strings.archive.archivedOn(
              ARCHIVE_REASON_LABEL[animal.archived_reason],
              formatDate(animal.archived_on),
            )}
          </Muted>
        ) : null}
        {badge ? (
          <View className="mt-1.5">
            <Badge text={badge.text} tone={badge.tone} />
          </View>
        ) : null}
      </View>
      <ChevronRight color={colors["muted-foreground"]} size={20} />
    </Pressable>
  );
}
