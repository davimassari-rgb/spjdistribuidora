"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { initialFormState } from "@/lib/forms";
import { INTERACTION_KINDS } from "@/lib/kanban/stages";
import { addInteractionAction } from "../actions";

export function InteractionForm({ clientId, today }: { clientId: string; today: string }) {
  const [state, action] = useActionState(addInteractionAction, initialFormState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      <FormMessage state={state} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data" name="occurredAt" state={state}>
          <input
            className="input"
            id="occurredAt"
            name="date"
            type="date"
            required
            defaultValue={state.values?.date ?? today}
          />
        </Field>
        <Field label="Tipo" name="kind" state={state}>
          <select
            className="input"
            id="kind"
            name="kind"
            defaultValue={state.values?.kind ?? "call"}
          >
            {Object.entries(INTERACTION_KINDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Anotação" name="note" state={state}>
        <textarea
          className="input min-h-20"
          id="note"
          name="note"
          required
          placeholder="O que foi conversado, próximos passos…"
          defaultValue={state.values?.note}
        />
      </Field>
      <SubmitButton>Registrar interação</SubmitButton>
    </form>
  );
}
