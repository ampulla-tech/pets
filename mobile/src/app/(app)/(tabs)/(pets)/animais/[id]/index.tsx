import type { AnimalOut } from "@pets/core/api/generated";
import { getAnimalOptions, listAnimalRemindersOptions } from "@pets/core/api/query";
import {
  animalLine,
  formatBirth,
  formatDate,
  formatKg,
  groupReminders,
  groupTitle,
  reminderText,
  SEX_LABEL,
} from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Archive, Ellipsis, IdCard, Pencil, Plus, Trash2, Users } from "lucide-react-native";
import { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";

import { AnimalAvatar } from "@/components/AnimalAvatar";
import { newRecordHref, RegisterSheet } from "@/components/RegisterSheet";
import { ReminderRow } from "@/components/ReminderRow";
import { WeightChart } from "@/components/WeightChart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, Loading, Notice, Screen, Section } from "@/components/ui/screen";
import { MenuItem, Sheet } from "@/components/ui/sheet";
import { Muted, Text } from "@/components/ui/text";
import { confirmDeleteAnimal } from "@/lib/animal-actions";
import { refreshAnimal } from "@/lib/invalidate";
import type { AnyRecord } from "@/lib/records";
import { colors } from "@/lib/theme";
import { useRecords } from "@/lib/use-records";

export default function AnimalScreen() {
  const { id, assunto } = useLocalSearchParams<{ id: string; assunto?: string }>();
  const queryClient = useQueryClient();
  const path = { path: { animal_id: id } };
  const animal = useQuery(getAnimalOptions(path));
  const records = useRecords(id);
  const reminders = useQuery(listAnimalRemindersOptions(path));
  // The reminder the person tapped, whose actions show under it.
  const [picked, setPicked] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"register" | "menu" | null>(null);

  if (animal.isPending) return <Loading />;
  if (animal.isError) return <ErrorState message={strings.animal.notFound} onRetry={() => void animal.refetch()} />;

  const a = animal.data;
  const tutor = a.role === "tutor";
  const active = a.status === "active";
  const all = records.data ?? [];
  const weights = all
    .filter((r): r is Extract<AnyRecord, { kind: "weight" }> => r.kind === "weight")
    .map((r) => ({ date: r.date, kg: Number(r.kg) }));
  // A closed reminder is history (a later dose closed it); the list shows what is still open.
  const open = (reminders.data ?? []).filter((r) => r.state !== "closed");
  const groups = groupReminders(open);
  const focus = assunto ? groups.find((g) => g.subjects.includes(assunto)) : undefined;
  const brandOf = (recordId: string) => {
    const record = all.find((r) => r.id === recordId);
    if (record?.kind === "vaccine") return record.brand;
    if (record?.kind === "antiparasitic") return record.product;
    return null;
  };
  const focusName = focus ? groupTitle(focus, brandOf(focus.first.record_id)) : null;

  const refresh = () => {
    void animal.refetch();
    void records.refetch();
    void reminders.refetch();
  };

  const go = (href: string) => {
    setSheet(null);
    router.push(href as never);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: a.name,
          headerTitle: () => <HeaderTitle animal={a} />,
          headerRight: tutor
            ? () => (
                <Pressable
                  role="button"
                  accessibilityLabel={strings.animal.more}
                  testID="animal-more"
                  hitSlop={8}
                  onPress={() => setSheet("menu")}
                  className="px-1 active:opacity-60"
                >
                  <Ellipsis color={colors.foreground} size={22} />
                </Pressable>
              )
            : undefined,
        }}
      />
      <Screen
        testID="animal-screen"
        refreshControl={<RefreshControl refreshing={records.isRefetching} onRefresh={refresh} />}
      >
        {!active ? <Notice tone="soon">{strings.archive.readOnly}</Notice> : null}
        {active && !tutor ? <Notice>{strings.animal.guestNotice}</Notice> : null}

        <View className="flex-row flex-wrap gap-2">
          {active ? (
            <Button
              size="lg"
              className="w-full rounded-2xl"
              label={strings.animal.addRecord}
              testID="register"
              icon={<Plus color={colors["primary-foreground"]} size={18} />}
              onPress={() => setSheet("register")}
            />
          ) : null}
          <Button
            size="lg"
            variant="outline"
            className="flex-1 rounded-2xl"
            label={strings.animal.card}
            testID="open-card"
            icon={<IdCard color={colors.foreground} size={16} />}
            onPress={() => router.push(`/animais/${id}/carteirinha` as never)}
          />
          <Button
            size="lg"
            variant="outline"
            className="flex-1 rounded-2xl"
            label={tutor ? strings.animal.people : strings.animal.tutors}
            testID="open-people"
            icon={<Users color={colors.foreground} size={16} />}
            onPress={() => router.push(`/animais/${id}/pessoas` as never)}
          />
        </View>

        {focus ? (
          <Card className="gap-2 border-primary" testID="focus">
            <Text className="font-semibold">{focusName?.title}</Text>
            {focusName?.detail ? <Muted>{focusName.detail}</Muted> : null}
            <Muted>{reminderText(focus.first)}</Muted>
            {tutor && active ? (
              <Button
                label={strings.reminders.registerDose}
                testID="register-dose"
                onPress={() =>
                  router.push(newRecordHref(id, focus.first.record_kind, { dose: focus.first.record_id }) as never)
                }
              />
            ) : null}
          </Card>
        ) : null}

        <Section caps title={strings.animal.reminders}>
          {open.length > 0 ? (
            groups.map(({ first: reminder, ...group }) => (
              <View key={group.key} className="gap-1">
                <ReminderRow
                  group={{ first: reminder, ...group }}
                  brand={brandOf(reminder.record_id)}
                  highlighted={
                    picked === group.key ||
                    (picked === null && assunto !== undefined && group.subjects.includes(assunto))
                  }
                  onPress={
                    tutor && active
                      ? () => setPicked(picked === group.key ? "" : group.key)
                      : undefined
                  }
                />
                {picked === group.key && tutor && active ? (
                  <Button
                    size="sm"
                    className="self-start"
                    label={strings.reminders.registerDose}
                    testID={`register-dose-${reminder.subject}`}
                    onPress={() =>
                      router.push(newRecordHref(id, reminder.record_kind, { dose: reminder.record_id }) as never)
                    }
                  />
                ) : null}
                {reminder.state === "no_date" && tutor && active ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="self-start"
                    label={strings.reminders.setDate}
                    testID={`set-date-${reminder.subject}`}
                    onPress={() =>
                      router.push(
                        newRecordHref(id, reminder.record_kind, { registro: reminder.record_id, campo: "repeat_on" }) as never,
                      )
                    }
                  />
                ) : null}
              </View>
            ))
          ) : (
            <Muted>{strings.animal.remindersEmpty}</Muted>
          )}
        </Section>

        <Section caps title={strings.animal.lastWeight}>
          {a.last_weight ? (
            <Text testID="last-weight" className="text-lg font-semibold">
              {strings.animal.lastWeightOn(formatKg(a.last_weight.kg), formatDate(a.last_weight.date))}
            </Text>
          ) : (
            <Muted>{strings.animal.noWeight}</Muted>
          )}
          {weights.length > 0 ? <WeightChart points={weights} /> : null}
        </Section>

        <Section caps title={strings.animal.profile}>
          <Facts animal={a} />
        </Section>
      </Screen>

      <RegisterSheet animalId={id} tutor={tutor} visible={sheet === "register"} onClose={() => setSheet(null)} />
      <Sheet visible={sheet === "menu"} onClose={() => setSheet(null)} testID="animal-menu">
        <View>
          {active ? (
            <>
              <MenuItem
                label={strings.app.edit}
                icon={<Pencil color={colors.foreground} size={18} />}
                testID="edit-animal"
                onPress={() => go(`/animais/${id}/editar`)}
              />
              <MenuItem
                label={strings.animal.archive}
                icon={<Archive color={colors.foreground} size={18} />}
                testID="archive-animal"
                onPress={() => go(`/animais/${id}/arquivar`)}
              />
            </>
          ) : null}
          <MenuItem
            label={strings.animal.deleteAnimal}
            icon={<Trash2 color={colors.late} size={18} />}
            testID="delete-animal"
            destructive
            onPress={() => {
              setSheet(null);
              confirmDeleteAnimal(id, a.name, () => {
                void refreshAnimal(queryClient);
                router.replace("/");
              });
            }}
          />
        </View>
      </Sheet>
    </>
  );
}

