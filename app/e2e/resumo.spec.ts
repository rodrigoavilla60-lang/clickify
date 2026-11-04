import { connectMeta, createWebhook, expect, order, register, test } from "./helpers";

test.describe("Resumo: filtros e de onde vêm as vendas", () => {
  test("RE-1 quebras por produto, fonte e pagamento, e filtro de produto", async ({ page, request }) => {
    await register(page, "resumo");
    await connectMeta(page);
    const url = await createWebhook(page);
    const post = (data: object) => request.post(url, { data });
    await post(order("R-1", { product: "Kit A", amount: 100, payment_method: "pix" }));
    await post(order("R-2", { product: "Kit A", amount: 100, payment_method: "pix" }));
    await post(order("R-3", { product: "Kit B", amount: 50, payment_method: "credit_card" }));
    await post(order("R-4", { product: "Kit B", amount: 50, payment_method: "credit_card", status: "refused" }));
    await post({ id: "R-5", status: "approved", amount: 30, product: "Kit B", payment_method: "pix" }); // sem UTM

    await page.goto("/dashboard?p=hoje");
    const produtos = page.getByRole("region", { name: "De onde vêm as vendas" });
    await expect(produtos.getByText("Kit A")).toBeVisible();
    await expect(produtos.getByRole("listitem").filter({ hasText: "Kit A" })).toContainText("R$ 200,00");
    await expect(produtos.getByRole("listitem").filter({ hasText: "Kit B" })).toContainText("R$ 80,00");
    await expect(produtos.getByRole("listitem").filter({ hasText: "Sem UTM" })).toContainText("R$ 30,00");

    const pagamento = page.getByRole("row", { name: /Cartão/ });
    await expect(pagamento).toContainText("R$ 50,00");
    await expect(pagamento).toContainText("50%"); // 1 pago de 2 decididos
    await expect(page.getByRole("row", { name: /Pix/ })).toContainText("100%");

    // Filtro de produto: faturamento só do Kit A, e o aviso de que o gasto é o total
    await page.getByLabel("Produto").selectOption("Kit A");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page).toHaveURL(/produto=Kit\+A/);
    await expect(page.getByRole("region", { name: "Indicadores principais" })).toContainText("R$ 200,00");
    await expect(page.getByText(/o gasto com anúncios continua sendo o total/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Limpar" })).toBeVisible();

    // O filtro sobrevive à troca de período
    await page.getByRole("link", { name: "7 dias" }).click();
    await expect(page).toHaveURL(/produto=Kit\+A/);

    // Valor de filtro que não existe é ignorado
    await page.goto("/dashboard?p=hoje&produto=Inexistente");
    await expect(page.getByText(/o gasto com anúncios continua sendo o total/)).toHaveCount(0);
  });
});
