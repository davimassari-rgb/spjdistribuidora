"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { SESSION_COOKIE, startSession } from "@/lib/auth/current-user";
import { deleteSession } from "@/lib/auth/sessions";
import type { FormState } from "@/lib/forms";
import { authenticate } from "@/lib/users";

const loginSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: "Informe e-mail e senha.", values: { email } };

  const user = await authenticate(getDb(), parsed.data.email, parsed.data.password);
  if (!user) return { error: "E-mail ou senha incorretos.", values: { email } };

  await startSession(user.id);
  redirect("/");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(getDb(), token);
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
