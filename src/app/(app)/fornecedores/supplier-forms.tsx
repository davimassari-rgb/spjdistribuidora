"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { formatCents } from "@/lib/format";
import { initialFormState } from "@/lib/forms";
import { percentToBp, salePriceCents } from "@/lib/price-math";
import { createSupplier, renameSupplier, setMarkupAction } from "./actions";

export function NewSupplierForm() {
  const [state, action] = useActionState(createSupplier, initialFormState);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <div>
        <label className="label" htmlFor="name">
          Nome do fornecedor
        </label>
        <input className="input" id="name" name="name" required defaultValue={state.values?.name} />
        {state.fieldErrors?.name && (
          <p className="mt-1 text-xs text-red-600">{state.fieldErrors.name}</p>
        )}
      </div>
      <SubmitButton>Cadastrar fornecedor</SubmitButton>
    </form>
  );
}

export function RenameSupplierForm({ id, name }: { id: string; name: string }) {
  const [state, action] = useActionState(renameSupplier, initialFormState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="label" htmlFor="name">
        Nome
      </label>
      <div className="flex gap-2">
        <input className="input" id="name" name="name" required defaultValue={name} />
        <SubmitButton className="btn-secondary">Salvar</SubmitButton>
      </div>
      {state.fieldErrors?.name && <p className="text-xs text-red-600">{state.fieldErrors.name}</p>}
      {state.success && <p className="text-xs text-green-700">{state.success}</p>}
    </form>
  );
}

export function MarkupForm({ current }: { current: string }) {
  const [state, action] = useActionState(setMarkupAction, initialFormState);
  const [value, setValue] = useState(current);
  const bp = percentToBp(value);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <div className="flex items-center gap-2">
        <div className="relative w-28">
          <input
            className="input num pr-7 text-right"
            name="markup"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            aria-label="Margem em %"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-subtle">
            %
          </span>
        </div>
        <SubmitButton className="btn-secondary">Salvar</SubmitButton>
      </div>
      {state.fieldErrors?.markup && (
        <p className="text-xs text-danger">{state.fieldErrors.markup}</p>
      )}
      <p
        className="num rounded-ui bg-surface-muted px-3 py-2 text-sm text-ink-muted"
        aria-live="polite"
      >
        Exemplo:{" "}
        {bp === null ? (
          <span className="text-danger">percentual inválido</span>
        ) : (
          <>
            R$ 100,00 →{" "}
            <strong className="text-ink">{formatCents(salePriceCents(10_000, bp))}</strong>
          </>
        )}
      </p>
    </form>
  );
}
