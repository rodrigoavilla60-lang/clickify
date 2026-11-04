import { test as base, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// IDs que o mock do Meta gera para a "Conta Principal" (ver src/lib/meta.ts).
export const MOCK = {
  campaign: { id: "2385010000000", name: "[CBO] Sutiã Conforto - Compra" },
  adset: { id: "2385010100000", name: "Mulheres 30-55 | Aberto" },
  ad: { id: "2385010102000", name: "Criativo 1.1.1 | Vídeo UGC" },
};

// Toda página falha o teste se houver erro no console ou resposta 5xx.
export const test = base.extend<{ guard: void }>({
  guard: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") problems.push(`console: ${m.text()}`);
      });
      page.on("response", (r) => {
        if (r.status() >= 500) problems.push(`${r.status()} ${r.url()}`);
      });
      await use();
      expect(problems, problems.join("\n")).toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

let n = 0;
export async function register(page: Page, label = "user") {
  const email = `${label}-${Date.now()}-${n++}@clickify.test`;
  await page.goto("/register");
  await page.getByLabel("Seu nome").fill("Maria Conceição Teste");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senha-de-teste-123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  // Na 1ª execução o servidor de teste ainda compila as páginas: dá mais tempo só aqui.
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 60_000 });
  return email;
}

export async function connectMeta(page: Page) {
  await page.goto("/api/meta/connect");
  await expect(page).toHaveURL(/\/contas$/);
  await expect(page.getByText("Conta Principal")).toBeVisible();
}

export async function createWebhook(page: Page, name = "Checkout de teste") {
  await page.goto("/integracoes");
  await page.getByLabel("Plataforma").selectOption("generic");
  await page.getByLabel("Nome", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Gerar URL" }).click();
  await expect(page).toHaveURL(/\/integracoes\/[0-9a-f-]{36}$/);
  return (await page.getByLabel("URL do webhook", { exact: true }).textContent())!.trim();
}

export function order(id: string, extra: Record<string, unknown> = {}) {
  return {
    id, status: "approved", amount: 197.9, product: "Kit conforto",
    utm_source: "FB",
    utm_campaign: `${MOCK.campaign.name}|${MOCK.campaign.id}`,
    utm_medium: `${MOCK.adset.name}|${MOCK.adset.id}`,
    utm_content: `${MOCK.ad.name}|${MOCK.ad.id}`,
    ...extra,
  };
}

export async function axe(page: Page) {
  // @axe-core/playwright tipa contra outra versão do playwright-core; em runtime é a mesma página.
  const r = await new AxeBuilder({ page: page as never }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const msgs = r.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length}x) ${v.nodes[0]?.target}`);
  expect(msgs, msgs.join("\n")).toEqual([]);
}

// "Sair" fica no menu da conta, na barra de cima.
export async function logout(page: Page) {
  await page.getByLabel(/^Menu da conta/).click();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);
}