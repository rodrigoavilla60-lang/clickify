import "server-only";
import { after } from "next/server";
import { one, query } from "./db";
import { sha256 } from "./crypto";
import { matchData } from "./capi";
import { sendPurchase } from "./pixels";
import {
  attribute, canTransition, normalizeGeneric, normalizeShopify, type NormalizedOrder, type OrderStatus,
} from "./normalize";
import { findClickAttribution } from "./track";
import {
  normalizeEduzz, normalizeHotmart, normalizeKiwify, normalizeYampi, signatureOk, type CheckoutPlatform,
} from "./checkouts";

interface WebhookRow {
  id: string;
  workspace_id: string;
  platform: CheckoutPlatform;
  signing_secret: string | null;
}

// Id do evento quando a plataforma manda um; senão o hash do corpo faz o papel.
function dedupeKey(platform: CheckoutPlatform, payload: Record<string, unknown>, raw: string, headers: Headers) {
  const fromHeader = headers.get("x-shopify-webhook-id") ?? headers.get("x-event-id");
  if (fromHeader) return fromHeader;
  if ((platform === "hotmart" || platform === "eduzz") && typeof payload.id === "string" && payload.id) return `${platform}:${payload.id}`;
  return sha256(raw);
}

export const MAX_BODY = 256 * 1024;

// sendPixel = false nos pedidos de teste do botão "Enviar pedido de teste": não são vendas de verdade.
export async function upsertOrder(workspaceId: string, webhookId: string | null, platform: string, o: NormalizedOrder, sendPixel = true) {
  const current = await one<{ id: string; status: OrderStatus }>(
    "select id, status from orders where workspace_id = $1 and platform = $2 and external_id = $3",
    [workspaceId, platform, o.externalId],
  );
  const a = attribute(o);
  // Se o pedido trouxe o ck_vid do script de tracking, o clique persistido (janela de 30 dias)
  // tem prioridade: foi capturado no momento do clique, imune ao checkout perder os parâmetros.
  const click = o.trackingVisitorKey
    ? await findClickAttribution(workspaceId, o.trackingVisitorKey).catch(() => null)
    : null;
  const attr = {
    campaign: click?.attr.campaign ?? a.campaign,
    adset: click?.attr.adset ?? a.adset,
    ad: click?.attr.ad ?? a.ad,
  };
  const u = {
    utm_source: o.utm_source ?? click?.utms.utm_source ?? null,
    utm_medium: o.utm_medium ?? click?.utms.utm_medium ?? null,
    utm_campaign: o.utm_campaign ?? click?.utms.utm_campaign ?? null,
    utm_content: o.utm_content ?? click?.utms.utm_content ?? null,
    utm_term: o.utm_term ?? click?.utms.utm_term ?? null,
  };
  const emailHash = o.email ? sha256(o.email.toLowerCase()) : null;
  // Dados para o pixel pelo servidor, já com hash. Nunca o e-mail, telefone ou nome em claro.
  const match = JSON.stringify(matchData(emailHash, o.buyer, o.orderedAt));

  if (!current) {
    const [row] = await query<{ id: string }>(
      `insert into orders (workspace_id, webhook_id, platform, external_id, status, amount_cents, currency,
         product_name, customer_email_hash, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
         campaign_external_id, adset_external_id, ad_external_id, ordered_at, approved_at, payment_method, capi_match)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb) returning id`,
      [workspaceId, webhookId, platform, o.externalId, o.status, o.amountCents, o.currency, o.productName,
        emailHash, u.utm_source, u.utm_medium, u.utm_campaign, u.utm_content, u.utm_term,
        attr.campaign, attr.adset, attr.ad, o.orderedAt, o.approvedAt, o.paymentMethod ?? null, match],
    );
    if (o.status === "approved" && sendPixel) queuePurchase(row.id);
    return "created" as const;
  }
  if (!canTransition(current.status, o.status)) return "ignored" as const;
  // Atualiza status e completa o que faltava (UTMs podem chegar só num evento posterior).
  await query(
    `update orders set status = $2, amount_cents = greatest(amount_cents, $3),
       approved_at = coalesce(approved_at, $4),
       status_changed_at = case when status <> $2 then now() else status_changed_at end,
       utm_source = coalesce(utm_source, $5), utm_medium = coalesce(utm_medium, $6),
       utm_campaign = coalesce(utm_campaign, $7), utm_content = coalesce(utm_content, $8),
       utm_term = coalesce(utm_term, $9),
       campaign_external_id = coalesce(campaign_external_id, $10),
       adset_external_id = coalesce(adset_external_id, $11), ad_external_id = coalesce(ad_external_id, $12),
       product_name = coalesce(product_name, $13), payment_method = coalesce(payment_method, $14),
       capi_match = coalesce(capi_match, '{}'::jsonb) || $15::jsonb, updated_at = now()
     where id = $1`,
    [current.id, o.status, o.amountCents, o.approvedAt, u.utm_source, u.utm_medium, u.utm_campaign,
      u.utm_content, u.utm_term, attr.campaign, attr.adset, attr.ad, o.productName, o.paymentMethod ?? null, match],
  );
  if (o.status === "approved" && sendPixel) queuePurchase(current.id);
  return "updated" as const;
}

