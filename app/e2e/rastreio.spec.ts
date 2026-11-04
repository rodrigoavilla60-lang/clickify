import { axe, connectMeta, createWebhook, expect, order, register, test } from "./helpers";

test.describe("Taxa de rastreio", () => {
  test("RA-1 mostra a taxa, a quebra por checkout e o conselho quando cai", async ({ page, request }) => {
    await register(page, "rastreio");
    await connectMeta(page);
    const loja = await createWebhook(page, "Loja principal");
    const outra = await createWebhook(page, "Loja Dois");

    await page.goto("/dashboard?p=7d");
    const card = page.getByRole("region", { name: "Taxa de rastreio" });
    await expect(card).toContainText("Nenhuma venda aprovada no período.");

    // Loja principal: 4 com anúncio, 1 só com UTM. Loja Dois: 1 com anúncio, 4 sem UTM.
    for (let i = 0; i < 4; i++) await request.post(loja, { data: order(`RA-A${i}`) });
    await request.post(loja, { data: { id: "RA-U", status: "approved", amount: 50, utm_source: "instagram" } });
    await request.post(outra, { data: order("RA-B0") });
    for (let i = 0; i < 4; i++) await request.post(outra, { data: { id: `RA-N${i}`, status: "approved", amount: 50 } });
    // Pendente não conta
    await request.post(outra, { data: { id: "RA-P", status: "pending", amount: 50 } });

    await page.reload();
    await expect(card).toContainText("60%"); // 6 de 10 com origem
    await expect(card).toContainText("Baixo");
    await expect(card).toContainText("Ligadas a anúncio: 5");
    await expect(card).toContainText("Só com UTM: 1");
    await expect(card).toContainText("Sem origem: 4");
    await expect(card.getByRole("row", { name: /Loja principal/ })).toContainText("100%");
    await expect(card.getByRole("row", { name: /Loja Dois/ })).toContainText("20%");
    await expect(card.getByRole("note")).toContainText("As vendas de Loja Dois chegam sem UTM.");
    await axe(page);

    await card.getByRole("link", { name: "Ver as vendas não atribuídas" }).click();
    await expect(page).toHaveURL(/\/vendas\?p=7d&s=sem-utm/);

    // A tela Hoje avisa antes de sugerir mexer nos anúncios
    await page.goto("/hoje");
    await expect(page.getByRole("list", { name: "Decisões sugeridas" }).getByRole("listitem").first())
      .toContainText("Só 60% das 10 vendas dos últimos 7 dias chegaram com origem.");
  });
});
