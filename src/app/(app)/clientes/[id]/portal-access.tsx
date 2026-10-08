"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { UserFields } from "@/components/user-fields";
import { initialFormState } from "@/lib/forms";
import { addPortalLoginAction } from "../actions";

/** Formulário para a equipe criar o login do cliente final no portal de pedidos. */
export function PortalLoginForm({ clientId }: { clientId: string }) {
  const [state, action] = useActionState(addPortalLoginAction, initialFormState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      <FormMessage state={state} />
      <UserFields state={state} />
      <SubmitButton>Criar acesso ao portal</SubmitButton>
    </form>
  );
}
