import { initialOf } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { router } from "expo-router";
import { Archive, ChevronRight, LogOut } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Card } from "@/components/ui/card";
import { Muted, Text } from "@/components/ui/text";
import { Screen } from "@/components/ui/screen";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

const P = strings.profile;

/** The Perfil tab: the account's e-mail, then Arquivados and Sair, quiet. */
export default function ProfileScreen() {
  const { state, signOut } = useSession();
  const email = state.status === "signedIn" ? state.email : "";
  const quiet = colors["muted-foreground"];

  return (
    <Screen className="gap-3">
      <Card className="flex-row items-center gap-3 p-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-accent">
          <Text className="font-bold text-primary">{initialOf(email)}</Text>
        </View>
        <View className="flex-1">
          <Text className="font-semibold" numberOfLines={1}>
            {email}
          </Text>
          <Muted>{P.account}</Muted>
        </View>
      </Card>
      <View>
        <Pressable
          role="link"
          testID="archived"
          onPress={() => router.push("/arquivados")}
          className="min-h-11 flex-row items-center gap-2 px-1.5 active:opacity-60"
        >
          <Archive color={quiet} size={16} />
          <Muted className="flex-1">{P.archived}</Muted>
          <ChevronRight color={quiet} size={16} />
        </Pressable>
        <Pressable
          role="button"
          testID="sign-out"
          onPress={() => void signOut()}
          className="min-h-11 flex-row items-center gap-2 px-1.5 active:opacity-60"
        >
          <LogOut color={quiet} size={16} />
          <Muted>{P.signOut}</Muted>
        </Pressable>
      </View>
    </Screen>
  );
}
