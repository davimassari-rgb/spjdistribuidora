"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { startSession } from "@/lib/auth/current-user";
import { type FormState, invalidForm } from "@/lib/forms";
import { countUsers, createUser, userInputSchema } from "@/lib/users";

/** Cria o PRIMEIRO usuário. Só funciona com o banco sem nenhum usuário (não é cadastro público). */
export async function setupFirstUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const db = getDb();
  if ((await countUsers(db)) > 0) redirect("/login");

  const parsed = userInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidForm(parsed.error, formData);

  const user = await createUser(db, parsed.data);
  await startSession(user.id);
  redirect("/");
}
