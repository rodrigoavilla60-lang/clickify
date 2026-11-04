import { connectMeta, createWebhook, expect, order, register, test } from "./helpers";

test.describe("Custos e lucro real", () => {
  test("CU-1 custos cadastrados entram no lucro e no 'de onde veio isso?'", async ({ page, request }) => {
    await register(page, "custos");
    await connectMeta(page);
    const url = await createWebhook(page);
    await request.post(url, { data: order("CU-1", { product: "Kit Conforto", amount: 197.9 }) });

    await page.goto("/custos");
    await page.getByLabel("Imposto sobre a venda (%)").fill("6");
    await page.getByLabel("Taxa do gateway (%)").fill("4,99");
    await page.getByLabel("Imposto sobre o anúncio (%)").fill("12,15");
    await page.getByRole("button", { name: "Salvar impostos e padrões" }).click();
    await expect(page.getByText("O lucro já usa os novos valores")).toBeVisible();

    // O produto vendido aparece sozinho na lista
    await page.getByLabel("Custo de Kit Conforto").fill("50");
    await page.getByLabel("Frete de Kit Conforto").fill("15");
    await page.getByRole("button", { name: "Salvar custos dos produtos" }).click();
    await expect(page.getByText("Custos dos produtos salvos.")).toBeVisible();

    await page.getByLabel("Despesa", { exact: true }).fill("Ferramentas");
    await page.getByLabel("Valor por mês (R$)").fill("365");
    await page.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByRole("button", { name: "Remover Ferramentas" })).toBeVisible();

    await page.goto("/dashboard?p=hoje");
    await page.getByText("De onde veio isso?").click();
    const conta = page.locator("details").filter({ hasText: "De onde veio isso?" });
    await expect(conta).toContainText("Faturamento");
    await expect(conta).toContainText("R$ 197,90");
    await expect(conta.getByText("Custo dos produtos e frete").locator("..")).toContainText("R$ 65,00");
    await expect(conta.getByText("Imposto sobre a venda").locator("..")).toContainText("R$ 11,87");
    await expect(conta.getByText("Taxa do gateway").locator("..")).toContainText("R$ 9,88");
    await expect(conta.getByText("Despesas fixas").locator("..")).toContainText("R$ 12,00");
    await expect(conta).toContainText("Imposto sobre o anúncio");

    // Remover a despesa tira a linha da conta
    await page.goto("/custos");
    await page.getByRole("button", { name: "Remover Ferramentas" }).click();
    await expect(page.getByRole("button", { name: "Remover Ferramentas" })).toHaveCount(0);
  });

  test("CU-2 valores inválidos mostram erro e não salvam", async ({ page }) => {
    await register(page, "custos2");
    await page.goto("/custos");
    await page.getByLabel("Imposto sobre a venda (%)").fill("150");
    await page.getByRole("button", { name: "Salvar impostos e padrões" }).click();
    await expect(page.getByText("Os percentuais precisam estar entre 0 e 100.")).toBeVisible();
    await page.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText(/Dê um nome de 2 a 60 caracteres/)).toBeVisible();
  });
});
