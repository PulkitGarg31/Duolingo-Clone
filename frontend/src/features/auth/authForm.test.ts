import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { ErrorCode, FieldError } from "@/lib/api/types";
import {
  MESSAGES,
  formErrorsFromProblem,
  hasErrors,
  isPlausibleEmail,
  loginBody,
  onlyTimezoneRejected,
  signupBody,
  validateLogin,
  validateSignup,
} from "./authForm";

const SIGNUP_FIELDS = ["displayName", "email", "password"] as const;
const LOGIN_FIELDS = ["email", "password"] as const;

function refusal(status: number, code: ErrorCode, errors: FieldError[] = [], detail = ""): ApiError {
  return new ApiError({ status, code, title: code, detail, errors });
}

function fieldError(field: string, kind: string, message = "Invalid"): FieldError {
  return { field, kind, message };
}

describe("isPlausibleEmail", () => {
  it.each([
    ["ana@example.com", true],
    ["  ana@example.com  ", true],
    ["ana.maria+es@mail.example.org", true],
    ["ana@example", false],
    ["ana@@example.com", false],
    ["@example.com", false],
    ["ana@.com", false],
    ["ana@example.", false],
    ["ana maria@example.com", false],
    ["", false],
  ])("%s → %s", (email, expected) => {
    expect(isPlausibleEmail(email)).toBe(expected);
  });

  it("rejects an address longer than 254 characters", () => {
    expect(isPlausibleEmail(`${"a".repeat(242)}@example.com`)).toBe(true);
    expect(isPlausibleEmail(`${"a".repeat(243)}@example.com`)).toBe(false);
  });
});

describe("validateSignup", () => {
  const valid = { displayName: "Ana", email: "ana@example.com", password: "s3cret-pass" };

  it("accepts a complete form", () => {
    expect(validateSignup(valid)).toEqual({});
    expect(hasErrors(validateSignup(valid))).toBe(false);
  });

  it("flags every empty field at once", () => {
    expect(validateSignup({ displayName: "   ", email: "", password: "" })).toEqual({
      displayName: MESSAGES.nameMissing,
      email: MESSAGES.emailMissing,
      password: MESSAGES.passwordMissing,
    });
  });

  it("checks the server's limits: 40-character names, 8 to 128-character passwords, a real-looking email", () => {
    expect(validateSignup({ ...valid, displayName: "A".repeat(41) }).displayName).toBe(MESSAGES.nameTooLong);
    expect(validateSignup({ ...valid, displayName: ` ${"A".repeat(40)} ` }).displayName).toBeUndefined();
    expect(validateSignup({ ...valid, password: "1234567" }).password).toBe(MESSAGES.passwordTooShort);
    expect(validateSignup({ ...valid, password: "12345678" }).password).toBeUndefined();
    expect(validateSignup({ ...valid, password: "x".repeat(129) }).password).toBe(MESSAGES.passwordTooLong);
    expect(validateSignup({ ...valid, email: "ana@example" }).email).toBe(MESSAGES.emailInvalid);
  });
});

describe("validateLogin", () => {
  it("only asks for both fields, since any password may be the right one", () => {
    expect(validateLogin({ email: "ana@example.com", password: "short" })).toEqual({});
    expect(validateLogin({ email: "", password: "" })).toEqual({
      email: MESSAGES.emailMissing,
      password: MESSAGES.passwordMissing,
    });
    expect(validateLogin({ email: "ana", password: "x" })).toEqual({ email: MESSAGES.emailInvalid });
  });
});

describe("request bodies", () => {
  it("trims the name and email, keeps the password as typed and adds the device zone", () => {
    const values = { displayName: "  Ana  ", email: " Ana@Example.com ", password: " pass word " };

    expect(signupBody(values, "Europe/Madrid")).toEqual({
      displayName: "Ana",
      email: "Ana@Example.com",
      password: " pass word ",
      timezone: "Europe/Madrid",
    });
    expect(signupBody(values, null)).not.toHaveProperty("timezone");
    expect(loginBody({ email: " ana@example.com ", password: " x " })).toEqual({ email: "ana@example.com", password: " x " });
  });
});

