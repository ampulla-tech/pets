import { readFailure } from "@pets/core/api";
import { acceptInvite } from "@pets/core/api/generated";
import { previewInviteOptions } from "@pets/core/api/query";
import { formatDate, ROLE_LABEL } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { AnimalAvatar } from "@/components/AnimalAvatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, Loading, Notice, Screen } from "@/components/ui/screen";
import { Muted, Text } from "@/components/ui/text";
import { refreshAnimal } from "@/lib/invalidate";
import { animalHref } from "@/lib/navigation";
import { useSession } from "@/lib/session";

/**
 * An invite link opened in the app (pets://convite/<token>, or the web link's
 * path). Open to someone signed out: they sign in or up and come back here.
 */
export default function InviteAcceptScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { state } = useSession();
  const queryClient = useQueryClient();
  const signedIn = state.status === "signedIn";
  const preview = useQuery({
    ...previewInviteOptions({ path: { token } }),
    queryKey: [...previewInviteOptions({ path: { token } }).queryKey, signedIn] as never,
    retry: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (preview.isPending) return <Loading />;
  if (preview.isError) {
    return readFailure(preview.error).status === 404 ? (
      <ErrorState message={strings.invite.notFound} />
    ) : (
      <ErrorState onRetry={() => void preview.refetch()} />
    );
  }

  const invite = preview.data;
  const role = ROLE_LABEL[invite.role];

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await acceptInvite({ path: { token }, throwOnError: true });
      await refreshAnimal(queryClient);
      router.replace(animalHref(data.animal_id) as never);
    } catch (failure) {
      const code = readFailure(failure).code;
      setError(
        code === "invite_expired"
          ? strings.invite.expired
          : code === "invite_used"
            ? strings.invite.used
            : code === "already_member"
              ? strings.invite.alreadyMember
              : strings.app.genericError,
      );
    } finally {
      setBusy(false);
    }
  }

  const blocked =
    invite.state === "expired" ? strings.invite.expired : invite.state === "used" ? strings.invite.used : null;

  return (
    <Screen>
      <Card className="items-center gap-3 py-6">
        <AnimalAvatar animal={{ ...invite.animal, photo_url: invite.animal.photo_url ?? null }} size={96} />
        <Text className="text-xl font-bold">{invite.animal.name}</Text>
        <Text className="text-center" testID="invite-body">
          {strings.invite.body(invite.invited_by, invite.animal.name, role)}
        </Text>
        {invite.access_ends_on ? <Muted>{strings.invite.endsOn(formatDate(invite.access_ends_on))}</Muted> : null}
      </Card>
      {blocked ? (
        <Notice tone="late">{blocked}</Notice>
      ) : invite.already_member ? (
        <>
          <Notice>{strings.invite.alreadyMember}</Notice>
          {invite.animal_id ? (
            <Button label={strings.invite.openAnimal} onPress={() => router.replace(animalHref(invite.animal_id!) as never)} />
          ) : null}
        </>
      ) : signedIn ? (
        <Button size="lg" label={strings.invite.accept} busy={busy} onPress={accept} testID="accept" />
      ) : (
        <View className="gap-2">
          <Muted className="text-center">{strings.invite.signInToAccept}</Muted>
          <Button size="lg" label={strings.auth.signUp} testID="invite-sign-up" onPress={() => router.push(`/cadastro?convite=${token}` as never)} />
          <Button variant="outline" label={strings.auth.signIn} testID="invite-sign-in" onPress={() => router.push(`/entrar?convite=${token}` as never)} />
        </View>
      )}
      {error ? <Notice tone="late">{error}</Notice> : null}
      {signedIn && (blocked || error) ? (
        <Button variant="ghost" label={strings.app.goHome} onPress={() => router.replace("/")} />
      ) : null}
    </Screen>
  );
}
