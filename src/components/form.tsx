"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useToast } from "@/components/ui/toast";
import type { FormState } from "@/lib/forms";

export function SubmitButton({
  children,
  pendingText = "Salvando…",
  className = "btn-primary",
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

/** Mensagem do resultado de um formulário: aparece no formulário e também como toast. */
export function FormMessage({ state }: { state: FormState }) {
  const toast = useToast();
  useEffect(() => {
    if (state.success) toast("success", state.success);
    else if (state.error) toast("error", state.error);
  }, [state, toast]);

  if (state.error) {
    return (
      <p
        role="alert"
        className="flex items-start gap-2 rounded-ui border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger"
      >
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-ui border border-success-border bg-success-bg px-3 py-2 text-sm text-success"
      >
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        {state.success}
      </p>
    );
  }
  return null;
}

export function Field({
  label,
  name,
  state,
  children,
  hint,
}: {
  label: string;
  name: string;
  state?: FormState;
  children: ReactNode;
  hint?: string;
}) {
  const error = state?.fieldErrors?.[name];
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="caption mt-1">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