describe("formErrorsFromProblem", () => {
  it("puts EMAIL_TAKEN under the email field", () => {
    expect(formErrorsFromProblem(refusal(409, "EMAIL_TAKEN"), SIGNUP_FIELDS)).toEqual({
      fields: { email: MESSAGES.emailTaken },
      form: null,
    });
  });

  it("reports INVALID_CREDENTIALS for the whole form, naming neither field", () => {
    expect(formErrorsFromProblem(refusal(401, "INVALID_CREDENTIALS"), LOGIN_FIELDS)).toEqual({
      fields: {},
      form: MESSAGES.invalidCredentials,
    });
  });

  it("maps the server's field errors to the inputs, with friendly copy for the known kinds", () => {
    const error = refusal(422, "VALIDATION_ERROR", [
      fieldError("body.displayName", "string_too_long", "String should have at most 40 characters"),
      fieldError("body.password", "string_too_short", "String should have at least 8 characters"),
      fieldError("body.email", "value_error", "Value error, Enter a valid email address"),
    ]);

    expect(formErrorsFromProblem(error, SIGNUP_FIELDS)).toEqual({
      fields: {
        displayName: MESSAGES.nameTooLong,
        password: MESSAGES.passwordTooShort,
        email: MESSAGES.emailInvalid,
      },
      form: null,
    });
  });

  it("keeps the server's message for an unknown kind, without pydantic's prefix, and the first message per field", () => {
    const error = refusal(422, "VALIDATION_ERROR", [
      fieldError("body.displayName", "value_error", "Value error, Names cannot be only spaces"),
      fieldError("body.displayName", "string_too_long"),
    ]);

    expect(formErrorsFromProblem(error, SIGNUP_FIELDS)?.fields).toEqual({ displayName: "Names cannot be only spaces" });
  });

  it("falls back to a form message for errors no input can show", () => {
    const error = refusal(422, "VALIDATION_ERROR", [fieldError("body", "json_invalid"), fieldError("body.email", "missing")]);

    expect(formErrorsFromProblem(error, LOGIN_FIELDS)).toEqual({
      fields: { email: MESSAGES.emailMissing },
      form: MESSAGES.generic,
    });
    expect(formErrorsFromProblem(refusal(422, "VALIDATION_ERROR"), LOGIN_FIELDS)).toEqual({
      fields: {},
      form: MESSAGES.generic,
    });
  });

  it("shows any other refusal's own explanation", () => {
    expect(formErrorsFromProblem(refusal(404, "NOT_FOUND", [], "Nothing here."), LOGIN_FIELDS)).toEqual({
      fields: {},
      form: "Nothing here.",
    });
  });

  it("leaves an unreachable server and server bugs to the app-wide toast", () => {
    expect(formErrorsFromProblem(ApiError.network(new TypeError("Failed to fetch")), LOGIN_FIELDS)).toBeNull();
    expect(formErrorsFromProblem(refusal(500, "INTERNAL_ERROR"), LOGIN_FIELDS)).toBeNull();
  });
});

describe("onlyTimezoneRejected", () => {
  it("is true only when the time zone is the sole complaint", () => {
    expect(onlyTimezoneRejected(refusal(422, "VALIDATION_ERROR", [fieldError("body.timezone", "value_error")]))).toBe(true);
    expect(
      onlyTimezoneRejected(
        refusal(422, "VALIDATION_ERROR", [fieldError("body.timezone", "value_error"), fieldError("body.email", "value_error")]),
      ),
    ).toBe(false);
    expect(onlyTimezoneRejected(refusal(422, "VALIDATION_ERROR"))).toBe(false);
    expect(onlyTimezoneRejected(refusal(409, "EMAIL_TAKEN"))).toBe(false);
  });
});
