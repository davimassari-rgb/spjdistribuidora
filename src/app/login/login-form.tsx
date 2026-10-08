"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { PasswordInput } from "@/components/ui/password-input";
import { initialFormState } from "@/lib/forms";
import { login } from "./actions";

export function LoginForm() {
  const [state, action] = useActionState(login, initialFormState);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div>
        <label className="label" htmlFor="email">
          E-mail
        </label>
        <input
          className="input"
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state.values?.email}
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Senha
        </label>
        <PasswordInput id="password" name="password" autoComplete="current-password" />
      </div>
      <SubmitButton pendingText="Entrando…" className="btn-primary w-full">
        Entrar
      </SubmitButton>
    </form>
  );
}
