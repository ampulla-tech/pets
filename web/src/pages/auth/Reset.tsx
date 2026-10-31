import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, useSearchParams } from "react-router";
import { identityMessage, type PendingReset } from "@pets/core/identity";
import { strings } from "@pets/core/strings";
import { Field } from "@/components/Field";
import { Notice } from "@/components/Feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCode, isCode } from "@/lib/code";
import { identity } from "@/lib/identity";
import { session } from "@/lib/session";
import { returnTo, withReturn } from "@/lib/returnTo";
import { AuthLayout } from "./AuthLayout";

// The started reset survives the tab going to the background while the person
// reads the e-mail, and dies with the tab.
const PENDING_KEY = "pets.reset";

function readPending(): PendingReset | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingReset) : null;
  } catch {
    return null;
  }
}

const requestSchema = z.object({
  email: z.string().trim().email(strings.auth.invalidEmail),
});
const resetSchema = z.object({
  code: z.string().refine(isCode, strings.auth.codeInvalid),
  password: z.string().min(8, strings.auth.shortPassword),
});

export function Reset() {
  const [params] = useSearchParams();
  const target = returnTo(params);
  const [pending, setPending] = useState<PendingReset | null>(readPending);

  function started(next: PendingReset | null) {
    if (next) sessionStorage.setItem(PENDING_KEY, JSON.stringify(next));
    else sessionStorage.removeItem(PENDING_KEY);
    setPending(next);
  }

  return (
    <AuthLayout title={strings.auth.resetTitle}>
      {pending ? (
        <CodeStep pending={pending} target={target} onRestart={() => started(null)} />
      ) : (
        <RequestStep onSent={started} />
      )}
      <p className="mt-5 border-t pt-4 text-center text-sm">
        <Link
          to={withReturn("/entrar", target)}
          className="font-medium text-primary hover:underline"
        >
          {strings.auth.signIn}
        </Link>
      </p>
    </AuthLayout>
  );
}

function RequestStep({ onSent }: { onSent: (pending: PendingReset) => void }) {
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: "" },
  });
  const onSubmit = form.handleSubmit(async ({ email }) => {
    setFailure(null);
    try {
      onSent(await identity.requestReset(email));
    } catch (error) {
      setFailure(identityMessage(error));
    }
  });
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted-foreground">{strings.auth.resetIntro}</p>
      <Field label={strings.auth.email} error={form.formState.errors.email?.message}>
        {(control) => (
          <Input
            {...control}
            type="email"
            autoComplete="email"
            inputMode="email"
            {...form.register("email")}
          />
        )}
      </Field>
      {failure ? <Notice tone="error">{failure}</Notice> : null}
      <Button type="submit" size="xl" disabled={form.formState.isSubmitting}>
        {strings.auth.sendCode}
      </Button>
    </form>
  );
}

function CodeStep({
  pending,
  target,
  onRestart,
}: {
  pending: PendingReset;
  target: string;
  onRestart: () => void;
}) {
  const navigate = useNavigate();
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { code: "", password: "" },
  });
  const onSubmit = form.handleSubmit(async ({ code, password }) => {
    setFailure(null);
    try {
      const signedIn = await identity.resetPassword(pending, code, password);
      sessionStorage.removeItem(PENDING_KEY);
      session.set(signedIn);
      navigate(target, { replace: true });
    } catch (error) {
      setFailure(identityMessage(error));
    }
  });
  const { errors, isSubmitting } = form.formState;
  const code = form.register("code");
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Notice tone="ok">{strings.auth.codeSent(pending.email)}</Notice>
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
      <Field
        label={strings.auth.newPassword}
        hint={strings.auth.passwordHint}
        error={errors.password?.message}
      >
        {(control) => (
          <Input
            {...control}
            type="password"
            autoComplete="new-password"
            {...form.register("password")}
          />
        )}
      </Field>
      {failure ? <Notice tone="error">{failure}</Notice> : null}
      <Button type="submit" size="xl" disabled={isSubmitting}>
        {strings.auth.setPassword}
      </Button>
      <Button type="button" variant="ghost" onClick={onRestart}>
        {strings.auth.otherCode}
      </Button>
    </form>
  );
}
