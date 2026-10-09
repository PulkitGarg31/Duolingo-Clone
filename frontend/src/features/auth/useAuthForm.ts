import { useState, type FormEvent } from "react";
import { hasErrors, type FieldErrors, type FormErrors } from "./authForm";

const NO_ERRORS = { fields: {}, form: null };

interface AuthFormOptions<F extends string> {
  initial: Record<F, string>;
  /** Each input's element id, so a rejected submit can move focus to the first field in error. */
  ids: Record<F, string>;
  validate: (values: Record<F, string>) => FieldErrors<F>;
  /** Runs with valid values; report the server's answer with `showErrors`. */
  onValid: (values: Record<F, string>) => void;
}

/**
 * The values and messages of a log-in or sign-up form. Checking happens on submit, never while typing; editing
 * a field clears its message and the form-level one.
 */
export function useAuthForm<F extends string>({ initial, ids, validate, onValid }: AuthFormOptions<F>) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FormErrors<F>>(NO_ERRORS);

  function focusFirstError(fields: FieldErrors<F>) {
    const first = (Object.keys(ids) as F[]).find((field) => fields[field] !== undefined);
    if (first) document.getElementById(ids[first])?.focus();
  }

  return {
    values,
    errors,

    set(field: F, value: string) {
      setValues((current) => ({ ...current, [field]: value }));
      setErrors((current) => {
        if (current.fields[field] === undefined && current.form === null) return current;
        const fields = { ...current.fields };
        delete fields[field];
        return { fields, form: null };
      });
    },

    /** Shows the server's verdict next to the inputs. */
    showErrors(next: FormErrors<F>) {
      setErrors(next);
      focusFirstError(next.fields);
    },

    onSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      const fields = validate(values);
      if (hasErrors(fields)) {
        setErrors({ fields, form: null });
        focusFirstError(fields);
        return;
      }
      setErrors(NO_ERRORS);
      onValid(values);
    },
  };
}
