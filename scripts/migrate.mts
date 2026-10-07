// Aplica as migrations pendentes da pasta ./drizzle no banco de DATABASE_URL.
// Com PGlite, NÃO rode com o `next dev` aberto (só um processo pode abrir a pasta do banco).
import { createDb, resolveDatabaseUrl } from "../src/db/client";

const url = resolveDatabaseUrl();
const handle = createDb(url);

try {
  await handle.migrate();
  console.log(`Migrations aplicadas (${url.startsWith("pglite:") ? url : "postgres"}).`);
} catch (error) {
  console.error("Falha ao aplicar migrations:", error);
  process.exitCode = 1;
} finally {
  await handle.close();
}
