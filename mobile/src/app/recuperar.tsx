import { identityMessage, type PendingReset } from "@pets/core/identity";
import { strings } from "@pets/core/strings";
import { router } from "expo-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice, Screen } from "@/components/ui/screen";
import { Muted, Text } from "@/components/ui/text";
import { identity } from "@/lib/identity";
import { useSession } from "@/lib/session";
import { emailError, normaliseCode, passwordError } from "@/lib/validation";

/** Password reset by code (ADR-0002): the e-mail, then the code and the new password. */
export default function ResetScreen() {
  const { signIn } = useSession();
  const [pending, setPending] = useState<PendingReset | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string | null; code?: string | null; password?: string | null; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function requestCode() {
    const invalid = emailError(email);
    if (invalid) return setErrors({ email: invalid });
    setBusy(true);
    setErrors({});
    try {
      setPending(await identity.requestReset(email.trim()));
    } catch (failure) {
      setErrors({ form: identityMessage(failure) });
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!pending) return;
    const key = normaliseCode(code);
    const found = { code: key ? null : strings.auth.codeInvalid, password: passwordError(password) };
    if (found.code || found.password) return setErrors(found);
    setBusy(true);
    setErrors({});
    try {
      await signIn(await identity.resetPassword(pending, key!, password));
      router.replace("/");
    } catch (failure) {
      setErrors({ form: identityMessage(failure) });
    } finally {
      setBusy(false);
    }
  }

  const formError = errors.form ? (
    <Text role="alert" className="text-late">
      {errors.form}
    </Text>
  ) : null;

  if (!pending) {
    return (
      <Screen>
        <Muted className="text-base">{strings.auth.resetIntro}</Muted>
        <Field label={strings.auth.email} error={errors.email}>
          <Input
            testID="reset-email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </Field>
        {formError}
        <Button size="lg" label={strings.auth.sendCode} busy={busy} onPress={requestCode} testID="send-code" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Notice>{strings.auth.codeSent(pending.email)}</Notice>
      <Field label={strings.auth.code} hint={strings.auth.codeHint} error={errors.code}>
        <Input
          testID="reset-code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          placeholder="XXXX-XXXX"
          maxLength={9}
        />
      </Field>
      <Field label={strings.auth.newPassword} hint={strings.auth.passwordHint} error={errors.password}>
        <Input
          testID="reset-password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
      </Field>
      {formError}
      <Button size="lg" label={strings.auth.setPassword} busy={busy} onPress={reset} testID="set-password" />
      <Button
        variant="ghost"
        label={strings.auth.otherCode}
        onPress={() => {
          setPending(null);
          setCode("");
          setErrors({});
        }}
      />
    </Screen>
  );
}
