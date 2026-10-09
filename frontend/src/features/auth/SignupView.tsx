"use client";

import { Button, ButtonLink, Input } from "@/components/ui";
import type { ApiError } from "@/lib/api/errors";
import type { SignupIn } from "@/lib/api/types";
import { useEnterDemo, useSignup } from "@/lib/queries/mutations";
import { AuthFrame, DemoServerNote, OrDivider } from "./AuthFrame";
import {
  DISPLAY_NAME_MAX,
  PASSWORD_MAX,
  deviceTimeZoneOrNull,
  formErrorsFromProblem,
  onlyTimezoneRejected,
  signupBody,
  validateSignup,
  type SignupField,
  type SignupValues,
} from "./authForm";
import { FormMessage } from "./FormMessage";
import { PasswordInput } from "./PasswordInput";
import { ServerWaitNotice } from "./ServerWaitNotice";
import { useAuthForm } from "./useAuthForm";
import { useServerWarmup } from "./useServerWarmup";

const FIELDS: readonly SignupField[] = ["displayName", "email", "password"];
const IDS: Record<SignupField, string> = {
  displayName: "signup-name",
  email: "signup-email",
  password: "signup-password",
};

/**
 * `/signup`: name, email and password. The account starts in the device's time zone, at Unit 1, and opens on
 * the path straight away.
 */
export function SignupView() {
  const gate = useServerWarmup();
  const signup = useSignup();
  const enterDemo = useEnterDemo();
  const form = useAuthForm<SignupField>({
    initial: { displayName: "", email: "", password: "" },
    ids: IDS,
    validate: validateSignup,
    onValid: (values) => {
      if (!signup.isPending) send(values, signupBody(values, deviceTimeZoneOrNull()));
    },
  });

  function send(values: SignupValues, body: SignupIn) {
    signup.mutate(body, {
      onError: (error: ApiError) => {
        // A zone the server does not know: start in its default zone rather than block the signup.
        if (body.timezone && onlyTimezoneRejected(error)) {
          send(values, signupBody(values, null));
          return;
        }
        const errors = formErrorsFromProblem(error, FIELDS);
        if (errors) form.showErrors(errors);
      },
    });
  }

  return (
    <AuthFrame title="Create your profile" switchTo={{ label: "Log in", href: "/login" }}>
      <form noValidate onSubmit={form.onSubmit} aria-label="Create your profile">
        <div className="flex flex-col gap-3">
          <label htmlFor={IDS.displayName} className="sr-only">
            Name
          </label>
          <Input
            id={IDS.displayName}
            autoComplete="name"
            placeholder="Name"
            maxLength={DISPLAY_NAME_MAX}
            value={form.values.displayName}
            onChange={(event) => form.set("displayName", event.target.value)}
            error={form.errors.fields.displayName}
          />
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
            autoComplete="new-password"
            placeholder="Password (8+ characters)"
            maxLength={PASSWORD_MAX}
            value={form.values.password}
            onChange={(event) => form.set("password", event.target.value)}
            error={form.errors.fields.password}
          />
        </div>
        <FormMessage message={form.errors.form} />
        <Button type="submit" variant="secondary" fullWidth loading={signup.isPending} className="mt-6">
          Create account
        </Button>
        <ServerWaitNotice waiting={signup.isPaused} gate={gate} />
      </form>
      <OrDivider />
      <ButtonLink href="/learn" variant="outline" fullWidth onClick={enterDemo}>
        Explore the demo instead
      </ButtonLink>
      <DemoServerNote />
    </AuthFrame>
  );
}
