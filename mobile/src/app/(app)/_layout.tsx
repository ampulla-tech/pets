import { Redirect, Stack } from "expo-router";

import { screenOptions } from "@/lib/navigation";
import { useSession } from "@/lib/session";
import { strings } from "@pets/core/strings";

// A deep link straight to a form keeps the tabs beneath it, to go back to.
export const unstable_settings = { initialRouteName: "(tabs)" };

/**
 * Everything behind the session: signed out, the way in is the sign-in screen.
 * The tabs (with the animal and the archived list inside them) sit at the
 * bottom; the forms and the camera open above them, with the whole screen.
 */
export default function SignedInLayout() {
  const { state } = useSession();
  if (state.status === "signedOut") return <Redirect href="/entrar" />;
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="animais/novo" options={{ title: strings.animal.newTitle }} />
      <Stack.Screen
        name="animais/[id]/editar"
        options={{ title: strings.animal.editTitle }}
      />
      <Stack.Screen name="animais/[id]/registro" options={{ title: "" }} />
      <Stack.Screen
        name="animais/[id]/pessoas"
        options={{ title: strings.people.title }}
      />
      <Stack.Screen
        name="animais/[id]/convidar"
        options={{ title: strings.people.inviteTitle }}
      />
      <Stack.Screen
        name="animais/[id]/arquivar"
        options={{ title: strings.archive.title }}
      />
      <Stack.Screen
        name="animais/[id]/carteirinha"
        options={{ title: strings.card.title }}
      />
      <Stack.Screen name="animais/[id]/foto" options={{ title: strings.intake.title }} />
    </Stack>
  );
}
