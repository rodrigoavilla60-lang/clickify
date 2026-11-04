import crypto from "node:crypto";
import type { Page } from "@playwright/test";
import { connectMeta, expect, MOCK, register, test } from "./helpers";

async function newHook(page: Page, platform: string, name: string, secret?: string) {
  await page.goto("/integracoes");
  await page.getByLabel("Plataforma").selectOption(platform);
  await page.getByLabel("Nome", { exact: true }).fill(name);
  if (secret) await page.getByLabel(/opcional/).fill(secret);
  await page.getByRole("button", { name: "Gerar URL" }).click();
  await expect(page).toHaveURL(/\/integracoes\/[0-9a-f-]{36}$/);
  return (await page.getByLabel("URL do webhook", { exact: true }).textContent())!.trim();
}

test.describe("Checkouts brasileiros", () => {
  test("CK-1 Kiwify: venda assinada entra atribuída, sem assinatura é recusada", async ({ page, request }) => {
    await register(page, "kiwify");
    await connectMeta(page);
    const url = await newHook(page, "kiwify", "Kiwify loja", "seg-kiwi");
    await expect(page.getByText("Kiwify · beta")).toBeVisible();

    const body = JSON.stringify({
      order_id: "KW-1", order_status: "paid", webhook_event_type: "order_approved", payment_method: "pix",
      created_at: "2026-11-01 10:00", approved_date: "2026-11-01 10:01",
      Product: { product_name: "Kit Kiwify" }, Customer: { email: "c@d.com" },
      Commissions: { charge_amount: 14790, currency: "BRL" },
      TrackingParameters: {
        utm_source: "FB", utm_campaign: `${MOCK.campaign.name}|${MOCK.campaign.id}`,
        utm_medium: `${MOCK.adset.name}|${MOCK.adset.id}`, utm_content: `${MOCK.ad.name}|${MOCK.ad.id}`,
      },
    });
    const sig = crypto.createHmac("sha1", "seg-kiwi").update(body).digest("hex");
    const send = (s: string) => request.post(`${url}?signature=${s}`, { data: Buffer.from(body), headers: { "content-type": "application/json" } });

    expect((await send("0".repeat(40))).status()).toBe(401);
    const ok = await send(sig);
    expect(await ok.json()).toMatchObject({ ok: true, result: "created" });

    await page.goto("/vendas?p=30d");
    const row = page.getByRole("row", { name: /KW-1/ });
    await expect(row).toContainText("Kiwify");
    await expect(row).toContainText("R$ 147,90");
    await expect(row).toContainText(MOCK.campaign.name);
  });

  test("CK-2 modo capturar guarda o evento e mostra o conteúdo", async ({ page, request }) => {
    await register(page, "capture");
    const url = await newHook(page, "capture", "Cartpanda teste");
    const r = await request.post(url, { data: { pedido: { numero: "CP-77", total: "99.90" } } });
    expect(await r.json()).toMatchObject({ ok: true, result: "captured" });

    await page.reload();
    await expect(page.getByText("Capturado")).toBeVisible();
    await page.getByText("Ver o que chegou").click();
    await expect(page.getByLabel("Conteúdo do evento")).toContainText("CP-77");

    await page.goto("/vendas");
    await expect(page.getByText("Nenhuma venda recebida ainda")).toBeVisible();
  });

  test("CK-3 Hotmart mostra o texto de parâmetros próprio", async ({ page }) => {
    await register(page, "hotmart");
    await newHook(page, "hotmart", "Hotmart curso", "hottok-x");
    await expect(page.getByLabel("Parâmetros de URL para anúncios que vendem pela Hotmart", { exact: true })).toContainText("sck={{campaign.id}}");
  });
});
