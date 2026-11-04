import { axe, connectMeta, createWebhook, expect, order, register, test } from "./helpers";

test.describe("Pixel pelo servidor (API de Conversões)", () => {
  test("PX-1 cada venda aprovada vai uma vez, com o que o checkout mandou", async ({ page, request }) => {
    await register(page, "pixel");
    await connectMeta(page);
    const url = await createWebhook(page);

    await page.goto("/pixel");
    await expect(page.getByRole("heading", { name: "Pixel pelo servidor" })).toBeVisible();
    await expect(page.getByText("Nenhum pixel ligado ainda")).toBeVisible();

    // Validação: ID com letra e token curto
    await page.getByLabel("Nome", { exact: true }).fill("Pixel da loja");
    await page.getByLabel("ID do pixel").fill("12345abc");
    await page.getByLabel("Token de acesso da API de Conversões").fill("curto");
    await page.getByRole("button", { name: "Salvar pixel" }).click();
    await expect(page.getByText(/O ID do pixel tem só números/)).toBeVisible();

    await page.getByLabel("ID do pixel").fill("123456789012345");
    await page.getByLabel("Token de acesso da API de Conversões").fill("EAAG" + "x".repeat(60));
    await page.getByRole("button", { name: "Salvar pixel" }).click();
    await expect(page.getByText(/Pixel salvo/)).toBeVisible();
    await expect(page.getByText("ID 123456789012345 · vendas de todos os checkouts")).toBeVisible();
    // O token não volta para a tela
    await expect(page.locator("body")).not.toContainText("xxxxxxxxxx");

    // Venda com e-mail e telefone: vai, e mostra o que foi junto
    const withData = order("PX-1", { email: "Cliente@Exemplo.com", customer: { phone: "(11) 98765-4321", name: "Ana Souza" }, ip: "200.1.2.3" });
    await request.post(url, { data: withData });
    await request.post(url, { data: withData }); // webhook repetido
    // Pendente não vai
    await request.post(url, { data: order("PX-2", { status: "pending", email: "b@b.com" }) });
    // Aprovada sem nenhum dado do comprador: registrada como não enviada, com o motivo
    await request.post(url, { data: { id: "PX-3", status: "approved", amount: 50 } });

    const rows = page.getByRole("row");
    await expect(async () => {
      await page.reload();
      await expect(rows.filter({ hasText: "PX-1" })).toHaveCount(1);
      await expect(rows.filter({ hasText: "PX-3" })).toHaveCount(1);
    }).toPass({ timeout: 20_000 });
    const sent = rows.filter({ hasText: "PX-1" });
    await expect(sent).toContainText("Enviado");
    await expect(sent).toContainText("e-mail, telefone, nome, sobrenome, país, IP");
    await expect(rows.filter({ hasText: "PX-2" })).toHaveCount(0);
    await expect(rows.filter({ hasText: "PX-3" })).toContainText("Não enviado");
    await expect(rows.filter({ hasText: "PX-3" })).toContainText("o Meta não teria como reconhecer o comprador");

    // Teste sem código de teste: explica em vez de mandar uma venda falsa
    await page.getByRole("button", { name: "Enviar evento de teste" }).click();
    await expect(page.getByText(/Cadastre o código de teste/).first()).toBeVisible();
    await axe(page);

    // Desligado, não envia
    await page.getByRole("button", { name: "Desligar" }).click();
    await expect(page.getByText("(desligado)")).toBeVisible();
    await request.post(url, { data: order("PX-4", { email: "c@c.com" }) });
    await page.waitForTimeout(1500);
    await page.reload();
    await expect(rows.filter({ hasText: "PX-4" })).toHaveCount(0);

    // Menu: Pixel fica dentro de Conexões
    await expect(page.getByRole("navigation", { name: "Conexões" }).getByRole("link", { name: "Pixel" })).toHaveAttribute("aria-current", "page");
  });
});
