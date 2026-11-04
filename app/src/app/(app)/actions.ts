"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { decrypt, encrypt, randomToken, sha256 } from "@/lib/crypto";
import { meta } from "@/lib/meta";
import { syncWorkspace } from "@/lib/sync";
import { upsertOrder } from "@/lib/orders";
import { isPlatform } from "@/lib/platforms";
import { validPixelId } from "@/lib/capi";
import { checkPixel, retryFailed, sendTestEvent } from "@/lib/pixels";

// Toda action começa com requireWorkspace(): o workspace sai da sessão, e cada query filtra por ele.

async function tokenFor(workspaceId: string, objectExternalId: string) {
  return one<{ id: string; access_token_enc: string | null }>(
    `select o.id, a.access_token_enc from ad_objects o join ad_accounts a on a.id = o.ad_account_id
     where o.workspace_id = $1 and o.external_id = $2`,
    [workspaceId, objectExternalId],
  );
}

export async function setObjectStatus(externalId: string, status: "ACTIVE" | "PAUSED"): Promise<{ error?: string }> {
  const { ws } = await requireWorkspace();
  const row = await tokenFor(ws.id, externalId);
  if (!row?.access_token_enc) return { error: "Conta desconectada. Reconecte em Contas." };
  try {
    await meta().setStatus(decrypt(row.access_token_enc), externalId, status);
  } catch (e) {
    return { error: `O Meta recusou: ${(e as Error).message}` };
  }
  await query("update ad_objects set status = $2, updated_at = now() where id = $1", [row.id, status]);
  revalidatePath("/campanhas");
  revalidatePath("/hoje");
  return {};
}

export async function setObjectBudget(externalId: string, cents: number): Promise<{ error?: string }> {
  const { ws } = await requireWorkspace();
  if (!Number.isInteger(cents) || cents < 100) return { error: "Valor inválido." };
  const row = await tokenFor(ws.id, externalId);
  if (!row?.access_token_enc) return { error: "Conta desconectada. Reconecte em Contas." };
  try {
    await meta().setDailyBudget(decrypt(row.access_token_enc), externalId, cents);
  } catch (e) {
    return { error: `O Meta recusou: ${(e as Error).message}` };
  }
  await query("update ad_objects set daily_budget_cents = $2, updated_at = now() where id = $1", [row.id, cents]);
  revalidatePath("/campanhas");
  revalidatePath("/hoje");
  return {};
}

export async function syncNow() {
  const { ws } = await requireWorkspace();
  const r = await syncWorkspace(ws.id);
  revalidatePath("/", "layout");
  if (r.errors.length) redirect(`/contas?erro=${encodeURIComponent(r.errors[0])}`);
}

export async function toggleAdAccount(form: FormData) {
  const { ws } = await requireWorkspace();
  const id = String(form.get("id"));
  const enabled = form.get("enabled") === "true";
  await query("update ad_accounts set enabled = $3, updated_at = now() where id = $1 and workspace_id = $2", [id, ws.id, enabled]);
  if (enabled) await syncWorkspace(ws.id, 30);
  revalidatePath("/", "layout");
}

export interface WebhookState { error?: string }

export async function createWebhook(_: WebhookState, form: FormData): Promise<WebhookState> {
  const { ws } = await requireWorkspace();
  const name = String(form.get("name") ?? "").trim();
  const platform = String(form.get("platform") ?? "");
  const secret = String(form.get("secret") ?? "").trim() || null;
  if (name.length < 2 || name.length > 60) return { error: "Dê um nome de 2 a 60 caracteres (ex.: Loja Shopify)." };
  if (!isPlatform(platform)) return { error: "Escolha a plataforma." };
  const [hook] = await query<{ id: string }>(
    "insert into webhooks (workspace_id, platform, name, token, signing_secret) values ($1,$2,$3,$4,$5) returning id",
    [ws.id, platform, name, randomToken(24), secret],
  );
  redirect(`/integracoes/${hook.id}`);
}

export async function deleteWebhook(form: FormData) {
  const { ws } = await requireWorkspace();
  await query("delete from webhooks where id = $1 and workspace_id = $2", [String(form.get("id")), ws.id]);
  redirect("/integracoes");
}

