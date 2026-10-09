"use client";

import { Button, ButtonLink, Input } from "@/components/ui";
import { useEnterDemo, useLogin } from "@/lib/queries/mutations";
import { AuthFrame, DemoServerNote, OrDivider } from "./AuthFrame";
import { formErrorsFromProblem, loginBody, validateLogin, type LoginField } from "./authForm";
import { FormMessage } from "./FormMessage";
import { PasswordInput } from "./PasswordInput";
import { ServerWaitNotice } from "./ServerWaitNotice";
import { useAuthForm } from "./useAuthForm";
import { useServerWarmup } from "./useServerWarmup";

const FIELDS: readonly LoginField[] = ["email", "password"];
const IDS: Record<LoginField, string> = { email: "login-email", password: "login-password" };

/** `/login`: email and password, then the path. Wrong details of either kind get the same message. */
export function LoginView() {
  const gate = useServerWarmup();
  const login = useLogin();
  const enterDemo = useEnterDemo();
  const form = useAuthForm<LoginField>({
    initial: { email: "", password: "" },
    ids: IDS,
    validate: validateLogin,
    onValid: (values) => {
      if (login.isPending) return;
      login.mutate(loginBody(values), {
        onError: (error) => {
          const errors = formErrorsFromProblem(error, FIELDS);
          if (errors) form.showErrors(errors);
        },
      });
    },
  });

  return (
    <AuthFrame title="Log in" switchTo={{ label: "Sign up", href: "/signup" }}>
      <form noValidate onSubmit={form.onSubmit} aria-label="Log in">
        <div className="flex flex-col gap-3">
          <label htmlFor={IDS.email} className="sr-only">
            Email
          </label>
          <Input
            id={IDS.email}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Email"
            value={form.values.email}
            onChange={(event) => form.set("email", event.target.value)}
            error={form.errors.fields.email}
          />
          <label htmlFor={IDS.password} className="sr-only">
            Password
          </label>
          <PasswordInput
            id={IDS.password}
            autoComplete="current-password"
            placeholder="Password"
            value={form.values.password}
            onChange={(event) => form.set("password", event.target.value)}
            error={form.errors.fields.password}
          />
        </div>
        <FormMessage message={form.errors.form} />
        <Button type="submit" variant="secondary" fullWidth loading={login.isPending} className="mt-6">
          Log in
        </Button>
        <ServerWaitNotice waiting={login.isPaused} gate={gate} />
      </form>
      <OrDivider />
      <ButtonLink href="/learn" variant="outline" fullWidth onClick={enterDemo}>
        Explore the demo instead
      </ButtonLink>
      <DemoServerNote />
    </AuthFrame>
  );
}
