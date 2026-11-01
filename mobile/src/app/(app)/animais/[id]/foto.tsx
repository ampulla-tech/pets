import { confirmProposal, discardProposal, retryExtraction, type ExtractionOut } from "@pets/core/api/generated";
import { getAnimalOptions, getExtractionOptions } from "@pets/core/api/query";
import { strings } from "@pets/core/strings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Camera, ImageIcon, X } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Image } from "expo-image";

import { photoFromCamera } from "@/components/FilePicker";
import { ProposalCard } from "@/components/ProposalCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice, Screen } from "@/components/ui/screen";
import { Muted, Text } from "@/components/ui/text";
import { useCatalog } from "@/lib/catalog";
import { sendExtraction, type PickedFile } from "@/lib/files";
import { refreshAnimal } from "@/lib/invalidate";
import { animalHref } from "@/lib/navigation";
import { pickPhotos } from "@/lib/pickers";
import { colors } from "@/lib/theme";

const MAX_PHOTOS = 6;
const POLL_MS = 2000;

const FAILURE = {
  unconfigured: strings.intake.failedUnconfigured,
  provider: strings.intake.failedProvider,
  nothing_read: strings.intake.failedNothing,
  "": strings.intake.failedProvider,
} as const;

/** Photo intake (ADR-0005, docs/flows/photo-intake.md): send, follow, review. */
export default function IntakeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const animal = useQuery(getAnimalOptions({ path: { animal_id: id } }));
  const { diseasesOf } = useCatalog();
  const [photos, setPhotos] = useState<PickedFile[]>([]);
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [tooMany, setTooMany] = useState(false);

  const options = getExtractionOptions({ path: { extraction_id: extractionId ?? "" } });
  const extraction = useQuery({
    ...options,
    enabled: !!extractionId,
    refetchInterval: (query) => (query.state.data?.status === "processing" ? POLL_MS : false),
  });
  const keep = (data: ExtractionOut) => queryClient.setQueryData(options.queryKey, data);

  function add(more: PickedFile[]) {
    const next = [...photos, ...more];
    setTooMany(next.length > MAX_PHOTOS);
    setPhotos(next.slice(0, MAX_PHOTOS));
  }

  async function send() {
    setUploading(true);
    setUploadFailed(false);
    try {
      const created = await sendExtraction(id, photos);
      queryClient.setQueryData(
        getExtractionOptions({ path: { extraction_id: created.id } }).queryKey,
        created,
      );
      setExtractionId(created.id);
    } catch {
      setUploadFailed(true);
    } finally {
      setUploading(false);
    }
  }

  async function retry() {
    if (!extractionId) return;
    const { data } = await retryExtraction({ path: { extraction_id: extractionId }, throwOnError: true });
    keep(data);
  }

  const data = extraction.data;

  if (!extractionId || !data) {
    return (
      <Screen>
        <Muted className="text-base">{strings.intake.intro}</Muted>
        {photos.length ? (
          <View className="flex-row flex-wrap gap-3">
            {photos.map((photo, i) => (
              <View key={`${photo.uri}-${i}`} className="relative">
                <Image source={{ uri: photo.uri }} style={{ width: 96, height: 128, borderRadius: 8 }} contentFit="cover" />
                <Pressable
                  role="button"
                  accessibilityLabel={strings.intake.removePhoto(i + 1)}
                  onPress={() => setPhotos(photos.filter((_, j) => j !== i))}
                  className="absolute -right-2 -top-2 h-7 w-7 items-center justify-center rounded-full bg-foreground"
                >
                  <X color="#fff" size={14} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        {photos.length ? <Muted>{strings.intake.photosPicked(photos.length)}</Muted> : null}
        {tooMany ? <Notice tone="soon">{strings.intake.tooMany}</Notice> : null}
        <View className="flex-row gap-2">
          <Button
            className="flex-1"
            variant="outline"
            label={strings.intake.takePhoto}
            icon={<Camera color={colors.foreground} size={18} />}
            testID="intake-camera"
            onPress={async () => {
              const photo = await photoFromCamera();
              if (photo) add([photo]);
            }}
          />
          <Button
            className="flex-1"
            variant="outline"
            label={strings.intake.pickPhotos}
            icon={<ImageIcon color={colors.foreground} size={18} />}
            testID="intake-gallery"
            onPress={async () => add(await pickPhotos({ multiple: true, limit: MAX_PHOTOS - photos.length }))}
          />
        </View>
        {uploadFailed ? <Notice tone="late">{strings.intake.uploadFailed}</Notice> : null}
        <Button
          size="lg"
          label={uploading ? strings.intake.uploading : uploadFailed ? strings.app.retry : strings.intake.send}
          busy={uploading}
          disabled={photos.length === 0}
          onPress={send}
          testID="intake-send"
        />
      </Screen>
    );
  }

  if (data.status === "processing") {
    return (
      <Screen>
        <Card className="items-center gap-3 py-10" testID="intake-processing">
          <ActivityIndicator color={colors.primary} />
          <Text>{strings.intake.processing}</Text>
        </Card>
      </Screen>
    );
  }

  if (data.status === "failed") {
    const photoIds = data.photos.map((p) => p.id).join(",");
    return (
      <Screen>
        <Card className="gap-3" testID="intake-failed">
          <Text className="text-lg font-semibold">{strings.intake.failedTitle}</Text>
          <Text>{FAILURE[data.error]}</Text>
          <Button label={strings.app.retry} testID="intake-retry" onPress={() => void retry()} />
          <Button
            variant="outline"
            label={strings.intake.fillByHand}
            testID="intake-by-hand"
            onPress={() => router.replace(`/animais/${id}/registro?tipo=vaccine&anexos=${photoIds}` as never)}
          />
        </Card>
      </Screen>
    );
  }

  const species = animal.data?.species ?? "dog";
  const options_ = diseasesOf(species).map((d) => ({ value: d.code, label: d.label }));
  const pending = data.proposals.filter((p) => p.review === "pending").length;

  return (
    <Screen>
      <Text role="heading" className="text-xl font-semibold">
        {strings.intake.reviewTitle}
      </Text>
      <Muted>{strings.intake.reviewIntro}</Muted>
      {data.proposals.length === 0 ? <Muted>{strings.intake.noLines}</Muted> : null}
      {data.proposals.map((proposal) => (
        <ProposalCard
          key={proposal.index}
          proposal={proposal}
          diseases={options_}
          onConfirm={async (record) => {
            await confirmProposal({
              path: { extraction_id: data.id, index: proposal.index },
              body: { record },
              throwOnError: true,
            });
            await extraction.refetch();
            await refreshAnimal(queryClient);
          }}
          onDiscard={async () => {
            const { data: next } = await discardProposal({
              path: { extraction_id: data.id, index: proposal.index },
              throwOnError: true,
            });
            keep(next);
          }}
        />
      ))}
      {pending === 0 && data.proposals.length > 0 ? <Notice>{strings.intake.allReviewed}</Notice> : null}
      <Button
        variant={pending === 0 ? "default" : "outline"}
        label={pending === 0 ? strings.intake.done : strings.intake.backToAnimal}
        onPress={() => router.replace(animalHref(id) as never)}
        testID="intake-done"
      />
    </Screen>
  );
}
