import { identityMessage } from "@pets/core/identity";
import { strings } from "@pets/core/strings";
import { Link, Redirect, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { Heading, Muted, Text } from "@/components/ui/text";
import { identity } from "@/lib/identity";
import { afterSignIn } from "@/lib/navigation";
import { useSession } from "@/lib/session";
import { emailError } from "@/lib/validation";

export default function SignInScreen() {
  const { convite } = useLocalSearchParams<{ convite?: string }>();
  const { state, signIn } = useSession();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === "signedIn" && !busy) return <Redirect href="/" />;

  async function submit() {
    const invalid = emailError(email) ?? (password ? null : strings.auth.shortPassword);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    try {
      await signIn(await identity.signIn(email.trim(), password));
      afterSignIn(convite);
    } catch (failure) {
      setError(identityMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top + 24 }}>
      <Screen>
        <View className="gap-1 pb-2">
          <Text className="text-3xl font-bold text-primary">{strings.app.name}</Text>
          <Muted className="text-base">{strings.app.tagline}</Muted>
        </View>
        <Heading>{strings.auth.signInTitle}</Heading>
        <Field label={strings.auth.email}>
          <Input
            testID="email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        </Field>
        <Field label={strings.auth.password}>
          <Input
            testID="password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={submit}
          />
        </Field>
        {error ? (
          <Text role="alert" className="text-late">
            {error}
          </Text>
        ) : null}
        <Button size="lg" label={strings.auth.signIn} busy={busy} onPress={submit} testID="sign-in" />
        <Link href="/recuperar" asChild>
          <Button variant="ghost" label={strings.auth.forgot} testID="to-reset" />
        </Link>
        <View className="items-center gap-1 pt-4">
          <Muted>{strings.auth.noAccount}</Muted>
          <Link href={convite ? `/cadastro?convite=${convite}` : "/cadastro"} asChild>
            <Button variant="outline" label={strings.auth.signUp} testID="to-sign-up" />
          </Link>
        </View>
      </Screen>
    </View>
  );
}
