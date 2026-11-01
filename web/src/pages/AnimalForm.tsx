import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useNavigate, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { readFailure } from "@pets/core/api";
import {
  createAnimal,
  setAnimalPhoto,
  updateAnimal,
  type AnimalIn,
} from "@pets/core/api/generated";
import { SPECIES_LABEL } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { AnimalAvatar } from "@/components/AnimalAvatar";
import { ChoiceGroup, Field } from "@/components/Field";
import { ErrorState, Loading, Notice } from "@/components/Feedback";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { monthValue } from "@/lib/dates";
import { refreshAll, useAnimal } from "@/lib/queries";
import type { AnimalOut } from "@/lib/types";

const S = strings.animal;

const schema = z
  .object({
    species: z.enum(["dog", "cat"]),
    name: z.string().trim().min(1, S.nameRequired).max(80),
    breed: z.string(),
    sex: z.enum(["male", "female", ""]),
    neutered: z.enum(["yes", "no", "unknown"]),
    coat: z.string(),
    microchip: z.string(),
    birthPrecision: z.enum(["exact", "month", "year", "unknown"]),
    birthValue: z.string(),
    adoptedOn: z.string(),
  })
  .superRefine((value, ctx) => {
    const v = value.birthValue.trim();
    const fail = (message: string) =>
      ctx.addIssue({ code: "custom", path: ["birthValue"], message });
    if (value.birthPrecision === "unknown") return;
    if (!v) return fail(S.birthRequired);
    if (value.birthPrecision === "month" && !monthValue(v))
      return fail(S.birthMonthInvalid);
    if (value.birthPrecision === "year" && !/^\d{4}$/.test(v))
      return fail(S.birthYearInvalid);
  });

type Values = z.infer<typeof schema>;

function toValues(animal?: AnimalOut): Values {
  return {
    species: animal?.species ?? "dog",
    name: animal?.name ?? "",
    breed: animal?.breed ?? "",
    sex: animal?.sex ?? "",
    neutered:
      animal?.neutered === true ? "yes" : animal?.neutered === false ? "no" : "unknown",
    coat: animal?.coat ?? "",
    microchip: animal?.microchip ?? "",
    birthPrecision: animal?.birth.precision ?? "unknown",
    birthValue: animal?.birth.value ?? "",
    adoptedOn: animal?.adopted_on ?? "",
  };
}

function toBody(values: Values): AnimalIn {
  const v = values.birthValue.trim();
  return {
    species: values.species,
    name: values.name.trim(),
    breed: values.breed.trim(),
    sex: values.sex,
    neutered: values.neutered === "yes" ? true : values.neutered === "no" ? false : null,
    coat: values.coat.trim(),
    microchip: values.microchip.trim(),
    birth: {
      precision: values.birthPrecision,
      value:
        values.birthPrecision === "unknown"
          ? null
          : values.birthPrecision === "month"
            ? monthValue(v)
            : v,
    },
    adopted_on: values.adoptedOn || null,
  };
}

/** `/animais/novo` and `/animais/:id/editar`. */
export function AnimalForm() {
  const { id } = useParams();
  if (!id) return <AnimalFormBody />;
  return <EditAnimal id={id} />;
}

function EditAnimal({ id }: { id: string }) {
  const animal = useAnimal(id);
  if (animal.isPending)
    return (
      <Page title={S.editTitle} back={`/animais/${id}`}>
        <Loading />
      </Page>
    );
  if (animal.isError)
    return (
      <Page title={S.editTitle} back={`/animais/${id}`}>
        <ErrorState message={S.notFound} />
      </Page>
    );
  return <AnimalFormBody animal={animal.data} />;
}

