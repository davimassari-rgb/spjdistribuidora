import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Cada arquivo de teste sobe seu próprio PGlite em memória; o boot leva alguns segundos.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
