import { Stack } from "expo-router";

import { screenOptions } from "@/lib/navigation";
import { strings } from "@pets/core/strings";

// A deep link straight to the archived list keeps the profile beneath it.
export const unstable_settings = { initialRouteName: "perfil" };

/** The Perfil tab: the account, and the archived list opened from it. */
export default function ProfileLayout() {
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="perfil" options={{ title: strings.profile.title }} />
      <Stack.Screen name="arquivados" options={{ title: strings.archive.listTitle }} />
    </Stack>
  );
}
