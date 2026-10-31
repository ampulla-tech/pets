import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, useSearchParams } from "react-router";
import { identityMessage } from "@pets/core/identity";
import { strings } from "@pets/core/strings";
import { Field } from "@/components/Field";
import { Notice } from "@/components/Feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { identity } from "@/lib/identity";
import { session } from "@/lib/session";
import { returnTo, withReturn } from "@/lib/returnTo";
import { AuthLayout } from "./AuthLayout";
import { useState } from "react";

const schema = z.object({
  email: z.string().trim().email(strings.auth.invalidEmail),
  password: z.string().min(1, strings.app.required),
});

export function SignIn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const target = returnTo(params);
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setFailure(null);
    try {
      session.set(await identity.signIn(email, password));
      navigate(target, { replace: true });
    } catch (error) {
      setFailure(identityMessage(error));
    }
  });

  const { errors, isSubmitting } = form.formState;
  return (
    <AuthLayout title={strings.auth.signInTitle}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label={strings.auth.email} error={errors.email?.message}>
          {(control) => <Input {...control} type="email" autoComplete="email" inputMode="email" {...form.register("email")} />}
        </Field>
        <Field label={strings.auth.password} error={errors.password?.message}>
          {(control) => (
            <Input {...control} type="password" autoComplete="current-password" {...form.register("password")} />
          )}
        </Field>
        {failure ? <Notice tone="error">{failure}</Notice> : null}
        <Button type="submit" size="xl" disabled={isSubmitting}>
          {strings.auth.signIn}
        </Button>
        <Link to={withReturn("/recuperar", target)} className="text-center text-sm text-primary hover:underline">
          {strings.auth.forgot}
        </Link>
      </form>
      <p className="mt-5 border-t pt-4 text-center text-sm text-muted-foreground">
        {strings.auth.noAccount}{" "}
        <Link to={withReturn("/cadastro", target)} className="font-medium text-primary hover:underline">
          {strings.auth.signUp}
        </Link>
      </p>
    </AuthLayout>
  );
}
