import { defineConfig } from "drizzle-kit";

// Usado apenas por `npm run db:generate` (gera SQL a partir do schema; não conecta no banco).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
});
