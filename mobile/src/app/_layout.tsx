import "../global.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { NotificationRouting } from "@/components/NotificationRouting";
import { configureNotifications } from "@/lib/push";
import { screenOptions } from "@/lib/navigation";
import { createQueryClient } from "@/lib/query";
import { SessionProvider, useSession } from "@/lib/session";
import { strings } from "@pets/core/strings";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
configureNotifications();

function Navigator() {
  const { state } = useSession();
  useEffect(() => {
    if (state.status !== "loading") void SplashScreen.hideAsync().catch(() => undefined);
  }, [state.status]);
  if (state.status === "loading") return null;
  return (
    <>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="entrar" options={{ title: strings.auth.signInTitle, headerShown: false }} />
        <Stack.Screen name="cadastro" options={{ title: strings.auth.signUpTitle }} />
        <Stack.Screen name="recuperar" options={{ title: strings.auth.resetTitle }} />
        <Stack.Screen name="convite/[token]" options={{ title: strings.invite.title }} />
      </Stack>
      <NotificationRouting />
    </>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <StatusBar style="dark" />
          <Navigator />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
