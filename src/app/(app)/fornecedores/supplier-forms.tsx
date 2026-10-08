"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { initialFormState } from "@/lib/forms";
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
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input
        className="input w-24"
        name="markup"
        inputMode="decimal"
        defaultValue={current}
        aria-label="Margem em %"
      />
      <span className="text-sm">%</span>
      <SubmitButton className="btn-secondary">Salvar</SubmitButton>
      {state.fieldErrors?.markup && (
        <p className="w-full text-xs text-red-600">{state.fieldErrors.markup}</p>
      )}
      {state.success && <p className="w-full text-xs text-green-700">{state.success}</p>}
    </form>
  );
}
