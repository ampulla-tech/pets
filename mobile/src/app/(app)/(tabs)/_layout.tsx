import { Tabs } from "expo-router/js-tabs";
import { Bell, PawPrint, UserRound } from "lucide-react-native";

import { NoticesTabIcon } from "@/components/NoticesTabIcon";
import { colors } from "@/lib/theme";
import { strings } from "@pets/core/strings";

export const unstable_settings = { initialRouteName: "(pets)" };

/**
 * The bar at the bottom: Pets, Avisos and Perfil. Each tab is a stack of its
 * own, so the animal (under Pets) and the archived list (under Perfil) keep
 * the bar and a way back.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors["muted-foreground"],
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="(pets)"
        options={{
          title: strings.tabs.pets,
          tabBarButtonTestID: "tab-pets",
          tabBarIcon: ({ color, size }) => <PawPrint color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="(avisos)"
        options={{
          title: strings.tabs.notices,
          tabBarButtonTestID: "tab-notices",
          tabBarIcon: ({ color, size }) => (
            <NoticesTabIcon color={color} size={size} Icon={Bell} />
          ),
        }}
      />
      <Tabs.Screen
        name="(perfil)"
        options={{
          title: strings.tabs.profile,
          tabBarButtonTestID: "tab-profile",
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
