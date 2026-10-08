"use client";

import { KeyRound, UserPlus } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Modal } from "@/components/ui/modal";
import { PasswordInput } from "@/components/ui/password-input";
import { UserFields } from "@/components/user-fields";
import { initialFormState } from "@/lib/forms";
import { addUser, updateMyPassword } from "./actions";

function AddUserForm({ onDone }: { onDone: () => void }) {
  const [state, action] = useActionState(addUser, initialFormState);
  useEffect(() => {
    if (state.success) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <UserFields state={state} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancelar
        </button>
        <SubmitButton>Adicionar usuário</SubmitButton>
      </div>
    </form>
  );
}

function ChangePasswordForm({ onCancel }: { onCancel: () => void }) {
  const [state, action] = useActionState(updateMyPassword, initialFormState);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Senha atual" name="current" state={state}>
        <PasswordInput id="current" name="current" autoComplete="current-password" />
      </Field>
      <Field label="Nova senha" name="password" state={state} hint="Mínimo de 8 caracteres.">
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          showStrength
        />
      </Field>
      <Field label="Confirme a nova senha" name="confirm" state={state}>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" />
      </Field>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Fechar
        </button>
        <SubmitButton>Alterar senha</SubmitButton>
      </div>
    </form>
  );
}

/** Botões do cabeçalho de Usuários que abrem os formulários em janelas modais. */
export function UserActions({ openPassword = false }: { openPassword?: boolean }) {
  const [modal, setModal] = useState<"new" | "password" | null>(openPassword ? "password" : null);
  const close = () => setModal(null);
  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => setModal("password")}>
        <KeyRound className="size-4" aria-hidden />
        Alterar minha senha
      </button>
      <button type="button" className="btn-primary" onClick={() => setModal("new")}>
        <UserPlus className="size-4" aria-hidden />
        Novo usuário
      </button>
      <Modal open={modal === "new"} title="Novo usuário" onClose={close}>
        <AddUserForm onDone={close} />
      </Modal>
      <Modal open={modal === "password"} title="Alterar minha senha" onClose={close}>
        <ChangePasswordForm onCancel={close} />
      </Modal>
    </>
  );
}