// Simula uma venda vinda do checkout, com UTMs de um anúncio real da conta. Serve para testar o loop.
export async function sendTestOrder(form: FormData) {
  const { ws } = await requireWorkspace();
  const hookId = String(form.get("id"));
  const hook = await one<{ id: string }>("select id from webhooks where id = $1 and workspace_id = $2", [hookId, ws.id]);
  if (!hook) return;
  const ad = await one<{ ad: string; ad_name: string; adset: string; adset_name: string; campaign: string; campaign_name: string }>(
    `select a.external_id as ad, a.name as ad_name, s.external_id as adset, s.name as adset_name,
            c.external_id as campaign, c.name as campaign_name
     from ad_objects a
     join ad_objects s on s.ad_account_id = a.ad_account_id and s.level = 'adset' and s.external_id = a.parent_external_id
     join ad_objects c on c.ad_account_id = a.ad_account_id and c.level = 'campaign' and c.external_id = a.campaign_external_id
     where a.workspace_id = $1 and a.level = 'ad' and a.status = 'ACTIVE' order by random() limit 1`,
    [ws.id],
  );
  const amount = [9790, 14790, 19790, 24790][Math.floor(Math.random() * 4)];
  await upsertOrder(ws.id, hook.id, "generic", {
    externalId: `teste-${randomToken(6)}`,
    status: "approved",
    amountCents: amount,
    currency: "BRL",
    productName: "Pedido de teste",
    email: null,
    orderedAt: new Date(),
    approvedAt: new Date(),
    utm_source: ad ? "FB" : null,
    utm_campaign: ad ? `${ad.campaign_name}|${ad.campaign}` : null,
    utm_medium: ad ? `${ad.adset_name}|${ad.adset}` : null,
    utm_content: ad ? `${ad.ad_name}|${ad.ad}` : null,
    utm_term: ad ? "Instagram_Feed" : null,
  }, false);
  await query("update webhooks set last_event_at = now() where id = $1", [hook.id]);
  revalidatePath("/", "layout");
  redirect(`/integracoes/${hook.id}?teste=1`);
}

export async function markUtmsCopied() {
  const { ws } = await requireWorkspace();
  await query("update workspaces set onboarding_utms_copied = true where id = $1", [ws.id]);
  revalidatePath("/onboarding");
}

export interface SettingsState { error?: string; ok?: boolean }

export async function updateSettings(_: SettingsState, form: FormData): Promise<SettingsState> {
  const { ws } = await requireWorkspace();
  const name = String(form.get("name") ?? "").trim();
  const tz = String(form.get("timezone") ?? "");
  if (name.length < 2 || name.length > 60) return { error: "O nome precisa ter de 2 a 60 caracteres." };
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: tz });
  } catch {
    return { error: "Fuso horário inválido." };
  }
  await query("update workspaces set name = $2, timezone = $3, updated_at = now() where id = $1", [ws.id, name, tz]);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------- Custos ----------------

// "6", "6,5", "12.15" -> pontos-base; "" -> 0. NaN ou fora de 0–100% -> null.
function percentBps(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return 0;
  const n = Math.round(Number(s) * 100);
  return Number.isFinite(n) && n >= 0 && n <= 10000 ? n : null;
}

// "1.234,56", "39,90", "40" -> centavos; "" -> 0. Inválido ou negativo -> null.
function moneyCents(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim().replace(/[R$\s]/g, "");
  if (!s) return 0;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Math.round(Number(normalized) * 100);
  return Number.isFinite(n) && n >= 0 && n < 1e11 ? n : null;
}

export interface CostState { error?: string; ok?: string }

export async function updateCostRates(_: CostState, form: FormData): Promise<CostState> {
  const { ws } = await requireWorkspace();
  const sale = percentBps(form.get("saleTax"));
  const fee = percentBps(form.get("gatewayFee"));
  const ad = percentBps(form.get("adTax"));
  const cost = moneyCents(form.get("defaultCost"));
  const ship = moneyCents(form.get("defaultShipping"));
  if (sale === null || fee === null || ad === null) return { error: "Os percentuais precisam estar entre 0 e 100." };
  if (cost === null || ship === null) return { error: "Valores em reais inválidos." };
  await query(
    `update workspaces set tax_rate_bps = $2, gateway_fee_bps = $3, ad_tax_bps = $4,
       default_product_cost_cents = $5, default_shipping_cents = $6, updated_at = now() where id = $1`,
    [ws.id, sale, fee, ad, cost, ship],
  );
  revalidatePath("/", "layout");
  return { ok: "Salvo. O lucro já usa os novos valores." };
}

export async function saveProductCosts(_: CostState, form: FormData): Promise<CostState> {
  const { ws } = await requireWorkspace();
  const names = form.getAll("product").map(String);
  const costs = form.getAll("cost");
  const ships = form.getAll("shipping");
  for (let i = 0; i < names.length; i++) {
    const name = names[i].trim();
    const cost = moneyCents(costs[i]);
    const ship = moneyCents(ships[i]);
    if (!name || name.length > 300) continue;
    if (cost === null || ship === null) return { error: `Valor inválido em "${name}".` };
    await query(
      `insert into product_costs (workspace_id, product_name, cost_cents, shipping_cents) values ($1,$2,$3,$4)
       on conflict (workspace_id, lower(product_name)) do update set
         cost_cents = excluded.cost_cents, shipping_cents = excluded.shipping_cents, updated_at = now()`,
      [ws.id, name, cost, ship],
    );
  }
  revalidatePath("/", "layout");
  return { ok: "Custos dos produtos salvos." };
}

