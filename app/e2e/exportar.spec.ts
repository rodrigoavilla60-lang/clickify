import { connectMeta, createWebhook, expect, MOCK, order, register, test } from "./helpers";

test.describe("Exportar e relatório por UTM", () => {
  test("EX-1 planilhas de vendas, UTM e campanhas", async ({ page, request }) => {
    await register(page, "export");
    await connectMeta(page);
    const url = await createWebhook(page);
    await request.post(url, { data: order("EX-1", { product: 'Kit "Azul"; G', amount: 197.9, payment_method: "pix" }) });
    await request.post(url, { data: { id: "EX-2", status: "approved", amount: 50, product: "Avulso" } });

    // Vendas: botão baixa CSV no formato do Excel brasileiro
    await page.goto("/vendas?p=hoje");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Exportar planilha" }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^clickify-vendas-.*\.csv$/);
    const vendas = await (await page.request.get(await page.getByRole("link", { name: "Exportar planilha" }).getAttribute("href") ?? "")).text();
    expect(vendas.charCodeAt(0)).toBe(0xfeff);
    expect(vendas).toContain("Pedido;Status;Valor (R$)");
    expect(vendas).toContain("EX-1;Aprovada;197,9;BRL;\"Kit \"\"Azul\"\"; G\"");
    expect(vendas).toContain(MOCK.campaign.name);
    expect(vendas).toContain("Pix");

    // Visão por UTM: agrupa por campanha com gasto e ROAS
    await page.getByRole("link", { name: "Por UTM" }).click();
    await expect(page.getByRole("columnheader", { name: "Gasto" })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(MOCK.campaign.id) })).toContainText("R$ 197,90");
    await expect(page.getByRole("row", { name: /sem UTM/ })).toContainText("R$ 50,00");
    await page.getByLabel("Agrupar por").selectOption("utm_source");
    await page.getByRole("button", { name: "Ver" }).click();
    await expect(page.getByRole("columnheader", { name: "Gasto" })).toHaveCount(0);
    await expect(page.getByRole("row", { name: /^FB/ })).toContainText("R$ 197,90");
    const utm = await (await page.request.get(`/api/export/utm?p=hoje&por=utm_source`)).text();
    expect(utm).toContain("utm_source;Pedidos;Vendas aprovadas");
    expect(utm).toContain("FB;1;1;197,9");

    // Campanhas: todas as colunas do catálogo, mesmo as escondidas
    const camp = await (await page.request.get(`/api/export/campanhas?p=hoje`)).text();
    expect(camp).toContain("Nome;Status;Conta;Plataforma;Orçamento/dia (R$);Gasto (R$)");
    expect(camp).toContain("CTR");
    expect(camp).toContain(MOCK.campaign.name);

    // Sem login não exporta
    const anon = await request.get("/api/export/vendas?p=hoje", { headers: { cookie: "" } });
    expect(anon.status()).toBe(401);
  });
});
