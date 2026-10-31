import { identityMessage } from "@pets/core/identity";
import { strings } from "@pets/core/strings";
import { Link, Redirect, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { Muted, Text } from "@/components/ui/text";
import { identity } from "@/lib/identity";
import { afterSignIn } from "@/lib/navigation";
import { useSession } from "@/lib/session";
import { emailError, passwordError } from "@/lib/validation";

export default function SignUpScreen() {
  const { convite } = useLocalSearchParams<{ convite?: string }>();
  const { state, signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null; form?: string }>({});
  const [busy, setBusy] = useState(false);

  if (state.status === "signedIn" && !busy) return <Redirect href="/" />;

  async function submit() {
    const found = { email: emailError(email), password: passwordError(password) };
    if (found.email || found.password) return setErrors(found);
    setBusy(true);
    setErrors({});
    try {
      await signIn(await identity.signUp(email.trim(), password));
      afterSignIn(convite);
    } catch (failure) {
      setErrors({ form: identityMessage(failure) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Muted className="text-base">{strings.app.tagline}</Muted>
      <Field label={strings.auth.email} error={errors.email}>
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
      <Field label={strings.auth.password} hint={strings.auth.passwordHint} error={errors.password}>
        <Input
          testID="password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
      </Field>
      {errors.form ? (
        <Text role="alert" className="text-late">
          {errors.form}
        </Text>
      ) : null}
      <Button size="lg" label={strings.auth.signUp} busy={busy} onPress={submit} testID="sign-up" />
      <View className="items-center gap-1 pt-4">
        <Muted>{strings.auth.haveAccount}</Muted>
        <Link href={convite ? `/entrar?convite=${convite}` : "/entrar"} asChild replace>
          <Button variant="outline" label={strings.auth.signIn} />
        </Link>
      </View>
    </Screen>
  );
}
