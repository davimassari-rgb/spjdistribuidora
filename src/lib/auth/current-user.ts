import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db/client";
import { createSession, findUserBySessionToken, type SessionUser } from "./sessions";

// Integração das sessões com o Next.js (cookies). Toda Server Action deve chamar requireUser().

export const SESSION_COOKIE = "spj_session";

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return findUserBySessionToken(getDb(), token);
});

/** Usuário da EQUIPE. Clientes finais são mandados para o portal. Use em toda área interna. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "staff") redirect("/portal");
  return user;
}

/** Cliente final logado no portal (com o cliente ao qual pertence). */
export async function requireCustomer(): Promise<SessionUser & { clientId: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "customer" || !user.clientId) redirect("/");
  return { ...user, clientId: user.clientId };
}

export async function startSession(userId: string): Promise<void> {
  const { token, expiresAt } = await createSession(getDb(), userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}
