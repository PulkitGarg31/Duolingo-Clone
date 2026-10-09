import type { ApiError } from "@/lib/api/errors";
import type { LoginIn, SignupIn } from "@/lib/api/types";
import { actionErrorMessage } from "@/lib/queries/queryClient";

/*
 * The log-in and sign-up forms' rules: the same limits the server checks, so most mistakes are caught before a
 * request, and the mapping from the server's answers (field errors, EMAIL_TAKEN, INVALID_CREDENTIALS) back to
 * the inputs. Everything here is pure.
 */

export const DISPLAY_NAME_MAX = 40;
export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export type SignupField = "displayName" | "email" | "password";
export type LoginField = "email" | "password";

export type SignupValues = Record<SignupField, string>;
export type LoginValues = Record<LoginField, string>;

/** One message per field at most, keyed by the field's name in the request body. */
export type FieldErrors<F extends string> = Partial<Record<F, string>>;

export interface FormErrors<F extends string> {
  fields: FieldErrors<F>;
  /** A message about the whole form, shown above the submit button. */
  form: string | null;
}

export const MESSAGES = {
  nameMissing: "Enter your name.",
  nameTooLong: `Names can be at most ${DISPLAY_NAME_MAX} characters.`,
  emailMissing: "Enter your email.",
  emailInvalid: "Enter a valid email address.",
  emailTaken: "An account with this email already exists.",
  passwordMissing: "Enter a password.",
  passwordTooShort: `Use at least ${PASSWORD_MIN} characters.`,
  passwordTooLong: `Use at most ${PASSWORD_MAX} characters.`,
  invalidCredentials: "Wrong email or password.",
  generic: "Check the form and try again.",
} as const;

/** The server's own check: one "@" with something before it, a dot inside the domain, no spaces, 254 at most. */
export function isPlausibleEmail(value: string): boolean {
  const email = value.trim();
  if (email.length > EMAIL_MAX || /\s/.test(email)) return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return local.length > 0 && /^[^.]+(\.[^.]+)+$/.test(domain);
}

function emailError(value: string): string | undefined {
  if (value.trim() === "") return MESSAGES.emailMissing;
  if (!isPlausibleEmail(value)) return MESSAGES.emailInvalid;
  return undefined;
}

/** Drops the fields without a message, so an empty object means a valid form. */
function compact<F extends string>(errors: Record<F, string | undefined>): FieldErrors<F> {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message !== undefined)) as FieldErrors<F>;
}

export function hasErrors(errors: FieldErrors<string>): boolean {
  return Object.keys(errors).length > 0;
}

function newPasswordError(password: string): string | undefined {
  if (password === "") return MESSAGES.passwordMissing;
  if (password.length < PASSWORD_MIN) return MESSAGES.passwordTooShort;
  if (password.length > PASSWORD_MAX) return MESSAGES.passwordTooLong;
  return undefined;
}

export function validateSignup(values: SignupValues): FieldErrors<SignupField> {
  const name = values.displayName.trim();
  return compact<SignupField>({
    displayName: name === "" ? MESSAGES.nameMissing : name.length > DISPLAY_NAME_MAX ? MESSAGES.nameTooLong : undefined,
    email: emailError(values.email),
    password: newPasswordError(values.password),
  });
}

/** Log in only checks that both fields are filled in: any password may be the right one. */
export function validateLogin(values: LoginValues): FieldErrors<LoginField> {
  return compact<LoginField>({
    email: emailError(values.email),
    password: values.password === "" ? MESSAGES.passwordMissing : undefined,
  });
}

/** The signup body: the name and email trimmed, the password as typed, the device zone when there is one. */
export function signupBody(values: SignupValues, timezone: string | null): SignupIn {
  return {
    displayName: values.displayName.trim(),
    email: values.email.trim(),
    password: values.password,
    ...(timezone && { timezone }),
  };
}

export function loginBody(values: LoginValues): LoginIn {
  return { email: values.email.trim(), password: values.password };
}

/** Friendly copy for the server's validation kinds, per field; anything else keeps the server's message. */
function fieldMessage(field: string, kind: string): string | null {
  switch (field) {
    case "displayName":
      if (kind === "string_too_short" || kind === "missing") return MESSAGES.nameMissing;
      if (kind === "string_too_long") return MESSAGES.nameTooLong;
      return null;
    case "email":
      return kind === "missing" ? MESSAGES.emailMissing : MESSAGES.emailInvalid;
    case "password":
      if (kind === "missing") return MESSAGES.passwordMissing;
      if (kind === "string_too_short") return MESSAGES.passwordTooShort;
      if (kind === "string_too_long") return MESSAGES.passwordTooLong;
      return null;
    default:
      return null;
  }
}

/** "body.email" → "email": the server names fields by their location in the request. */
function bodyField(location: string): string | null {
  const [source, field] = location.split(".");
  return source === "body" && field ? field : null;
}

/** Pydantic prefixes custom checks with "Value error, ". */
function cleanServerMessage(message: string): string {
  return message.replace(/^Value error,\s*/i, "");
}

/**
 * Turns a failed log-in or sign-up into messages next to the inputs (`fields` lists the form's inputs).
 * Returns null for the failures the app reports itself: an unreachable server or a server bug get a toast.
 */
export function formErrorsFromProblem<F extends string>(error: ApiError, fields: readonly F[]): FormErrors<F> | null {
  if (actionErrorMessage(error) !== null) return null;
  const known = new Set<string>(fields);
  if (error.code === "EMAIL_TAKEN" && known.has("email")) {
    return { fields: { email: MESSAGES.emailTaken } as FieldErrors<F>, form: null };
  }
  if (error.code === "INVALID_CREDENTIALS") return { fields: {}, form: MESSAGES.invalidCredentials };
  if (error.code !== "VALIDATION_ERROR") return { fields: {}, form: error.detail || MESSAGES.generic };

  const mapped: FieldErrors<string> = {};
  let unplaced = false;
  for (const { field: location, kind, message } of error.errors) {
    const field = bodyField(location);
    if (field === null || !known.has(field)) {
      unplaced = true;
      continue;
    }
    mapped[field] ??= fieldMessage(field, kind) ?? cleanServerMessage(message);
  }
  const placedAny = hasErrors(mapped);
  return {
    fields: mapped as FieldErrors<F>,
    form: unplaced || !placedAny ? MESSAGES.generic : null,
  };
}

/**
 * True when the server turned down nothing but the time zone the browser reported (some privacy-hardened
 * browsers report a zone the server does not know). The signup is then sent again without one.
 */
export function onlyTimezoneRejected(error: ApiError): boolean {
  if (error.code !== "VALIDATION_ERROR" || error.errors.length === 0) return false;
  return error.errors.every(({ field }) => bodyField(field) === "timezone");
}

/** The browser's IANA zone, or null when it cannot tell. */
export function deviceTimeZoneOrNull(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