// Envia para o pixel depois de responder ao checkout: o Meta lento não pode atrasar o webhook.
// Fora de uma requisição (scripts, testes), envia na hora.
function queuePurchase(orderId: string) {
  const run = () => sendPurchase(orderId).catch((e) => console.error("pixel:", (e as Error).message));
  try {
    after(run);
  } catch {
    void run();
  }
}

export type WebhookResult = { status: number; body: Record<string, unknown> };

// Fluxo: acha o webhook pelo token, confere assinatura, guarda o evento (dedupe), normaliza, faz upsert.
export async function handleWebhook(token: string, raw: string, headers: Headers, url: URL): Promise<WebhookResult> {
  const hook = await one<WebhookRow>(
    "select id, workspace_id, platform, signing_secret from webhooks where token = $1",
    [token],
  );
  if (!hook) return { status: 404, body: { error: "webhook não encontrado" } };
  if (raw.length > MAX_BODY) return { status: 413, body: { error: "corpo grande demais" } };

  if (!signatureOk(hook.platform, hook.signing_secret, raw, headers, url))
    return { status: 401, body: { error: "assinatura inválida" } };

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { status: 400, body: { error: "JSON inválido" } };
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload))
    return { status: 400, body: { error: "o corpo precisa ser um objeto JSON" } };

  const dedupe = dedupeKey(hook.platform, payload, raw, headers);
  const inserted = await query<{ id: string }>(
    `insert into webhook_events (workspace_id, webhook_id, dedupe_key, payload) values ($1,$2,$3,$4::jsonb)
     on conflict (webhook_id, dedupe_key) do nothing returning id`,
    [hook.workspace_id, hook.id, dedupe, JSON.stringify(payload)],
  );
  await query("update webhooks set last_event_at = now() where id = $1", [hook.id]);
  if (!inserted.length) return { status: 200, body: { ok: true, duplicate: true } };
  const eventId = inserted[0].id;

  try {
    let result: string;
    if (hook.platform === "shopify") {
      const n = normalizeShopify(headers.get("x-shopify-topic") ?? "orders/updated", payload);
      if ("refundOf" in n) {
        const r = await query<{ id: string }>(
          `update orders set status = 'refunded', status_changed_at = now(), updated_at = now()
           where workspace_id = $1 and platform = 'shopify' and external_id = $2 and status in ('approved','pending')
           returning id`,
          [hook.workspace_id, n.refundOf],
        );
        result = r.length ? "updated" : "ignored";
      } else result = await upsertOrder(hook.workspace_id, hook.id, "shopify", n);
    } else if (hook.platform === "capture") {
      // Só guarda o evento cru, para escrever o adaptador a partir do formato real.
      result = "captured";
    } else {
      const normalizers = {
        generic: normalizeGeneric, kiwify: normalizeKiwify, hotmart: normalizeHotmart,
        yampi: normalizeYampi, eduzz: normalizeEduzz,
      } as const;
      const n = normalizers[hook.platform](payload);
      // null = evento que não é pedido (carrinho abandonado, produto, cliente...).
      result = n ? await upsertOrder(hook.workspace_id, hook.id, hook.platform, n) : "ignored";
    }
    await query("update webhook_events set processed_at = now() where id = $1", [eventId]);
    return { status: 200, body: { ok: true, result } };
  } catch (e) {
    const msg = (e as Error).message;
    await query("update webhook_events set error = $2 where id = $1", [eventId, msg]);
    // 200 mesmo com erro de conteúdo: o evento está guardado e reenviar não muda nada.
    return { status: 200, body: { ok: false, error: msg } };
  }
}
