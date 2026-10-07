"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { UserFields } from "@/components/user-fields";
import { initialFormState } from "@/lib/forms";
import { setupFirstUser } from "./actions";

export function SetupForm() {
  const [state, action] = useActionState(setupFirstUser, initialFormState);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <UserFields state={state} />
      <SubmitButton className="btn-primary w-full">Criar acesso</SubmitButton>
    </form>
  );
}
