import { Field } from "@/components/form";
import type { FormState } from "@/lib/forms";

/** Campos nome/e-mail/senha, usados na configuração inicial e no cadastro de usuários. */
export function UserFields({ state }: { state: FormState }) {
  return (
    <>
      <Field label="Nome" name="name" state={state}>
        <input className="input" id="name" name="name" required defaultValue={state.values?.name} />
      </Field>
      <Field label="E-mail" name="email" state={state}>
        <input
          className="input"
          id="email"
          name="email"
          type="email"
          required
          autoComplete="off"
          defaultValue={state.values?.email}
        />
      </Field>
      <Field label="Senha" name="password" state={state} hint="Mínimo de 8 caracteres.">
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </Field>
    </>
  );
}
