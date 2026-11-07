import { RECORD_KIND_LABEL } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { router } from "expo-router";
import { Bug, Camera, ChevronRight, NotebookPen, Scale, Stethoscope, Syringe } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Sheet } from "@/components/ui/sheet";
import { Muted, Text } from "@/components/ui/text";
import type { RecordKind } from "@/lib/records";
import { colors } from "@/lib/theme";
import { cn } from "@/lib/utils";

const S = strings.animal;

export const KIND_ICON = {
  vaccine: Syringe,
  antiparasitic: Bug,
  weight: Scale,
  note: NotebookPen,
  visit: Stethoscope,
} as const;

const TUTOR_KINDS: RecordKind[] = ["vaccine", "antiparasitic", "weight", "note", "visit"];
const GUEST_KINDS: RecordKind[] = ["weight", "note"];

export function newRecordHref(id: string, kind: RecordKind, params: Record<string, string> = {}) {
  const query = new URLSearchParams({ tipo: kind, ...params }).toString();
  return `/animais/${id}/registro?${query}`;
}

/**
 * "Registrar": every way to record something, by the viewer's role. A tutor
 * gets the reading of the paper card's photos first, standing out, and the
 * five kinds by hand below it; a guest, weight and note.
 */
export function RegisterSheet({
  animalId,
  tutor,
  visible,
  onClose,
}: {
  animalId: string;
  tutor: boolean;
  visible: boolean;
  onClose: () => void;
}) {
  const go = (href: string) => {
    onClose();
    router.push(href as never);
  };
  const kinds = tutor ? TUTOR_KINDS : GUEST_KINDS;
  return (
    <Sheet visible={visible} onClose={onClose} testID="register-sheet">
      <Text role="heading" className="text-base font-semibold">
        {S.addRecord}
      </Text>
      {tutor ? (
        <>
          <Pressable
            role="button"
            testID="register-photos"
            onPress={() => go(`/animais/${animalId}/foto`)}
            className="flex-row items-center gap-3 rounded-2xl border border-primary/20 bg-accent p-3.5 active:opacity-80"
          >
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary">
              <Camera color={colors["primary-foreground"]} size={20} />
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-primary">{S.readPhotos}</Text>
              <Muted className="text-foreground/75">{S.readPhotosHint}</Muted>
            </View>
          </Pressable>
          <Text className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{S.byHand}</Text>
        </>
      ) : null}
      <View className="overflow-hidden rounded-2xl border border-border bg-card">
        {kinds.map((kind, i) => {
          const Icon = KIND_ICON[kind];
          return (
            <Pressable
              key={kind}
              role="button"
              testID={`register-${kind}`}
              onPress={() => go(newRecordHref(animalId, kind))}
              className={cn("flex-row items-center gap-3 px-3.5 py-3 active:bg-muted", i > 0 && "border-t border-border")}
            >
              <Icon color={colors.primary} size={20} />
              <Text className="flex-1 font-medium">{RECORD_KIND_LABEL[kind]}</Text>
              <ChevronRight color={colors["muted-foreground"]} size={16} />
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}
