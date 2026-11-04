import { axe, connectMeta, createWebhook, expect, MOCK, order, register, test, logout } from "./helpers";

test.describe("F01 primeira configuração até a 1ª venda atribuída", () => {
  test("F01-H1 do cadastro à venda na campanha certa", async ({ page, request }) => {
    await register(page, "f01");
    await expect(page.getByText("0 de 4 passos concluídos")).toBeVisible();

    await connectMeta(page);
    const url = await createWebhook(page);

    // O checkout manda a venda (HTTP de verdade, como um checkout faria).
    const res = await request.post(url, { data: order("PED-100") });
    expect(await res.json()).toEqual({ ok: true, result: "created" });

    await page.goto("/vendas");
    const row = page.getByRole("row", { name: /PED-100/ });
    await expect(row).toContainText("Aprovada");
    await expect(row).toContainText("R$ 197,90");
    await expect(row).toContainText(MOCK.campaign.name);
    await expect(row).toContainText(MOCK.ad.name);

    await page.goto("/campanhas");
    const camp = page.getByRole("row", { name: new RegExp(MOCK.campaign.name.replace(/[[\]]/g, "\\$&")) });
    await expect(camp).toContainText("R$ 197,90");

    await page.goto("/utms");
    await page.getByRole("button", { name: "Copiar: Parâmetros de URL para o anúncio" }).click();
    await expect(page.getByText("Copiado", { exact: true })).toBeVisible();

    await page.goto("/onboarding");
    await expect(page.getByText("Tudo pronto")).toBeVisible();
  });

  test("F01-H2 funil de conversão fixo no Resumo", async ({ page, request }) => {
    await register(page, "funil");
    await page.goto("/dashboard");
    await expect(page.getByText("Conecte uma conta do Meta para ver o caminho")).toBeVisible();

    await connectMeta(page);
    const url = await createWebhook(page);
    await request.post(url, { data: order("FUNIL-1") });
    await request.post(url, { data: order("FUNIL-2", { status: "pending" }) });

    await page.goto("/dashboard?p=7d");
    const funil = page.getByRole("region", { name: "Funil de conversão" });
    await expect(funil).toBeVisible();
    for (const etapa of ["Cliques no link", "Viram a página", "Carrinho", "Checkout", "Pedidos", "Vendas aprovadas"])
      await expect(funil.getByText(etapa, { exact: true }).filter({ visible: true })).toBeVisible();
    // 2 pedidos com UTM de anúncio, 1 aprovado
    const pedidos = funil.getByRole("listitem").filter({ hasText: "Pedidos", visible: true });
    await expect(pedidos).toContainText("2");
    await expect(funil.getByText("maior vazamento").filter({ visible: true })).toBeVisible();
    await expect(funil.getByRole("note")).toContainText("Onde mais se perde");
  });

  test("F01-E1 eventos repetidos, fora de ordem e reembolso", async ({ page, request }) => {
    await register(page, "f01e");
    await connectMeta(page);
    const url = await createWebhook(page);
    const post = async (body: object, id?: string) =>
      (await request.post(url, { data: body, headers: id ? { "x-event-id": id } : {} })).json();

    expect(await post(order("PED-1", { status: "pending" }), "a")).toMatchObject({ result: "created" });
    expect(await post(order("PED-1"), "b")).toMatchObject({ result: "updated" });
    expect(await post(order("PED-1"), "b")).toMatchObject({ duplicate: true });
    expect(await post(order("PED-1", { status: "pending" }), "c")).toMatchObject({ result: "ignored" });
    expect(await post(order("PED-1", { status: "refunded" }), "d")).toMatchObject({ result: "updated" });

    await page.goto("/vendas");
    await expect(page.getByRole("row", { name: /PED-1/ })).toContainText("Reembolsada");
    await page.goto("/dashboard");
    await expect(page.getByRole("region", { name: "Indicadores principais" }).getByText("Faturamento", { exact: true }).first().locator("../..")).toContainText("R$ 0,00");
  });

  test("F01-E2 venda sem UTM vira não atribuída", async ({ page, request }) => {
    await register(page, "f01u");
    await connectMeta(page);
    const url = await createWebhook(page);
    await request.post(url, { data: { id: "SEM-UTM", status: "approved", amount: 50 } });
    await request.post(url, { data: order("COM-UTM") });

    await page.goto("/vendas?s=sem-utm");
    await expect(page.getByRole("row", { name: /SEM-UTM/ })).toContainText("Não atribuída (sem UTM)");
    await expect(page.getByRole("row", { name: /COM-UTM/ })).toHaveCount(0);
    await page.goto("/dashboard");
    await expect(page.getByText(/1 venda aprovada chegou sem UTM/)).toBeVisible();
  });

  test("F01-N1 webhook recusa entrada ruim", async ({ page, request }) => {
    await register(page, "f01n");
    const url = await createWebhook(page);
    const raw = (body: string) => request.post(url, { data: Buffer.from(body), headers: { "content-type": "application/json" } });
    expect((await raw("{não é json")).status()).toBe(400);
    // JSON válido mas que não é um objeto também é recusado (BUG-1)
    for (const body of ['"texto"', "null", "[1,2]", "42"]) expect((await raw(body)).status(), body).toBe(400);
    expect((await request.post(url.replace(/[^/]+$/, "token-que-nao-existe"), { data: order("X") })).status()).toBe(404);
    expect(await (await request.post(url, { data: { id: "X", status: "talvez" } })).json()).toMatchObject({ ok: false });
    expect((await request.post(url, { data: { id: "big", pad: "x".repeat(300_000) } })).status()).toBe(413);
  });

  test("F01-N2 cadastro e login com erro", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Diga como podemos te chamar.")).toBeVisible();
    await expect(page.getByText("Esse e-mail não parece válido.")).toBeVisible();
    await expect(page.getByText("A senha precisa de pelo menos 8 caracteres.")).toBeVisible();
    await expect(page.getByLabel("E-mail")).toHaveAttribute("aria-invalid", "true");

    const email = await register(page, "dup");
    await logout(page);
    await page.goto("/register");
    await page.getByLabel("Seu nome").fill("Outra");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill("senha-de-teste-123");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText(/Já existe uma conta/)).toBeVisible();

    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill("senha-errada-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha não conferem.", { exact: true })).toBeVisible();

    await page.getByLabel("Senha").fill("senha-de-teste-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/hoje$/);
  });

  test("F01-E3 sem sessão volta para o login", async ({ page }) => {
    for (const p of ["/dashboard", "/campanhas", "/vendas", "/integracoes", "/configuracoes"]) {
      await page.goto(p);
      await expect(page).toHaveURL(/\/login$/);
    }
  });

  test("F01-A11Y telas sem violações WCAG A/AA", async ({ page, request }) => {
    await page.goto("/login");
    await axe(page);
    await page.goto("/register");
    await axe(page);
    await register(page, "a11y");
    await axe(page);
    await connectMeta(page);
    await axe(page);
    const url = await createWebhook(page);
    await axe(page);
    await request.post(url, { data: order("A11Y-1") });
    for (const p of ["/integracoes", "/dashboard?p=7d", "/campanhas", "/vendas", "/utms", "/pixel", "/hoje", "/configuracoes"]) {
      await page.goto(p);
      await axe(page);
    }
  });
});
