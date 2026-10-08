import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite carrega arquivos .wasm em tempo de execução; não pode passar pelo bundler.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    serverActions: {
      // Planilhas de fornecedor são enviadas via Server Action (limite padrão: 1 MB).
      bodySizeLimit: "20mb",
    },
  },
  turbopack: {
    // Há outro package-lock.json numa pasta acima; fixa a raiz no projeto.
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
