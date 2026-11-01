import { identityMessage } from "@pets/core/identity";
import { strings } from "@pets/core/strings";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice, Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { identity } from "@/lib/identity";
import { afterSignIn } from "@/lib/navigation";
import { pendingVerification } from "@/lib/pending";
import { useSession } from "@/lib/session";
import { normaliseCode } from "@/lib/validation";

/**
 * The code e-mailed at sign-up (or at signing in to an account not yet
 * confirmed), typed here before the account is usable (ADR-0002). Then home,
 * or back to the invite that brought the person here.
 */
export default function VerifyScreen() {
  const { convite } = useLocalSearchParams<{ convite?: string }>();
  const { signIn } = useSession();
  const [pending] = useState(pendingVerification.get);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!pending) return <Redirect href={convite ? `/entrar?convite=${convite}` : "/entrar"} />;

  async function confirm() {
    const key = normaliseCode(code);
    if (!key) return setError(strings.auth.codeInvalid);
    setBusy(true);
    setError(null);
    try {
      const session = await identity.verifyEmail(pending!, key);
      pendingVerification.clear();
      await signIn(session);
      afterSignIn(convite);
    } catch (failure) {
      setError(identityMessage(failure, "verify"));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    setResent(false);
    try {
      await identity.resendVerification(pending!);
      setResent(true);
    } catch (failure) {
      setError(identityMessage(failure, "verify"));
    }
  }

  return (
    <Screen>
      <Notice>{strings.auth.verifyIntro(pending.email)}</Notice>
      <Field label={strings.auth.code} hint={strings.auth.codeHint}>
        <Input
          testID="verify-code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          placeholder="XXXX-XXXX"
          maxLength={9}
          onSubmitEditing={confirm}
        />
      </Field>
      {resent ? <Notice>{strings.auth.codeResent}</Notice> : null}
      {error ? (
        <Text role="alert" className="text-late">
          {error}
        </Text>
      ) : null}
      <Button size="lg" label={strings.auth.verify} busy={busy} onPress={confirm} testID="verify" />
      <Button variant="ghost" label={strings.auth.resendCode} onPress={resend} testID="resend-code" />
    </Screen>
  );
}
