import { getAnimalOptions, listAnimalRemindersOptions } from "@pets/core/api/query";
import {
  badgeText,
  formatAge,
  formatBirth,
  formatDate,
  formatKg,
  groupReminders,
  groupTitle,
  RECORD_KIND_LABEL,
  reminderText,
  SEX_LABEL,
  SPECIES_LABEL,
} from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Camera, FileText, Pencil, Archive, Trash2, Users } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, RefreshControl, View } from "react-native";

import { AnimalAvatar } from "@/components/AnimalAvatar";
import { RecordItem, type AnyRecord } from "@/components/RecordItem";
import { ReminderRow } from "@/components/ReminderRow";
import { WeightChart } from "@/components/WeightChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, Loading, Notice, Screen, Section } from "@/components/ui/screen";
import { Muted, Text } from "@/components/ui/text";
import { confirmDeleteAnimal } from "@/lib/animal-actions";
import { useCatalog } from "@/lib/catalog";
import { refreshAnimal } from "@/lib/invalidate";
import { deleteRecord, type RecordKind } from "@/lib/records";
import { colors } from "@/lib/theme";
import { useRecords } from "@/lib/use-records";
import { cn } from "@/lib/utils";

type Filter = "all" | RecordKind;

function recordHref(id: string, kind: RecordKind, params: Record<string, string> = {}) {
  const query = new URLSearchParams({ tipo: kind, ...params }).toString();
  return `/animais/${id}/registro?${query}`;
}

