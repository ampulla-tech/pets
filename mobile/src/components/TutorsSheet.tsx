import type { AnimalOut } from "@pets/core/api/generated";
import { removeAccess } from "@pets/core/api/generated";
import { listAccessesOptions } from "@pets/core/api/query";
import { formatDate, initialOf, ofAnimal } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";

import { Sheet } from "@/components/ui/sheet";
import { Muted, Text } from "@/components/ui/text";
import { refreshAnimal } from "@/lib/invalidate";
import { colors } from "@/lib/theme";
import { cn } from "@/lib/utils";

const P = strings.people;

/**
 * Tutores, for a guest: who to talk to about the animal, when the guest's own
 * access ends, and leaving it. The server tells a guest no other guest.
 */
export function TutorsSheet({ animal, visible, onClose }: { animal: AnimalOut; visible: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const accesses = useQuery({ ...listAccessesOptions({ path: { animal_id: animal.id } }), enabled: visible });
  const tutors = (accesses.data ?? []).filter((a) => a.role === "tutor");
  const mine = accesses.data?.find((a) => a.is_me);

  function leave() {
    if (!mine) return;
    Alert.alert(strings.animal.leave, P.leaveConfirm(animal.name), [
      { text: strings.app.cancel, style: "cancel" },
      {
        text: strings.animal.leave,
        style: "destructive",
        onPress: async () => {
          try {
            await removeAccess({ path: { animal_id: animal.id, access_id: mine.id }, throwOnError: true });
            onClose();
            await refreshAnimal(queryClient);
            router.replace("/");
          } catch {
            Alert.alert(strings.animal.leave, strings.app.genericError);
          }
        },
      },
    ]);
  }

  return (
    <Sheet visible={visible} onClose={onClose} testID="tutors-sheet">
      <View className="gap-1">
        <Text role="heading" className="text-base font-semibold">
          {P.tutorsTitle(ofAnimal(animal))}
        </Text>
        <Muted>{P.tutorsHint}</Muted>
      </View>
      {accesses.isPending ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <View className="overflow-hidden rounded-2xl border border-border bg-card">
            {tutors.map((tutor, i) => (
              <View
                key={tutor.id}
                testID={`tutor-${tutor.email}`}
                className={cn("flex-row items-center gap-2.5 px-3 py-2.5", i > 0 && "border-t border-border")}
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-accent">
                  <Text className="text-sm font-bold text-primary">{initialOf(tutor.email)}</Text>
                </View>
                <Text className="flex-1 font-medium" numberOfLines={1}>
                  {tutor.email}
                </Text>
              </View>
            ))}
          </View>
          {mine?.ends_on ? <Muted>{P.accessUntil(formatDate(mine.ends_on))}</Muted> : null}
          {mine ? (
            <Pressable role="button" testID="tutors-leave" onPress={leave} className="self-start py-1 active:opacity-60">
              <Text className="font-medium text-late">{strings.animal.leave}</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </Sheet>
  );
}
