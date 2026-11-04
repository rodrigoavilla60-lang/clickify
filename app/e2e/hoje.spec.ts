import { axe, connectMeta, createWebhook, expect, MOCK, order, register, test } from "./helpers";

test.describe("Tela Hoje e menu", () => {
  test("HJ-1 sugere pausar e escalar, e age só depois de confirmar", async ({ page, request }) => {
    await register(page, "hoje");
    // Antes de ligar tudo, a tela explica o que falta em vez de inventar sugestões
    await page.goto("/hoje");
    await expect(page.getByText("Ainda não dá para sugerir nada")).toBeVisible();

    await connectMeta(page);
    const url = await createWebhook(page);

    // Gasto sem nenhum pedido chegando: o problema provável é o rastreio, não os anúncios
    await page.goto("/hoje");
    await expect(page.getByText("Conferir o rastreio")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pausar" })).toHaveCount(0);

    // 4 vendas de R$ 400 pela campanha principal e 6 avulsas de R$ 20: cada venda deixa em média
    // R$ 172, então anúncio que gastou mais que isso sem vender entra para pausar.
    for (let i = 0; i < 4; i++) await request.post(url, { data: order(`HJ-${i}`, { amount: 400 }) });
    for (let i = 0; i < 6; i++) await request.post(url, { data: { id: `HJ-avulso-${i}`, status: "approved", amount: 20, product: "Avulso" } });
    await page.reload();
    const list = page.getByRole("list", { name: "Decisões sugeridas" });
    const scale = list.getByRole("listitem").filter({ hasText: MOCK.campaign.name });
    await expect(scale).toContainText("Escalar campanha");
    await expect(list.getByText(/Pausar anúncio/).first()).toBeVisible();
    // O anúncio que vendeu não aparece para pausar
    await expect(list.getByRole("listitem").filter({ hasText: MOCK.ad.name })).toHaveCount(0);
    await axe(page);

    // Escalar: cancelar não muda nada; confirmar sobe o orçamento no Meta. O orçamento atual depende
    // de outros testes (o mock do Meta é compartilhado), então lê o valor do próprio botão.
    const up = scale.getByRole("button", { name: /^Subir para R\$ [\d.,]+\/dia$/ });
    const label = (await up.textContent())!.trim();
    const target = label.match(/R\$\s[\d.,]+/)![0];
    await up.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`Subir o orçamento de "${MOCK.campaign.name}" para ${target} por dia?`);
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
    await up.click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(scale.getByRole("status")).toHaveText("Feito");
    // A próxima sugestão já parte do novo orçamento
    await page.reload();
    await expect(list.getByRole("listitem").filter({ hasText: MOCK.campaign.name })).toContainText(`de ${target} para`);

    // Pausar o primeiro sugerido
    const first = list.getByRole("listitem").filter({ hasText: "Pausar anúncio" }).first();
    const name = (await first.locator("p").first().textContent())!.replace(/^Pausar anúncio: /, "");
    await first.getByRole("button", { name: "Pausar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    // Pausado, ele sai da lista assim que a tela se atualiza
    await expect(list.getByRole("listitem").filter({ hasText: `Pausar anúncio: ${name}` })).toHaveCount(0);
    await page.goto(`/campanhas?nivel=ad&q=${encodeURIComponent(name.slice(0, 20))}`);
    await expect(page.getByRole("switch", { name: `Ativar ${name}` })).toBeVisible();
  });

  test("HJ-2 menu enxuto, Conexões com abas, login cai em Hoje", async ({ page }) => {
    await register(page, "menu");
    const nav = page.getByRole("navigation", { name: "Principal" });
    await expect(nav.getByRole("link", { name: "Primeiros passos" })).toBeVisible();
    await connectMeta(page);
    await createWebhook(page);
    await page.goto("/hoje");
    await expect(nav.getByRole("link")).toHaveText(["Hoje", "Resumo", "Campanhas", "Vendas", "Custos", "Conexões"]);
    await nav.getByRole("link", { name: "Conexões" }).click();
    const tabs = page.getByRole("navigation", { name: "Conexões" });
    await tabs.getByRole("link", { name: "Contas de anúncio" }).click();
    await expect(page.getByRole("heading", { name: "Contas de anúncio" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Conexões" })).toHaveAttribute("aria-current", "page");
    await tabs.getByRole("link", { name: "UTMs" }).click();
    await expect(tabs.getByRole("link", { name: "UTMs" })).toHaveAttribute("aria-current", "page");
    await axe(page);
  });
});