export async function addFixedExpense(_: CostState, form: FormData): Promise<CostState> {
  const { ws } = await requireWorkspace();
  const name = String(form.get("name") ?? "").trim();
  const amount = moneyCents(form.get("monthly"));
  if (name.length < 2 || name.length > 60) return { error: "Dê um nome de 2 a 60 caracteres (ex.: Shopify, equipe, ferramentas)." };
  if (!amount) return { error: "Informe o valor mensal em reais." };
  await query("insert into fixed_expenses (workspace_id, name, monthly_cents) values ($1,$2,$3)", [ws.id, name, amount]);
  revalidatePath("/", "layout");
  return { ok: `"${name}" adicionada.` };
}

export async function removeFixedExpense(form: FormData) {
  const { ws } = await requireWorkspace();
  await query("delete from fixed_expenses where id = $1 and workspace_id = $2", [String(form.get("id")), ws.id]);
  revalidatePath("/", "layout");
}

// ---------------- Pixel pelo servidor ----------------
// values volta o que foi digitado (menos o token) para o formulário não apagar tudo num erro.
export interface PixelState { error?: string; ok?: string; values?: Record<string, string> }

export async function addPixel(_: PixelState, form: FormData): Promise<PixelState> {
  const { ws } = await requireWorkspace();
  const name = String(form.get("name") ?? "").trim();
  const pixelId = String(form.get("pixel_id") ?? "").replace(/\s/g, "");
  const token = String(form.get("token") ?? "").trim();
  const testCode = String(form.get("test_code") ?? "").trim() || null;
  const hookId = String(form.get("webhook") ?? "") || null;
  const values = { name, pixel_id: pixelId, test_code: testCode ?? "", webhook: hookId ?? "" };
  const fail = (error: string): PixelState => ({ error, values });
  if (name.length < 2 || name.length > 60) return fail("Dê um nome de 2 a 60 caracteres (ex.: Pixel da loja).");
  if (!validPixelId(pixelId)) return fail("O ID do pixel tem só números, de 10 a 20 dígitos. Ele aparece no Gerenciador de Eventos.");
  if (token.length < 30 || /\s/.test(token)) return fail("Cole o token de acesso inteiro, gerado em Configurações do pixel > API de Conversões.");
  if (testCode && !/^[A-Za-z0-9]{3,20}$/.test(testCode)) return fail("O código de teste tem letras e números (ex.: TEST12345).");
  if (hookId && !(await one("select 1 from webhooks where id = $1 and workspace_id = $2", [hookId, ws.id])))
    return fail("Escolha um checkout da lista.");
  const problem = await checkPixel(pixelId, token);
  if (problem) return fail(`O Meta não aceitou o ID ou o token: ${problem}`);
  const dup = await one(
    "select 1 from pixels where workspace_id = $1 and pixel_id = $2 and webhook_id is not distinct from $3",
    [ws.id, pixelId, hookId],
  );
  if (dup) return fail("Esse pixel já está cadastrado para esse checkout.");
  await query(
    `insert into pixels (workspace_id, name, pixel_id, access_token_enc, test_event_code, webhook_id)
     values ($1, $2, $3, $4, $5, $6)`,
    [ws.id, name, pixelId, encrypt(token), testCode, hookId],
  );
  revalidatePath("/pixel");
  return { ok: "Pixel salvo. A partir de agora, cada venda aprovada vai para o Meta pelo servidor." };
}

export async function removePixel(form: FormData) {
  const { ws } = await requireWorkspace();
  await query("delete from pixels where id = $1 and workspace_id = $2", [String(form.get("id")), ws.id]);
  revalidatePath("/pixel");
}

export async function togglePixel(form: FormData) {
  const { ws } = await requireWorkspace();
  await query("update pixels set enabled = $3 where id = $1 and workspace_id = $2",
    [String(form.get("id")), ws.id, form.get("enabled") === "true"]);
  revalidatePath("/pixel");
}

export async function testPixel(_: PixelState, form: FormData): Promise<PixelState> {
  const { user, ws } = await requireWorkspace();
  const r = await sendTestEvent(ws.id, String(form.get("id")), sha256(user.email.toLowerCase()));
  revalidatePath("/pixel");
  return r.ok ? { ok: r.message } : { error: r.message };
}

export async function retryPixel() {
  const { ws } = await requireWorkspace();
  await retryFailed(ws.id);
  revalidatePath("/pixel");
}