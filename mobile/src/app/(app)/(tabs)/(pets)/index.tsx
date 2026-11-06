import { listAnimalsOptions } from "@pets/core/api/query";
import { strings } from "@pets/core/strings";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { PawPrint, Plus } from "lucide-react-native";
import { RefreshControl, View } from "react-native";

import { AnimalCard } from "@/components/AnimalCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, Loading, Screen } from "@/components/ui/screen";
import { Muted, Text } from "@/components/ui/text";
import { colors } from "@/lib/theme";

/** The Pets tab: only the animals' cards ("Meus pets" and "Adicionar" are in the header). */
export default function HomeScreen() {
  const animals = useQuery(listAnimalsOptions());

  if (animals.isPending) return <Loading />;
  if (animals.isError) return <ErrorState onRetry={() => void animals.refetch()} />;

  return (
    <Screen
      className="gap-2.5"
      refreshControl={
        <RefreshControl
          refreshing={animals.isRefetching}
          onRefresh={() => void animals.refetch()}
        />
      }
    >
      {animals.data.length === 0 ? (
        <Card className="items-center gap-3 border-dashed py-8">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-accent">
            <PawPrint color={colors["accent-foreground"]} size={30} />
          </View>
          <Text className="text-lg font-semibold">{strings.home.empty}</Text>
          <Muted className="text-center">{strings.home.emptyHint}</Muted>
          <Button
            label={strings.home.add}
            onPress={() => router.push("/animais/novo")}
            testID="add-first-animal"
            icon={<Plus color={colors["primary-foreground"]} size={18} />}
          />
        </Card>
      ) : (
        animals.data.map((animal) => <AnimalCard key={animal.id} animal={animal} />)
      )}
    </Screen>
  );
}
