import { readFailure } from "@pets/core/api";
import { removeAccess } from "@pets/core/api/generated";
import { getAnimalOptions, listAccessesOptions } from "@pets/core/api/query";
import { formatDate, ROLE_LABEL } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, Loading, Screen } from "@/components/ui/screen";
import { Muted, Text } from "@/components/ui/text";
import { confirmDeleteAnimal } from "@/lib/animal-actions";
import { refreshAnimal } from "@/lib/invalidate";

/** Who has access to the animal; invite, remove, leave (ADR-0006). */
export default function PeopleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const animal = useQuery(getAnimalOptions({ path: { animal_id: id } }));
  const accesses = useQuery(listAccessesOptions({ path: { animal_id: id } }));
  const [lastTutor, setLastTutor] = useState(false);

  if (animal.isPending || accesses.isPending) return <Loading />;
  if (animal.isError || accesses.isError) return <ErrorState onRetry={() => void accesses.refetch()} />;

  const tutor = animal.data.role === "tutor";
  const name = animal.data.name;

  async function drop(accessId: number, mine: boolean) {
    try {
      await removeAccess({ path: { animal_id: id, access_id: accessId }, throwOnError: true });
      await refreshAnimal(queryClient);
      if (mine) router.replace("/");
    } catch (failure) {
      if (readFailure(failure).code === "last_tutor") setLastTutor(true);
      else Alert.alert(strings.people.title, strings.app.genericError);
    }
  }

  function confirm(message: string, action: string, onYes: () => void) {
    Alert.alert(strings.people.title, message, [
      { text: strings.app.cancel, style: "cancel" },
      { text: action, style: "destructive", onPress: onYes },
    ]);
  }

  return (
    <Screen>
      {lastTutor ? (
        <Card className="gap-3 border-late bg-late-tint" testID="last-tutor">
          <Text className="font-semibold text-late">{strings.people.lastTutorTitle}</Text>
          <Text>{strings.people.lastTutorBody}</Text>
          <Button
            label={strings.people.inviteTutor}
            testID="invite-tutor"
            onPress={() => router.push(`/animais/${id}/convidar?papel=tutor` as never)}
          />
          <Button
            variant="destructive"
            label={strings.people.deleteInstead}
            testID="delete-instead"
            onPress={() =>
              confirmDeleteAnimal(id, name, () => {
                void refreshAnimal(queryClient);
                router.replace("/");
              })
            }
          />
        </Card>
      ) : null}
      {accesses.data.map((access) => (
        <Card key={access.id} className="gap-2" testID={`access-${access.email}`}>
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 font-medium" numberOfLines={1}>
              {access.email}
              {access.is_me ? <Text className="text-muted-foreground">{` (${strings.people.you})`}</Text> : null}
            </Text>
            <Muted>{ROLE_LABEL[access.role]}</Muted>
          </View>
          {access.ends_on ? <Muted>{strings.people.until(formatDate(access.ends_on))}</Muted> : null}
          {access.is_me ? (
            <Button
              size="sm"
              variant="destructive"
              className="self-start"
              label={strings.animal.leave}
              testID="leave"
              onPress={() => confirm(strings.people.leaveConfirm(name), strings.animal.leave, () => void drop(access.id, true))}
            />
          ) : tutor ? (
            <Button
              size="sm"
              variant="destructive"
              className="self-start"
              label={strings.people.remove}
              testID={`remove-${access.email}`}
              onPress={() =>
                confirm(strings.people.removeConfirm(access.email), strings.people.remove, () => void drop(access.id, false))
              }
            />
          ) : null}
        </Card>
      ))}
      {tutor && animal.data.status === "active" ? (
        <Button size="lg" label={strings.people.invite} testID="invite" onPress={() => router.push(`/animais/${id}/convidar` as never)} />
      ) : null}
    </Screen>
  );
}
