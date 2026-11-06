import { Stack } from "expo-router";

import { screenOptions } from "@/lib/navigation";
import { strings } from "@pets/core/strings";

/** The Avisos tab. */
export default function NoticesLayout() {
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="avisos" options={{ title: strings.notices.title }} />
    </Stack>
  );
}
