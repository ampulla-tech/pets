import type { AnimalOut } from "@pets/core/api/generated";
import { getAnimalOptions, listAnimalRemindersOptions } from "@pets/core/api/query";
import {
  animalLine,
  formatBirth,
  formatDate,
  groupReminders,
  groupTitle,
  ofAnimal,
  reminderText,
  SEX_LABEL,
} from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Archive, Camera, Ellipsis, IdCard, Pencil, Plus, Scale, Syringe, Trash2, Users } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, RefreshControl, View } from "react-native";

import { AnimalAvatar } from "@/components/AnimalAvatar";
import { DashedBox } from "@/components/DashedBox";
import { newRecordHref, RegisterSheet } from "@/components/RegisterSheet";
import { ReminderRow } from "@/components/ReminderRow";
import { WeightCard } from "@/components/WeightCard";
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

        {records.isPending ? null : all.length === 0 ? (
          <NothingYet animal={a} />
        ) : (
          <>
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
                <DashedBox
                  testID="reminders-empty"
                  action={
                    tutor && active ? (
                      <HintButton
                        label={strings.animal.registerVaccine}
                        testID="hint-vaccine"
                        icon={<Syringe color={colors.primary} size={16} />}
                        onPress={() => router.push(newRecordHref(id, "vaccine") as never)}
                      />
                    ) : null
                  }
                >
                  {strings.animal.remindersEmpty}
                </DashedBox>
              )}
            </Section>

            <Section caps title={strings.animal.lastWeight}>
              {a.last_weight ? (
                <WeightCard kg={a.last_weight.kg} weighings={weights} />
              ) : (
                <DashedBox
                  testID="weight-empty"
                  action={
                    active ? (
                      <HintButton
                        label={strings.animal.registerWeight}
                        testID="hint-weight"
                        icon={<Plus color={colors.primary} size={16} />}
                        onPress={() => router.push(newRecordHref(id, "weight") as never)}
                      />
                    ) : null
                  }
                >
                  {strings.animal.noWeight}
                </DashedBox>
              )}
            </Section>
          </>
        )}

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

/** The button of an empty section, centred below its text. */
function HintButton({ label, icon, onPress, testID }: { label: string; icon: ReactNode; onPress: () => void; testID: string }) {
  return (
    <Pressable
      role="button"
      testID={testID}
      onPress={onPress}
      className="flex-row items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 active:opacity-70"
    >
      {icon}
      <Text className="text-sm font-semibold text-primary">{label}</Text>
    </Pressable>
  );
}

/**
 * An animal with nothing recorded: one block in the place of the reminders and
 * the weight, with the first step its viewer can take as the button.
 */
function NothingYet({ animal }: { animal: AnimalOut }) {
  const S = strings.animal;
  const tutor = animal.role === "tutor";
  return (
    <View testID="nothing-yet" className="items-center gap-2 px-5 py-6">
      <View className="mb-1 h-16 w-16 items-center justify-center rounded-full bg-accent">
        <IdCard color={colors.primary} size={28} />
      </View>
      <Text className="font-semibold">{S.nothingYet}</Text>
      <Muted className="text-center">{tutor ? S.nothingYetTutor(ofAnimal(animal)) : S.nothingYetGuest}</Muted>
      {animal.status === "active" ? (
        <Button
          className="mt-2"
          label={tutor ? S.readPhotos : S.registerWeight}
          testID="nothing-yet-action"
          icon={
            tutor ? (
              <Camera color={colors["primary-foreground"]} size={18} />
            ) : (
              <Scale color={colors["primary-foreground"]} size={18} />
            )
          }
          onPress={() =>
            router.push((tutor ? `/animais/${animal.id}/foto` : newRecordHref(animal.id, "weight")) as never)
          }
        />
      ) : null}
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
