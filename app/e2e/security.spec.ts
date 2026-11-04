import { connectMeta, createWebhook, expect, order, register, test } from "./helpers";

test.describe("Isolamento entre contas e mobile", () => {
  test("SEC-1 o segundo usuário não vê nada do primeiro", async ({ browser, request }) => {
    const a = await browser.newPage();
    await register(a, "alice");
    await connectMeta(a);
    const url = await createWebhook(a, "Webhook da Alice");
    const hookPage = a.url();
    await request.post(url, { data: order("ALICE-1") });

    const b = await (await browser.newContext()).newPage();
    await register(b, "bob");
    await b.goto("/vendas");
    await expect(b.getByText("Nenhuma venda recebida ainda")).toBeVisible();
    await b.goto("/integracoes");
    await expect(b.getByText("Webhook da Alice")).toHaveCount(0);
    const res = await b.goto(hookPage);
    expect(res?.status()).toBe(404);
    await b.goto("/campanhas");
    await expect(b.getByText("Conecte o Meta para ver suas campanhas")).toBeVisible();
    await b.goto("/vendas?q=ALICE");
    await expect(b.getByText("ALICE-1")).toHaveCount(0);
  });

  test("SEC-2 sair de todos os dispositivos derruba as outras sessões", async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const p1 = await ctx1.newPage();
    const email = await register(p1, "multi");
    const p2 = await (await browser.newContext()).newPage();
    await p2.goto("/login");
    await p2.getByLabel("E-mail").fill(email);
    await p2.getByLabel("Senha").fill("senha-de-teste-123");
    await p2.getByRole("button", { name: "Entrar" }).click();
    await expect(p2).toHaveURL(/\/hoje$/);

    await p1.goto("/configuracoes");
    await p1.getByRole("button", { name: "Sair de todos os dispositivos" }).click();
    await expect(p1).toHaveURL(/\/login$/);
    await p2.goto("/dashboard");
    await expect(p2).toHaveURL(/\/login$/);
  });

  test("SEC-3 excluir conta pede confirmação e apaga", async ({ page }) => {
    const email = await register(page, "del");
    await page.goto("/configuracoes");
    await page.getByLabel(/Digite .* para confirmar/).fill("errado@x.com");
    await page.getByRole("button", { name: "Excluir minha conta" }).click();
    await expect(page.getByText("O e-mail digitado não confere")).toBeVisible();
    await page.getByLabel(/Digite .* para confirmar/).fill(email);
    await page.getByRole("button", { name: "Excluir minha conta" }).click();
    await expect(page).toHaveURL(/\/register$/);
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill("senha-de-teste-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha não conferem.", { exact: true })).toBeVisible();
  });

  test("MOB-1 telas cabem em 390px sem rolagem horizontal da página", async ({ browser, request }) => {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await register(page, "mobile");
    await connectMeta(page);
    const url = await createWebhook(page);
    await request.post(url, { data: order("MOB-1", { product: "Um produto com um nome bem comprido para testar quebra de linha" }) });
    const hookPage = new URL(page.url()).pathname;
    for (const p of ["/onboarding", "/dashboard", "/campanhas", "/vendas", "/integracoes", hookPage, "/contas", "/utms", "/pixel", "/hoje", "/custos", "/configuracoes"]) {
      await page.goto(p);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${p} rola ${overflow}px na horizontal`).toBeLessThanOrEqual(0);
    }
  });
});
