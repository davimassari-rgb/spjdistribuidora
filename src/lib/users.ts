import { asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { users } from "@/db/schema";
import { getDummyHash, hashPassword, verifyPassword } from "./auth/password";

export const userInputSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome."),
  email: z.email("E-mail inválido.").trim().toLowerCase(),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
});
export type UserInput = z.infer<typeof userInputSchema>;

export class DuplicateEmailError extends Error {
  constructor() {
    super("Já existe um usuário com este e-mail.");
  }
}

export async function countUsers(db: Db): Promise<number> {
  const [row] = await db.select({ value: count() }).from(users);
  return row.value;
}

export async function listUsers(db: Db) {
  return db
    .select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt })
    .from(users)
    .orderBy(asc(users.name));
}

export async function createUser(db: Db, input: UserInput): Promise<{ id: string }> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email));
  if (existing.length > 0) throw new DuplicateEmailError();
  const [row] = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
    })
    .returning({ id: users.id });
  return row;
}

/** Retorna o usuário se e-mail e senha conferem; null caso contrário (sem dizer qual errou). */
export async function authenticate(db: Db, email: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
  if (!user) {
    await verifyPassword(password, await getDummyHash()); // tempo de resposta constante
    return null;
  }
  return (await verifyPassword(password, user.passwordHash)) ? user : null;
}

export async function changePassword(db: Db, userId: string, newPassword: string): Promise<void> {
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword) })
    .where(eq(users.id, userId));
}

export async function deleteUser(db: Db, userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}
