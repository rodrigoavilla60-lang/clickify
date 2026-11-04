import { connectMeta, expect, MOCK, register, test } from "./helpers";

test.describe("F02 otimizar campanhas pela tabela", () => {
  test("F02-H1 pausar e reativar persiste depois de recarregar e sincronizar", async ({ page }) => {
    await register(page, "f02");
    await connectMeta(page);
    await page.goto("/campanhas");
    const toggle = page.getByRole("switch", { name: `Pausar ${MOCK.campaign.name}` });

    // Um clique só pergunta; nada muda até confirmar.
    await toggle.click();
    await expect(page.getByText(`Pausar "${MOCK.campaign.name}" no Meta?`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar" })).toBeFocused();
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await page.reload();
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    // Esc também cancela.
    await toggle.click();
    await page.keyboard.press("Escape");
    await expect(page.getByText(`Pausar "${MOCK.campaign.name}" no Meta?`)).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await toggle.click();
    await page.getByRole("button", { name: "Confirmar" }).click();
    const paused = page.getByRole("switch", { name: `Ativar ${MOCK.campaign.name}` });
    await expect(paused).toHaveAttribute("aria-checked", "false");

    await page.getByRole("button", { name: "Atualizar" }).click(); // sync com o "Meta"
    await page.reload();
    await expect(paused).toHaveAttribute("aria-checked", "false");

    await paused.click();
    await expect(page.getByText(`Ativar "${MOCK.campaign.name}" no Meta?`)).toBeVisible();
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByRole("switch", { name: `Pausar ${MOCK.campaign.name}` })).toHaveAttribute("aria-checked", "true");
  });

  test("F02-H2 editar orçamento diário", async ({ page }) => {
    await register(page, "f02b");
    await connectMeta(page);
    await page.goto("/campanhas");
    await page.getByRole("button", { name: /Editar orçamento diário, atual R\$\s150,00/ }).click();
    const input = page.getByLabel("Novo orçamento diário em reais");
    await input.fill("0,50");
    await page.getByRole("button", { name: "OK" }).click();
    await expect(page.getByText("Mínimo R$ 1,00", { exact: true })).toBeVisible();
    await input.fill("200");
    await page.getByRole("button", { name: "OK" }).click();
    await expect(page.getByRole("button", { name: /Editar orçamento diário, atual R\$\s200,00/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: /Editar orçamento diário, atual R\$\s200,00/ })).toBeVisible();

    // volta ao valor original para não afetar outros testes que usam o mesmo mock
    await page.getByRole("button", { name: /Editar orçamento diário/ }).first().click();
    await page.getByLabel("Novo orçamento diário em reais").fill("150");
    await page.getByRole("button", { name: "OK" }).click();
    await expect(page.getByRole("button", { name: /atual R\$\s150,00/ })).toBeVisible();
  });

  test("F02-H4 busca, status e escolha de colunas", async ({ page }) => {
    await register(page, "f02d");
    await connectMeta(page);
    await page.goto("/campanhas?p=7d");

    await page.getByLabel("Buscar pelo nome").fill("Escala");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByRole("link", { name: "[ADV+] Escala Nacional" })).toBeVisible();
    await expect(page.getByRole("link", { name: MOCK.campaign.name })).toHaveCount(0);

    await page.getByLabel("Buscar pelo nome").fill("nada-com-esse-nome");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByText("Nada com essa busca")).toBeVisible();

    await page.goto("/campanhas?p=7d&status=PAUSED");
    await expect(page.getByText("Nada com essa busca")).toBeVisible(); // no mock nada começa pausado

    // Colunas: liga CTR e CPM, desliga ROAS
    await page.goto("/campanhas?p=7d");
    await page.getByText("Colunas").click();
    const picker = page.getByRole("form", { name: "Escolher colunas" });
    await picker.getByRole("checkbox", { name: /^CTR/ }).check();
    await picker.getByRole("checkbox", { name: /^CPM/ }).check();
    await picker.getByRole("checkbox", { name: /^ROAS/ }).uncheck();
    await picker.getByRole("button", { name: "Aplicar" }).click();
    await expect(page.getByRole("columnheader", { name: "CTR" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "CPM" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "ROAS" })).toHaveCount(0);

    // A escolha de colunas sobrevive à ordenação e à troca de nível
    await page.getByRole("link", { name: "CTR" }).click();
    await expect(page.getByRole("columnheader", { name: /CTR/ })).toHaveAttribute("aria-sort", "descending");
    await page.getByRole("link", { name: "Anúncios" }).click();
    await expect(page.getByRole("columnheader", { name: /CPM/ })).toBeVisible();
  });

  test("F02-H3 drill-down campanha > conjunto > anúncio e ordenação", async ({ page }) => {
    await register(page, "f02c");
    await connectMeta(page);
    await page.goto("/campanhas");
    await page.getByRole("link", { name: MOCK.campaign.name }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(MOCK.campaign.name);
    await page.getByRole("link", { name: MOCK.adset.name }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(MOCK.adset.name);
    await expect(page.getByText(MOCK.ad.name)).toBeVisible();

    await page.goto("/campanhas");
    await page.getByRole("link", { name: "Gasto" }).click();
    await expect(page.getByRole("columnheader", { name: /Gasto/ })).toHaveAttribute("aria-sort", "descending");
  });
});
