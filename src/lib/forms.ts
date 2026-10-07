import type { z } from "zod";

/** Estado devolvido pelas Server Actions de formulário (usado com useActionState). */
export type FormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string | undefined>;
  /** Valores enviados, para repopular o formulário quando há erro (o React limpa o form). */
  values?: Record<string, string>;
};

export const initialFormState: FormState = {};

export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) values[key] = value;
  }
  return values;
}

/** Primeira mensagem de erro de cada campo. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    result[key] ??= issue.message;
  }
  return result;
}

export function invalidForm(error: z.ZodError, formData: FormData): FormState {
  return {
    error: "Corrija os campos destacados.",
    fieldErrors: fieldErrorsFrom(error),
    values: formValues(formData),
  };
}
