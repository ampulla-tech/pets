import type { AnimalOut } from "@pets/core/api/generated";
import { Image } from "expo-image";
import { Cat, Dog } from "lucide-react-native";
import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/lib/theme";
import { strings } from "@pets/core/strings";

/**
 * The animal's photo; with none, its species drawn, or (`initial`) the first
 * letter of its name.
 */
export function AnimalAvatar({
  animal,
  size = 56,
  initial,
}: {
  animal: Pick<AnimalOut, "name" | "species" | "photo_url">;
  size?: number;
  initial?: boolean;
}) {
  const style = { width: size, height: size, borderRadius: size / 4 };
  if (animal.photo_url) {
    return (
      <Image
        source={{ uri: animal.photo_url }}
        style={style}
        contentFit="cover"
        accessibilityLabel={strings.animal.photoAlt(animal.name)}
      />
    );
  }
  if (initial) {
    return (
      <View style={style} className="items-center justify-center bg-accent" testID="avatar-initial">
        <Text className="font-bold text-primary" style={{ fontSize: size * 0.4 }}>
          {animal.name.trim().charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }
  const Icon = animal.species === "cat" ? Cat : Dog;
  return (
    <View style={style} className="items-center justify-center bg-accent">
      <Icon color={colors["accent-foreground"]} size={size * 0.5} />
    </View>
  );
}