export default function AnimalScreen() {
  const { id, assunto } = useLocalSearchParams<{ id: string; assunto?: string }>();
  const queryClient = useQueryClient();
  const path = { path: { animal_id: id } };
  const animal = useQuery(getAnimalOptions(path));
  const records = useRecords(id);
  const reminders = useQuery(listAnimalRemindersOptions(path));
  const { label } = useCatalog();
  const [filter, setFilter] = useState<Filter>("all");
  // The reminder the person tapped, whose actions show under it.
  const [picked, setPicked] = useState<string | null>(null);

  if (animal.isPending) return <Loading />;
  if (animal.isError) return <ErrorState message={strings.animal.notFound} onRetry={() => void animal.refetch()} />;

  const a = animal.data;
  const tutor = a.role === "tutor";
  const active = a.status === "active";
  const badge = badgeText(a.badge);
  const age = formatAge(a.age);
  const all = records.data ?? [];
  const weights = all
    .filter((r): r is Extract<AnyRecord, { kind: "weight" }> => r.kind === "weight")
    .map((r) => ({ date: r.date, kg: Number(r.kg) }));
  const shown = filter === "all" ? all : all.filter((r) => r.kind === filter);
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
  const kinds: RecordKind[] = tutor ? ["vaccine", "antiparasitic", "weight", "note", "visit"] : ["weight", "note"];

  const refresh = () => {
    void animal.refetch();
    void records.refetch();
    void reminders.refetch();
  };

  function remove(record: AnyRecord) {
    Alert.alert(strings.records.deleteConfirm, undefined, [
      { text: strings.app.cancel, style: "cancel" },
      {
        text: strings.app.delete,
        style: "destructive",
        onPress: async () => {
          await deleteRecord(record.kind, id, record.id).catch(() =>
            Alert.alert(strings.app.delete, strings.app.genericError),
          );
          await refreshAnimal(queryClient);
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: a.name }} />
      <Screen
        testID="animal-screen"
        refreshControl={<RefreshControl refreshing={records.isRefetching} onRefresh={refresh} />}
      >
        <View className="flex-row items-center gap-4">
          <AnimalAvatar animal={a} size={88} />
          <View className="flex-1 gap-1">
            <Text className="text-2xl font-bold">{a.name}</Text>
            <Muted>{[SPECIES_LABEL[a.species], a.breed, SEX_LABEL[a.sex]].filter(Boolean).join(" · ")}</Muted>
            {age ? <Muted>{`${strings.animal.age}: ${age}`}</Muted> : null}
            {badge && active ? <Badge text={badge.text} tone={badge.tone} /> : null}
          </View>
        </View>

        {!active ? <Notice tone="soon">{strings.archive.readOnly}</Notice> : null}
        {active && !tutor ? <Notice>{strings.animal.guestNotice}</Notice> : null}

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
                  router.push(recordHref(id, focus.first.record_kind, { dose: focus.first.record_id }) as never)
                }
              />
            ) : null}
          </Card>
        ) : null}

        {active ? (
          <Section title={strings.animal.addRecord}>
            <View className="flex-row flex-wrap gap-2">
              {kinds.map((kind) => (
                <Button
                  key={kind}
                  size="sm"
                  variant="secondary"
                  label={RECORD_KIND_LABEL[kind]}
                  testID={`add-${kind}`}
                  onPress={() => router.push(recordHref(id, kind) as never)}
                />
              ))}
            </View>
            {tutor ? (
              <Button
                variant="outline"
                label={strings.animal.addByPhoto}
                testID="add-by-photo"
                icon={<Camera color={colors.foreground} size={18} />}
                onPress={() => router.push(`/animais/${id}/foto` as never)}
              />
            ) : null}
          </Section>
        ) : null}

        <Section title={strings.animal.lastWeight}>
          {a.last_weight ? (
            <Text testID="last-weight" className="text-lg font-semibold">
              {strings.animal.lastWeightOn(formatKg(a.last_weight.kg), formatDate(a.last_weight.date))}
            </Text>
          ) : (
            <Muted>{strings.animal.noWeight}</Muted>
          )}
          {weights.length > 0 ? <WeightChart points={weights} /> : null}
        </Section>

        <Section title={strings.animal.reminders}>
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
                      router.push(recordHref(id, reminder.record_kind, { dose: reminder.record_id }) as never)
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
                        recordHref(id, reminder.record_kind, { registro: reminder.record_id, campo: "repeat_on" }) as never,
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

        <Section title={strings.animal.profile}>
          <Card className="gap-1">
            <Muted>{`${strings.animal.birth}: ${formatBirth(a.birth)}`}</Muted>
            {a.adopted_on ? <Muted>{`${strings.animal.adoptedOn}: ${formatDate(a.adopted_on)}`}</Muted> : null}
            <Muted>{`${strings.animal.neutered}: ${a.neutered === null ? strings.animal.unknown : a.neutered ? strings.animal.yes : strings.animal.no}`}</Muted>
            {a.coat ? <Muted>{`${strings.animal.coat}: ${a.coat}`}</Muted> : null}
            {a.microchip ? <Muted>{`${strings.animal.microchip}: ${a.microchip}`}</Muted> : null}
          </Card>
          <View className="flex-row flex-wrap gap-2">
            <Button size="sm" variant="outline" label={strings.animal.card} testID="open-card" icon={<FileText color={colors.foreground} size={16} />} onPress={() => router.push(`/animais/${id}/carteirinha` as never)} />
            <Button size="sm" variant="outline" label={strings.animal.people} testID="open-people" icon={<Users color={colors.foreground} size={16} />} onPress={() => router.push(`/animais/${id}/pessoas` as never)} />
            {tutor && active ? (
              <>
                <Button size="sm" variant="outline" label={strings.app.edit} testID="edit-animal" icon={<Pencil color={colors.foreground} size={16} />} onPress={() => router.push(`/animais/${id}/editar` as never)} />
                <Button size="sm" variant="outline" label={strings.animal.archive} testID="archive-animal" icon={<Archive color={colors.foreground} size={16} />} onPress={() => router.push(`/animais/${id}/arquivar` as never)} />
              </>
            ) : null}
            {tutor ? (
              <Button
                size="sm"
                variant="destructive"
                label={strings.animal.deleteAnimal}
                testID="delete-animal"
                icon={<Trash2 color={colors.late} size={16} />}
                onPress={() =>
                  confirmDeleteAnimal(id, a.name, () => {
                    void refreshAnimal(queryClient);
                    router.replace("/");
                  })
                }
              />
            ) : null}
          </View>
        </Section>

        <Section title={strings.animal.history}>
          <View className="flex-row flex-wrap gap-2" role="tablist">
            {(["all", "vaccine", "antiparasitic", "weight", "note", "visit"] as Filter[]).map((value) => (
              <Pressable
                key={value}
                role="tab"
                aria-selected={filter === value}
                accessibilityState={{ selected: filter === value }}
                testID={`filter-${value}`}
                onPress={() => setFilter(value)}
                className={cn(
                  "rounded-full border px-3 py-1.5",
                  filter === value ? "border-primary bg-primary" : "border-input bg-card",
                )}
              >
                <Text className={cn("text-sm", filter === value && "text-primary-foreground")}>
                  {value === "all" ? strings.native.allRecords : RECORD_KIND_LABEL[value]}
                </Text>
              </Pressable>
            ))}
          </View>
          {records.isPending ? null : shown.length === 0 ? (
            <Muted>{strings.animal.historyEmpty}</Muted>
          ) : (
            shown.map((record) => (
              <RecordItem
                key={record.id}
                record={record}
                label={label}
                editable={record.can_edit && active}
                onEdit={() => router.push(recordHref(id, record.kind, { registro: record.id }) as never)}
                onDelete={() => remove(record)}
              />
            ))
          )}
        </Section>
      </Screen>
    </>
  );
}
