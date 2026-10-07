"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { type FormState, initialFormState } from "@/lib/forms";
import { CLIENT_KINDS } from "@/lib/kanban/stages";

export type ClientFormValues = {
  id?: string;
  tradeName?: string;
  legalName?: string;
  cnpj?: string;
  kind?: string;
  contactName?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  region?: string;
  ownerId?: string;
  notes?: string;
};

export function ClientForm({
  action,
  initial = {},
  users,
  regions,
  isNew,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: ClientFormValues;
  users: { id: string; name: string }[];
  regions: string[];
  isNew: boolean;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  // Depois de um erro, o React limpa o formulário: repopula com o que foi enviado.
  const v = (name: keyof ClientFormValues) => state.values?.[name] ?? initial[name] ?? "";

  return (
    <form action={formAction} className="space-y-4" key={JSON.stringify(state.values ?? initial)}>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <FormMessage state={state} />

      {isNew && (
        <fieldset>
          <legend className="label">Situação</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="status"
                value="prospect"
                defaultChecked={(state.values?.status ?? "prospect") === "prospect"}
              />
              Potencial cliente (entra na prospecção como Lead)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="status"
                value="active"
                defaultChecked={state.values?.status === "active"}
              />
              Cliente ativo (entra na carteira farmer)
            </label>
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome fantasia *" name="tradeName" state={state}>
          <input
            className="input"
            id="tradeName"
            name="tradeName"
            required
            defaultValue={v("tradeName")}
          />
        </Field>
        <Field label="Razão social" name="legalName" state={state}>
          <input className="input" id="legalName" name="legalName" defaultValue={v("legalName")} />
        </Field>
        <Field
          label="CNPJ"
          name="cnpj"
          state={state}
          hint="Numérico ou alfanumérico (novo padrão)."
        >
          <input
            className="input"
            id="cnpj"
            name="cnpj"
            inputMode="text"
            placeholder="00.000.000/0000-00"
            defaultValue={v("cnpj")}
          />
        </Field>
        <Field label="Tipo *" name="kind" state={state}>
          <select className="input" id="kind" name="kind" required defaultValue={v("kind")}>
            <option value="">Escolha…</option>
            {Object.entries(CLIENT_KINDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Contato" name="contactName" state={state}>
          <input
            className="input"
            id="contactName"
            name="contactName"
            defaultValue={v("contactName")}
          />
        </Field>
        <Field label="Responsável (SPJ)" name="ownerId" state={state}>
          <select className="input" id="ownerId" name="ownerId" defaultValue={v("ownerId")}>
            <option value="">Sem responsável</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Telefone" name="phone" state={state}>
          <input
            className="input"
            id="phone"
            name="phone"
            type="tel"
            placeholder="(11) 3456-7890"
            defaultValue={v("phone")}
          />
        </Field>
        <Field label="WhatsApp" name="whatsapp" state={state}>
          <input
            className="input"
            id="whatsapp"
            name="whatsapp"
            type="tel"
            placeholder="(11) 91234-5678"
            defaultValue={v("whatsapp")}
          />
        </Field>
        <Field label="Endereço" name="address" state={state}>
          <input className="input" id="address" name="address" defaultValue={v("address")} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cidade" name="city" state={state}>
            <input className="input" id="city" name="city" defaultValue={v("city")} />
          </Field>
          <Field label="Região" name="region" state={state}>
            <input
              className="input"
              id="region"
              name="region"
              list="regions"
              defaultValue={v("region")}
            />
            <datalist id="regions">
              {regions.map((region) => (
                <option key={region} value={region} />
              ))}
            </datalist>
          </Field>
        </div>
      </div>
      <Field label="Observações" name="notes" state={state}>
        <textarea className="input min-h-24" id="notes" name="notes" defaultValue={v("notes")} />
      </Field>
      <SubmitButton>{isNew ? "Cadastrar cliente" : "Salvar alterações"}</SubmitButton>
    </form>
  );
}
