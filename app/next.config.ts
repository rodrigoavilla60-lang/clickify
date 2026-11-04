import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Existe um package-lock.json solto na pasta do usuário; sem isto o Next acha que a raiz é lá.
  outputFileTracingRoot: path.resolve("."),
  // PGlite carrega um binário WASM: fica fora do bundle do servidor.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Schema e migrações são lidos do disco no 1º acesso ao banco: precisam ir junto em toda rota do deploy.
  outputFileTracingIncludes: { "/**": ["./db/schema.sql", "./db/migrations.sql"] },
};

export default nextConfig;