/** The header's title: the photo (or the initial), the name, and who the animal is. */
function HeaderTitle({ animal }: { animal: AnimalOut }) {
  return (
    <View className="flex-row items-center gap-2.5" testID="animal-header">
      <AnimalAvatar animal={animal} size={36} initial />
      <View>
        <Text className="text-base font-semibold leading-tight">{animal.name}</Text>
        <Muted className="text-xs leading-tight">{animalLine(animal)}</Muted>
      </View>
    </View>
  );
}

/** The animal's data in two columns; what was not filled in is "—". */
function Facts({ animal }: { animal: AnimalOut }) {
  const S = strings.animal;
  const neutered = animal.neutered === null ? S.unknown : animal.neutered ? S.yes : S.no;
  const facts: [string, string][] = [
    [S.sex, SEX_LABEL[animal.sex]],
    [S.neutered, neutered],
    [S.birth, formatBirth(animal.birth)],
    [S.adoptedOn, formatDate(animal.adopted_on)],
    [S.coat, animal.coat || "—"],
    [S.microchip, animal.microchip || "—"],
  ];
  return (
    <Card className="flex-row flex-wrap gap-y-3 rounded-2xl p-3.5" testID="facts">
      {facts.map(([label, value]) => (
        <View key={label} className="w-1/2 pr-2">
          <Muted className="text-xs">{label}</Muted>
          <Text className="text-sm font-medium">{value}</Text>
        </View>
      ))}
    </Card>
  );
}
