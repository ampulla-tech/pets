import { listAnimalsOptions, listUpcomingOptions } from "@pets/core/api/query";
import { groupReminders } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Plus } from "lucide-react-native";
import { RefreshControl, View } from "react-native";

import { AnimalCard } from "@/components/AnimalCard";
import { PushCard } from "@/components/PushCard";
import { ReminderRow } from "@/components/ReminderRow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, Loading, Screen, Section } from "@/components/ui/screen";
import { Muted, Text } from "@/components/ui/text";
import { animalHref } from "@/lib/navigation";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

export default function HomeScreen() {
  const { state, signOut } = useSession();
  const animals = useQuery(listAnimalsOptions());
  const upcoming = useQuery(listUpcomingOptions());

  if (animals.isPending) return <Loading />;
  if (animals.isError) return <ErrorState onRetry={() => void animals.refetch()} />;

  const refreshing = animals.isRefetching || upcoming.isRefetching;
  const refresh = () => {
    void animals.refetch();
    void upcoming.refetch();
  };
  const add = () => router.push("/animais/novo");

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      {animals.data.length === 0 ? (
        <Card className="items-center gap-3 py-8">
          <Text className="text-lg font-semibold">{strings.home.empty}</Text>
          <Muted className="text-center">{strings.home.emptyHint}</Muted>
          <Button label={strings.home.add} onPress={add} testID="add-animal" icon={<Plus color={colors["primary-foreground"]} size={18} />} />
        </Card>
      ) : (
        <>
          <Section title={strings.home.upcomingTitle}>
            {upcoming.data && upcoming.data.length > 0 ? (
              groupReminders(upcoming.data).map((group) => (
                <ReminderRow
                  key={group.key}
                  group={group}
                  showAnimal
                  onPress={() => router.push(animalHref(group.first.animal_id, group.first.subject) as never)}
                />
              ))
            ) : upcoming.isPending ? null : (
              <Muted>{strings.home.upcomingEmpty}</Muted>
            )}
          </Section>
          <PushCard />
          <Section
            title={strings.home.title}
            action={
              <Button size="sm" variant="ghost" label={strings.home.add} onPress={add} testID="add-animal" />
            }
          >
            {animals.data.map((animal) => (
              <AnimalCard key={animal.id} animal={animal} />
            ))}
          </Section>
        </>
      )}
      <View className="gap-2 pt-4">
        <Button variant="outline" label={strings.home.archived} onPress={() => router.push("/arquivados")} testID="archived" />
        {state.status === "signedIn" ? <Muted className="text-center">{strings.auth.signedInAs(state.email)}</Muted> : null}
        <Button variant="ghost" label={strings.auth.signOut} onPress={() => void signOut()} testID="sign-out" />
      </View>
    </Screen>
  );
}
