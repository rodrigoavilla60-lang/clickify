import { axe, createWebhook, expect, register, test } from "./helpers";

test.describe("Barra de cima", () => {
  test("TOP-1 conquistas de faturamento e menu da conta", async ({ page, request }) => {
    const email = await register(page, "topo");
    const conquistas = page.getByLabel(/^Conquistas\./);
    await expect(conquistas).toContainText("R$ 0 / R$ 10 mil");

    const url = await createWebhook(page);
    await request.post(url, { data: { id: "T-1", status: "approved", amount: 8000, email: "a@a.com" } });
    await request.post(url, { data: { id: "T-2", status: "approved", amount: 4000, email: "b@b.com" } });
    await request.post(url, { data: { id: "T-3", status: "pending", amount: 90000 } }); // pendente não conta

    await page.goto("/hoje");
    await expect(conquistas).toContainText("R$ 12 mil / R$ 50 mil");
    await conquistas.click();
    const lista = page.getByRole("list").filter({ hasText: "R$ 10 mil" });
    await expect(lista.getByRole("listitem").filter({ hasText: "R$ 10 mil" })).toContainText("batida em");
    await expect(lista.getByRole("listitem").filter({ hasText: "R$ 50 mil" })).toContainText("5%"); // de R$ 10 mil a R$ 50 mil, R$ 12 mil = 5% do caminho
    await expect(page.getByText(/Faltam R\$\s38\.000,00 para R\$ 50 mil/)).toBeVisible();
    await axe(page);
    await page.keyboard.press("Escape");
    await expect(page.getByText(/Faltam R\$/)).toBeHidden();

    // Menu da conta: nome, e-mail e o caminho para Configurações
    await page.getByLabel(/^Menu da conta/).click();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText("Dono da conta").first()).toBeVisible();
    await page.getByRole("link", { name: "Configurações" }).click();
    await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();
    // Navegou: o menu fecha sozinho
    await expect(page.locator("details[open]").filter({ hasText: email })).toHaveCount(0);
  });
});
