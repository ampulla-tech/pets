import type { AnimalOut } from "@pets/core/api/generated";
import { ARCHIVE_REASON_LABEL, badgeText, formatAge, formatDate, SPECIES_LABEL } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { AnimalAvatar } from "@/components/AnimalAvatar";
import { Badge } from "@/components/ui/badge";
import { Muted, Text } from "@/components/ui/text";
import { animalHref } from "@/lib/navigation";
import { colors } from "@/lib/theme";

/** One animal on the home (or the archived list): photo, name, age, badge. */
export function AnimalCard({ animal }: { animal: AnimalOut }) {
  const badge = badgeText(animal.badge);
  const age = formatAge(animal.age);
  const archived = animal.status === "archived";
  return (
    <Pressable
      role="link"
      testID={`animal-${animal.name}`}
      accessibilityLabel={animal.name}
      onPress={() => router.push(animalHref(animal.id) as never)}
      className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-3 active:opacity-80"
    >
      <AnimalAvatar animal={animal} />
      <View className="flex-1 gap-1">
        <Text className="text-lg font-semibold">{animal.name}</Text>
        <Muted>
          {[SPECIES_LABEL[animal.species], animal.breed, age].filter(Boolean).join(" · ")}
        </Muted>
        {archived && animal.archived_reason ? (
          <Muted>
            {strings.archive.archivedOn(
              ARCHIVE_REASON_LABEL[animal.archived_reason],
              formatDate(animal.archived_on),
            )}
          </Muted>
        ) : badge ? (
          <Badge text={badge.text} tone={badge.tone} />
        ) : null}
      </View>
      <ChevronRight color={colors["muted-foreground"]} size={20} />
    </Pressable>
  );
}
