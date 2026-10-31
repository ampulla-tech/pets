import type { AnimalIn, AnimalOut } from "@pets/core/api/generated";
import { strings } from "@pets/core/strings";
import { Image } from "expo-image";
import { useState } from "react";
import { View } from "react-native";

import { FilePicker } from "@/components/FilePicker";
import { Button } from "@/components/ui/button";
import { DateInput, MonthInput } from "@/components/ui/date-input";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { Segmented } from "@/components/ui/segmented";
import { Text } from "@/components/ui/text";
import { dayText, maskDay, readDay, readMonth } from "@/lib/dates";
import type { PickedFile } from "@/lib/files";

type Precision = NonNullable<AnimalIn["birth"]>["precision"];
type Neutered = "yes" | "no" | "unknown";

function birthText(animal?: AnimalOut): string {
  const birth = animal?.birth;
  if (!birth?.value) return "";
  if (birth.precision === "exact") return dayText(birth.value);
  if (birth.precision === "month") {
    const [year, month] = birth.value.split("-");
    return `${month}/${year}`;
  }
  return birth.value.slice(0, 4);
}

export interface AnimalFormResult {
  payload: AnimalIn;
  photo: PickedFile | null;
}

/** The animal's profile, for registering it and for editing it. */
export function AnimalForm({
  animal,
  speciesLocked,
  busy,
  error,
  onSubmit,
  footer,
}: {
  animal?: AnimalOut;
  speciesLocked?: boolean;
  busy: boolean;
  error?: string | null;
  onSubmit(result: AnimalFormResult): void;
  footer?: React.ReactNode;
}) {
  const [species, setSpecies] = useState<AnimalIn["species"]>(animal?.species ?? "dog");
  const [name, setName] = useState(animal?.name ?? "");
  const [breed, setBreed] = useState(animal?.breed ?? "");
  const [sex, setSex] = useState<"male" | "female" | "">(animal?.sex ?? "");
  const [neutered, setNeutered] = useState<Neutered>(
    animal?.neutered === true ? "yes" : animal?.neutered === false ? "no" : "unknown",
  );
  const [coat, setCoat] = useState(animal?.coat ?? "");
  const [microchip, setMicrochip] = useState(animal?.microchip ?? "");
  const [precision, setPrecision] = useState<Precision>(animal?.birth.precision ?? "unknown");
  const [birth, setBirth] = useState(birthText(animal));
  const [adopted, setAdopted] = useState(dayText(animal?.adopted_on));
  const [photo, setPhoto] = useState<PickedFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  function birthValue(): string | null | false {
    if (precision === "unknown") return null;
    if (!birth.trim()) return false;
    if (precision === "exact") return readDay(birth) || false;
    if (precision === "month") return readMonth(birth) || false;
    return /^\d{4}$/.test(birth.trim()) ? birth.trim() : false;
  }

  function submit() {
    const value = birthValue();
    const adoptedOn = readDay(adopted);
    const found: Record<string, string | null> = {
      name: name.trim() ? null : strings.animal.nameRequired,
      birth:
        value !== false
          ? null
          : !birth.trim()
            ? strings.animal.birthRequired
            : precision === "year"
              ? strings.animal.birthYearInvalid
              : precision === "month"
                ? strings.animal.birthMonthInvalid
                : strings.records.dateRequired,
      adopted: adoptedOn === false ? strings.records.dateRequired : null,
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    onSubmit({
      payload: {
        species,
        name: name.trim(),
        breed: breed.trim(),
        sex,
        neutered: neutered === "yes" ? true : neutered === "no" ? false : null,
        coat: coat.trim(),
        microchip: microchip.trim(),
        birth: { precision, value: value || null },
        adopted_on: adoptedOn || null,
      },
      photo: photo[0] ?? null,
    });
  }

  return (
    <Screen>
      <Field label={strings.animal.species} hint={speciesLocked ? strings.animal.speciesLocked : undefined}>
        <Segmented
          testID="species"
          value={species}
          onChange={setSpecies}
          disabled={speciesLocked}
          options={[
            { value: "dog", label: "Cão" },
            { value: "cat", label: "Gato" },
          ]}
        />
      </Field>
      <Field label={strings.animal.name} error={errors.name}>
        <Input testID="animal-name" value={name} onChangeText={setName} invalid={!!errors.name} />
      </Field>
      <Field label={strings.animal.photo} optional>
        {animal?.photo_url && photo.length === 0 ? (
          <Image source={{ uri: animal.photo_url }} style={{ width: 96, height: 96, borderRadius: 16 }} />
        ) : null}
        <FilePicker files={photo} onChange={setPhoto} multiple={false} />
      </Field>
      <Field label={strings.animal.breed} optional>
        <Input testID="breed" value={breed} onChangeText={setBreed} />
      </Field>
      <Field label={strings.animal.sex} optional>
        <Segmented
          testID="sex"
          value={sex}
          onChange={setSex}
          options={[
            { value: "male", label: "Macho" },
            { value: "female", label: "Fêmea" },
            { value: "", label: "Não informado" },
          ]}
        />
      </Field>
      <Field label={strings.animal.neutered}>
        <Segmented
          testID="neutered"
          value={neutered}
          onChange={setNeutered}
          options={[
            { value: "yes", label: strings.animal.yes },
            { value: "no", label: strings.animal.no },
            { value: "unknown", label: strings.animal.unknown },
          ]}
        />
      </Field>
      <Field label={strings.animal.coat} optional>
        <Input testID="coat" value={coat} onChangeText={setCoat} />
      </Field>
      <Field label={strings.animal.microchip} optional>
        <Input testID="microchip" value={microchip} onChangeText={setMicrochip} keyboardType="number-pad" />
      </Field>
      <Field label={strings.animal.birth} error={errors.birth}>
        <Segmented
          testID="birth-precision"
          value={precision}
          onChange={(next) => {
            setPrecision(next);
            setBirth("");
          }}
          options={[
            { value: "exact", label: strings.animal.birthExact },
            { value: "month", label: strings.animal.birthMonth },
            { value: "year", label: strings.animal.birthYear },
            { value: "unknown", label: strings.animal.birthUnknown },
          ]}
        />
        {precision === "exact" ? (
          <DateInput testID="birth" value={birth} onChange={setBirth} invalid={!!errors.birth} />
        ) : precision === "month" ? (
          <MonthInput testID="birth" value={birth} onChange={setBirth} invalid={!!errors.birth} />
        ) : precision === "year" ? (
          <Input
            testID="birth"
            value={birth}
            onChangeText={(t) => setBirth(t.replace(/\D/g, "").slice(0, 4))}
            placeholder={strings.animal.birthPlaceholderYear}
            keyboardType="number-pad"
            invalid={!!errors.birth}
          />
        ) : null}
      </Field>
      <Field label={strings.animal.adoptedOn} optional error={errors.adopted}>
        <DateInput testID="adopted" value={adopted} onChange={(t) => setAdopted(maskDay(t))} invalid={!!errors.adopted} />
      </Field>
      {error ? (
        <Text role="alert" className="text-late">
          {error}
        </Text>
      ) : null}
      <View className="gap-2 pt-2">
        <Button size="lg" label={strings.app.save} busy={busy} onPress={submit} testID="save-animal" />
        {footer}
      </View>
    </Screen>
  );
}
