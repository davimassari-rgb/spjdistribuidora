"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { initialFormState } from "@/lib/forms";
import { createOpportunityAction } from "./actions";

export function OpportunityForm({
  clients,
  users,
  defaultClientId,
  defaultOwnerId,
}: {
  clients: { id: string; tradeName: string; status: string }[];
  users: { id: string; name: string }[];
  defaultClientId?: string;
  defaultOwnerId: string;
}) {
  const [state, action] = useActionState(createOpportunityAction, initialFormState);
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-3" key={JSON.stringify(v)}>
      <FormMessage state={state} />
      <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_10rem_12rem]">
        <Field label="Cliente *" name="clientId" state={state}>
          <select
            className="input"
            id="clientId"
            name="clientId"
            required
            defaultValue={v.clientId ?? defaultClientId ?? ""}
          >
            <option value="">Escolha…</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.tradeName}
                {client.status === "prospect" ? " (prospect)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Demanda *" name="title" state={state}>
          <input
            className="input"
            id="title"
            name="title"
            required
            placeholder="Ex.: 4 pastilhas de freio Onix 2020"
            defaultValue={v.title}
          />
        </Field>
        <Field label="Valor estimado (R$)" name="value" state={state}>
          <input
            className="input"
            id="value"
            name="value"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={v.value}
          />
        </Field>
        <Field label="Responsável" name="ownerId" state={state}>
          <select
            className="input"
            id="ownerId"
            name="ownerId"
            defaultValue={v.ownerId ?? defaultOwnerId}
          >
            <option value="">Sem responsável</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Observações" name="notes" state={state}>
        <input className="input" id="notes" name="notes" defaultValue={v.notes} />
      </Field>
      <SubmitButton>Criar demanda</SubmitButton>
    </form>
  );
}
