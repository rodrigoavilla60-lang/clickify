import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";

// Cada execução usa um banco e um estado de mock novos, sem tocar nos dados de dev.
const runDir = process.env.E2E_DIR ?? path.join(".data", `e2e-${Date.now()}`);
process.env.E2E_DIR = runDir;

export default defineConfig({
  testDir: "e2e",
  // Caminho curto: no Windows os nomes dos testes estouram o limite de 260 caracteres.
  outputDir: path.join(os.tmpdir(), "clickify-e2e"),
  fullyParallel: false,
  workers: 1, // um PGlite e um estado de mock compartilhados
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    permissions: ["clipboard-read", "clipboard-write"],
  },
  webServer: {
    command: "npx next dev -p 3100",
    url: "http://localhost:3100/login",
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      E2E: "1",
      PGLITE_DIR: path.join(runDir, "pglite"),
      META_MOCK_FILE: path.join(runDir, "meta-mock.json"),
      META_MODE: "mock",
      EMAIL_OUTBOX: path.join(runDir, "outbox"),
      RESEND_API_KEY: "",
    },
  },
});
