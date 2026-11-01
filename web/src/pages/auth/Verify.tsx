import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { identityMessage } from "@pets/core/identity";
import { strings } from "@pets/core/strings";
import { Field } from "@/components/Field";
import { Notice } from "@/components/Feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCode, isCode } from "@/lib/code";
import { identity } from "@/lib/identity";
import { pendingVerification } from "@/lib/pending";
import { session } from "@/lib/session";
import { returnTo, withReturn } from "@/lib/returnTo";
import { AuthLayout } from "./AuthLayout";

const schema = z.object({
  code: z.string().refine(isCode, strings.auth.codeInvalid),
});

/**
 * `/confirmar`: the code e-mailed at sign-up (or at signing in to an account
 * not yet confirmed), typed here before the account is usable (ADR-0002).
 * Then on to `volta`: an invite comes back to its screen.
 */
export function Verify() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const target = returnTo(params);
  const [pending] = useState(pendingVerification.get);
  const [failure, setFailure] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { code: "" } });

  if (!pending) return <Navigate to={withReturn("/entrar", target)} replace />;

  const onSubmit = form.handleSubmit(async ({ code }) => {
    setFailure(null);
    try {
      const signedIn = await identity.verifyEmail(pending, code);
      pendingVerification.clear();
      session.set(signedIn);
      navigate(target, { replace: true });
    } catch (error) {
      setFailure(identityMessage(error, "verify"));
    }
  });

  async function resend() {
    setFailure(null);
    setResent(false);
    try {
      await identity.resendVerification(pending!);
      setResent(true);
    } catch (error) {
      setFailure(identityMessage(error, "verify"));
    }
  }

  const { errors, isSubmitting } = form.formState;
  const code = form.register("code");
  return (
    <AuthLayout title={strings.auth.verifyTitle}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Notice tone="ok">{strings.auth.verifyIntro(pending.email)}</Notice>
        <Field
          label={strings.auth.code}
          hint={strings.auth.codeHint}
          error={errors.code?.message}
        >
          {(control) => (
            <Input
              {...control}
              {...code}
              onChange={(event) => {
                event.target.value = formatCode(event.target.value);
                return code.onChange(event);
              }}
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="XXXX-XXXX"
              className="font-mono tracking-widest uppercase"
            />
          )}
        </Field>
        {resent ? <Notice>{strings.auth.codeResent}</Notice> : null}
        {failure ? <Notice tone="error">{failure}</Notice> : null}
        <Button type="submit" size="xl" disabled={isSubmitting}>
          {strings.auth.verify}
        </Button>
        <Button type="button" variant="ghost" onClick={() => void resend()}>
          {strings.auth.resendCode}
        </Button>
      </form>
      <p className="mt-5 border-t pt-4 text-center text-sm">
        <Link
          to={withReturn("/cadastro", target)}
          onClick={() => pendingVerification.clear()}
          className="font-medium text-primary hover:underline"
        >
          {strings.auth.otherEmail}
        </Link>
      </p>
    </AuthLayout>
  );
}