function AnimalFormBody({ animal }: { animal?: AnimalOut }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const [failure, setFailure] = useState<string | null>(
    (location.state as { photoFailed?: boolean } | null)?.photoFailed
      ? S.photoFailed
      : null,
  );
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toValues(animal),
  });
  const precision = form.watch("birthPrecision");
  const species = form.watch("species");
  const name = form.watch("name");
  const { errors, isSubmitting } = form.formState;
  const back = animal ? `/animais/${animal.id}` : "/";

  const onSubmit = form.handleSubmit(async (values) => {
    setFailure(null);
    let saved: AnimalOut;
    try {
      const body = toBody(values);
      saved = animal
        ? (
            await updateAnimal({
              path: { animal_id: animal.id },
              body,
              throwOnError: true,
            })
          ).data
        : (await createAnimal({ body, throwOnError: true })).data;
    } catch (error) {
      const { status } = readFailure(error);
      setFailure(
        status === 422 && animal && values.species !== animal.species
          ? S.speciesLocked
          : strings.app.genericError,
      );
      return;
    }
    if (photo) {
      try {
        await setAnimalPhoto({
          path: { animal_id: saved.id },
          body: { file: photo },
          throwOnError: true,
        });
      } catch {
        await refreshAll(queryClient);
        navigate(`/animais/${saved.id}/editar`, {
          replace: true,
          state: { photoFailed: true },
        });
        return;
      }
    }
    await refreshAll(queryClient);
    navigate(`/animais/${saved.id}`, { replace: true });
  });

  return (
    <Page title={animal ? S.editTitle : S.newTitle} back={back}>
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <div className="flex items-center gap-4">
          <AnimalAvatar
            name={name || S.photo}
            species={species}
            photoUrl={preview ?? animal?.photo_url}
            className="size-20"
          />
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label={S.photo}
            onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => fileInput.current?.click()}
          >
            <Camera />
            {animal?.photo_url || photo ? S.changePhoto : S.pickPhoto}
          </Button>
        </div>

        <Controller
          control={form.control}
          name="species"
          render={({ field }) => (
            <ChoiceGroup
              label={S.species}
              name="species"
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: "dog", label: SPECIES_LABEL.dog },
                { value: "cat", label: SPECIES_LABEL.cat },
              ]}
            />
          )}
        />
        <Field label={S.name} error={errors.name?.message}>
          {(control) => (
            <Input {...control} autoComplete="off" {...form.register("name")} />
          )}
        </Field>
        <Field label={S.breed} optional>
          {(control) => <Input {...control} {...form.register("breed")} />}
        </Field>
        <Controller
          control={form.control}
          name="sex"
          render={({ field }) => (
            <ChoiceGroup
              label={S.sex}
              name="sex"
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: "male", label: "Macho" },
                { value: "female", label: "Fêmea" },
                { value: "", label: S.unknown },
              ]}
            />
          )}
        />
        <Controller
          control={form.control}
          name="neutered"
          render={({ field }) => (
            <ChoiceGroup
              label={S.neutered}
              name="neutered"
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: "yes", label: S.yes },
                { value: "no", label: S.no },
                { value: "unknown", label: S.unknown },
              ]}
            />
          )}
        />
        <Field label={S.coat} optional>
          {(control) => <Input {...control} {...form.register("coat")} />}
        </Field>
        <Field label={S.microchip} optional>
          {(control) => (
            <Input {...control} inputMode="numeric" {...form.register("microchip")} />
          )}
        </Field>

        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <Controller
            control={form.control}
            name="birthPrecision"
            render={({ field }) => (
              <ChoiceGroup
                label={S.birth}
                name="birthPrecision"
                value={field.value}
                onChange={(next) => {
                  field.onChange(next);
                  form.setValue("birthValue", "");
                  form.clearErrors("birthValue");
                }}
                options={[
                  { value: "exact", label: S.birthExact },
                  { value: "month", label: S.birthMonth },
                  { value: "year", label: S.birthYear },
                  { value: "unknown", label: S.birthUnknown },
                ]}
              />
            )}
          />
          {precision === "exact" ? (
            <Field label={S.birthExact} error={errors.birthValue?.message}>
              {(control) => (
                <Input {...control} type="date" {...form.register("birthValue")} />
              )}
            </Field>
          ) : precision === "month" ? (
            <Field label={S.birthMonth} error={errors.birthValue?.message}>
              {(control) => (
                <Input
                  {...control}
                  type="month"
                  placeholder={S.birthPlaceholderMonth}
                  {...form.register("birthValue")}
                />
              )}
            </Field>
          ) : precision === "year" ? (
            <Field label={S.birthYear} error={errors.birthValue?.message}>
              {(control) => (
                <Input
                  {...control}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder={S.birthPlaceholderYear}
                  {...form.register("birthValue")}
                />
              )}
            </Field>
          ) : null}
        </div>

        <Field label={S.adoptedOn} optional>
          {(control) => (
            <Input {...control} type="date" {...form.register("adoptedOn")} />
          )}
        </Field>

        {failure ? <Notice tone="error">{failure}</Notice> : null}
        <Button type="submit" size="xl" disabled={isSubmitting}>
          {isSubmitting ? strings.app.saving : strings.app.save}
        </Button>
      </form>
    </Page>
  );
}
