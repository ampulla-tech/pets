import { router, Stack } from "expo-router";
import { Plus } from "lucide-react-native";
import { Pressable } from "react-native";

import { Text } from "@/components/ui/text";
import { screenOptions } from "@/lib/navigation";
import { colors } from "@/lib/theme";
import { strings } from "@pets/core/strings";

// A deep link straight to an animal keeps the home beneath it, to go back to.
export const unstable_settings = { initialRouteName: "index" };

/** The Pets tab: the home, and an animal opened from it (or from a notice). */
export default function PetsLayout() {
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen
        name="index"
        options={{ title: strings.home.title, headerRight: AddButton }}
      />
      <Stack.Screen name="animais/[id]/index" options={{ title: "" }} />
    </Stack>
  );
}

function AddButton() {
  return (
    <Pressable
      role="link"
      testID="add-animal"
      onPress={() => router.push("/animais/novo")}
      hitSlop={8}
      className="flex-row items-center gap-1 px-1 active:opacity-70"
    >
      <Plus color={colors.primary} size={18} />
      <Text className="font-semibold text-primary">{strings.home.addShort}</Text>
    </Pressable>
  );
}
