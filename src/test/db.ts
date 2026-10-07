import { createDb, type DbHandle } from "@/db/client";

/** Banco PostgreSQL (PGlite) em memória com todas as migrations aplicadas. */
export async function createTestDb(): Promise<DbHandle> {
  const handle = createDb("pglite:memory");
  await handle.migrate();
  return handle;
}
