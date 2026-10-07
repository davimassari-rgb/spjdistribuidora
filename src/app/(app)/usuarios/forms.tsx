"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { UserFields } from "@/components/user-fields";
import { initialFormState } from "@/lib/forms";
import { addUser, updateMyPassword } from "./actions";

export function AddUserForm() {
  const [state, action] = useActionState(addUser, initialFormState);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <UserFields state={state} />
      <SubmitButton>Adicionar usuário</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(updateMyPassword, initialFormState);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Senha atual" name="current" state={state}>
        <input
          className="input"
          id="current"
          name="current"
          type="password"
          required
          autoComplete="current-password"
        />
      </Field>
      <Field label="Nova senha" name="password" state={state}>
        <input
          className="input"
          id="password-new"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </Field>
      <Field label="Confirme a nova senha" name="confirm" state={state}>
        <input
          className="input"
          id="confirm"
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
        />
      </Field>
      <SubmitButton>Alterar senha</SubmitButton>
    </form>
  );
}
