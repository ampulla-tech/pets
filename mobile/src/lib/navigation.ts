import { strings } from "@pets/core/strings";
import { router } from "expo-router";

import { colors } from "./theme";

/** The native stack's look, shared by the root stack and the signed-in one. */
export const screenOptions = {
  headerTintColor: colors.primary,
  headerStyle: { backgroundColor: colors.background },
  headerTitleStyle: { color: colors.foreground },
  headerShadowVisible: false,
  headerBackTitle: strings.app.back,
  contentStyle: { backgroundColor: colors.background },
};

/** Where to go once signed in: back to the invite that sent the person here, or home. */
export function afterSignIn(invite?: string) {
  // Leave nothing of the way in (sign-in, sign-up) beneath the next screen.
  if (router.canDismiss()) router.dismissAll();
  router.replace(invite ? `/convite/${invite}` : "/");
}

/** The animal's profile, optionally at one reminder's subject. */
export function animalHref(id: string, subject?: string) {
  return subject ? `/animais/${id}?assunto=${encodeURIComponent(subject)}` : `/animais/${id}`;
}
