// Dados FICTÍCIOS para desenvolvimento local. Nunca rode em produção.
// Uso: npm run db:seed  (com o `next dev` parado, se estiver usando PGlite)
import { eq } from "drizzle-orm";
import { createDb, resolveDatabaseUrl } from "../src/db/client";
import { users } from "../src/db/schema";
import { createUser } from "../src/lib/users";

export const DEV_USER = { name: "Usuário Dev", email: "dev@spj.test", password: "spj-dev-123" };

if (process.env.NODE_ENV === "production") {
  console.error("Seed é só para desenvolvimento.");
  process.exit(1);
}

const handle = createDb(resolveDatabaseUrl());
try {
  await handle.migrate();
  const db = handle.db;

  const [existing] = await db.select().from(users).where(eq(users.email, DEV_USER.email));
  if (!existing) await createUser(db, DEV_USER);

  console.log(`Seed concluído. Login: ${DEV_USER.email} / ${DEV_USER.password}`);
} finally {
  await handle.close();
}
