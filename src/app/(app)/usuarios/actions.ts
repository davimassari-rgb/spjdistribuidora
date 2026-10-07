"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current-user";
import { deleteUserSessions } from "@/lib/auth/sessions";
import { type FormState, invalidForm } from "@/lib/forms";
import {
  authenticate,
  changePassword,
  createUser,
  DuplicateEmailError,
  deleteUser,
  userInputSchema,
} from "@/lib/users";

export async function addUser(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = userInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidForm(parsed.error, formData);
  try {
    await createUser(getDb(), parsed.data);
  } catch (error) {
    if (error instanceof DuplicateEmailError) {
      return { fieldErrors: { email: error.message }, values: { name: parsed.data.name } };
    }
    throw error;
  }
  revalidatePath("/usuarios");
  return { success: `Usuário ${parsed.data.name} criado.` };
}

export async function removeUser(formData: FormData): Promise<void> {
  const me = await requireUser();
  const userId = z.uuid().parse(formData.get("userId"));
  if (userId === me.id) throw new Error("Você não pode remover o próprio acesso.");
  await deleteUser(getDb(), userId);
  revalidatePath("/usuarios");
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Informe a senha atual."),
    password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "As senhas não conferem.",
  });

export async function updateMyPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidForm(parsed.error, formData);
  const db = getDb();
  if (!(await authenticate(db, me.email, parsed.data.current))) {
    return { fieldErrors: { current: "Senha atual incorreta." } };
  }
  await changePassword(db, me.id, parsed.data.password);
  // Encerra as sessões em outros aparelhos; a atual também cai, então pedimos novo login.
  await deleteUserSessions(db, me.id);
  return { success: "Senha alterada. Entre novamente com a nova senha." };
}
