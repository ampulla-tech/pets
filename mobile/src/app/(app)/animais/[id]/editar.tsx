import { updateAnimal } from "@pets/core/api/generated";
import { getAnimalOptions } from "@pets/core/api/query";
import { strings } from "@pets/core/strings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import { AnimalForm, type AnimalFormResult } from "@/components/AnimalForm";
import { ErrorState, Loading } from "@/components/ui/screen";
import { uploadAnimalPhoto } from "@/lib/files";
import { refreshAnimal } from "@/lib/invalidate";
import { useRecords } from "@/lib/use-records";
import { readFailure } from "@pets/core/api";

export default function EditAnimalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const animal = useQuery(getAnimalOptions({ path: { animal_id: id } }));
  const records = useRecords(id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (animal.isPending) return <Loading />;
  if (animal.isError) return <ErrorState message={strings.animal.notFound} />;

  const speciesLocked = !!records.data?.some((r) => r.kind === "vaccine");

  async function save({ payload, photo }: AnimalFormResult) {
    setBusy(true);
    setError(null);
    try {
      await updateAnimal({ path: { animal_id: id }, body: payload, throwOnError: true });
      if (photo) {
        await uploadAnimalPhoto(id, photo).catch(() => Alert.alert(strings.animal.photo, strings.animal.photoFailed));
      }
      await refreshAnimal(queryClient);
      router.back();
    } catch (failure) {
      setError(readFailure(failure).status === 422 ? strings.animal.speciesLocked : strings.app.genericError);
    } finally {
      setBusy(false);
    }
  }

  return <AnimalForm animal={animal.data} speciesLocked={speciesLocked} busy={busy} error={error} onSubmit={save} />;
}
