import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type DbHandle = {
  db: Db;
  migrate: () => Promise<void>;
  close: () => Promise<void>;
};

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");
export const DEFAULT_DEV_DATABASE_URL = "pglite:./.data/pglite";

/**
 * Cria a conexão a partir da URL:
 * - `pglite:memory`  → PostgreSQL embutido em memória (testes)
 * - `pglite:<pasta>` → PostgreSQL embutido gravando em disco (desenvolvimento)
 * - `postgres://...` → PostgreSQL real (produção)
 */
export function createDb(url: string): DbHandle {
  if (url.startsWith("pglite:")) {
    const location = url.slice("pglite:".length);
    if (location !== "memory") mkdirSync(location, { recursive: true });
    const client = location === "memory" ? new PGlite() : new PGlite(location);
    const db = drizzlePglite({ client, schema, casing: "snake_case" });
    return {
      db: db as unknown as Db,
      migrate: () => migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER }),
      close: () => client.close(),
    };
  }

  if (/^postgres(ql)?:\/\//.test(url)) {
    const pool = new Pool({ connectionString: url, max: 5 });
    const db = drizzleNodePg({ client: pool, schema, casing: "snake_case" });
    return {
      db: db as unknown as Db,
      migrate: () => migrateNodePg(db, { migrationsFolder: MIGRATIONS_FOLDER }),
      close: () => pool.end(),
    };
  }

  throw new Error(
    "DATABASE_URL inválida: use 'pglite:<pasta>', 'pglite:memory' ou 'postgres://...'.",
  );
}

export function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL não definida.");
  }
  return DEFAULT_DEV_DATABASE_URL;
}

// Singleton por processo. O globalThis evita abrir várias conexões no hot reload do `next dev`
// (com PGlite isso corromperia o banco: só um processo/instância pode abrir a pasta).
const globalForDb = globalThis as unknown as { spjDb?: DbHandle };

export function getDb(): Db {
  globalForDb.spjDb ??= createDb(resolveDatabaseUrl());
  return globalForDb.spjDb.db;
}
