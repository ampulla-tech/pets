import { createAnimal } from "@pets/core/api/generated";
import { strings } from "@pets/core/strings";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import { AnimalForm, type AnimalFormResult } from "@/components/AnimalForm";
import { uploadAnimalPhoto } from "@/lib/files";
import { refreshAnimal } from "@/lib/invalidate";
import { animalHref } from "@/lib/navigation";

export default function NewAnimalScreen() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save({ payload, photo }: AnimalFormResult) {
    setBusy(true);
    setError(null);
    try {
      const { data: animal } = await createAnimal({ body: payload, throwOnError: true });
      if (photo) {
        // The animal exists already; a photo that does not go up is said, not fatal.
        await uploadAnimalPhoto(animal.id, photo).catch(() => Alert.alert(strings.animal.photo, strings.animal.photoFailed));
      }
      await refreshAnimal(queryClient);
      router.replace(animalHref(animal.id) as never);
    } catch {
      setError(strings.app.genericError);
    } finally {
      setBusy(false);
    }
  }

  return <AnimalForm busy={busy} error={error} onSubmit={save} />;
}
