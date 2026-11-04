import "server-only";
import { one, query } from "./db";
import { decrypt } from "./crypto";
import { GRAPH, meta } from "./meta";
import { hasStrongMatch, matchFields, purchaseEvent, tooOld, type CapiEvent, type MatchData } from "./capi";

// Envio do pixel pelo servidor. Cada compra aprovada vira um evento "Purchase" para cada pixel
// ligado ao checkout dela. capi_events registra cada envio (e impede mandar a mesma compra duas vezes).

interface PixelRow {
  id: string;
  pixel_id: string;
  access_token_enc: string;
  test_event_code: string | null;
}

interface OrderRow {
  id: string;
  workspace_id: string;
  webhook_id: string | null;
  external_id: string;
  amount_cents: string;
  currency: string;
  product_name: string | null;
  approved_at: Date;
  capi_match: MatchData | null;
}

export const MAX_ATTEMPTS = 5;

type PostResult = { ok: boolean; response: string };

// Em modo de teste (META_MODE diferente de live) nada sai daqui: o evento é registrado como
// enviado, com a resposta marcada como simulada.
async function post(pixel: PixelRow, events: CapiEvent[], testCode?: string | null): Promise<PostResult> {
  if (meta().mode === "mock") return { ok: true, response: JSON.stringify({ events_received: events.length, simulado: true }) };
  try {
    const res = await fetch(`${GRAPH}/${pixel.pixel_id}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        data: events,
        ...(testCode ? { test_event_code: testCode } : {}),
        access_token: decrypt(pixel.access_token_enc),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, response: body?.error?.error_user_msg ?? body?.error?.message ?? `Meta respondeu ${res.status}` };
    return { ok: true, response: JSON.stringify({ events_received: body.events_received, fbtrace_id: body.fbtrace_id }) };
  } catch (e) {
    return { ok: false, response: `Sem resposta do Meta: ${(e as Error).message}` };
  }
}

async function sendOne(pixel: PixelRow, o: OrderRow, eventRowId: string) {
  const m = o.capi_match ?? {};
  const fields = matchFields(m);
  if (tooOld(new Date(o.approved_at))) {
    await query("update capi_events set status = 'skipped', response = $2, fields = $3 where id = $1",
      [eventRowId, "Compra com mais de 7 dias: o Meta não aceita mais.", fields]);
    return;
  }
  if (!hasStrongMatch(m)) {
    await query("update capi_events set status = 'skipped', response = $2, fields = $3 where id = $1",
      [eventRowId, "O checkout não mandou e-mail, telefone nem clique do anúncio: o Meta não teria como reconhecer o comprador.", fields]);
    return;
  }
  const event = purchaseEvent({
    externalId: o.external_id, amountCents: Number(o.amount_cents), currency: o.currency,
    productName: o.product_name, approvedAt: new Date(o.approved_at),
  }, m);
  const r = await post(pixel, [event], pixel.test_event_code);
  await query(
    `update capi_events set status = $2, response = $3, fields = $4, attempts = attempts + 1,
       sent_at = case when $2 = 'sent' then now() else sent_at end where id = $1`,
    [eventRowId, r.ok ? "sent" : "failed", r.response, fields],
  );
  await query("update pixels set last_event_at = now(), last_error = $2 where id = $1", [pixel.id, r.ok ? null : r.response]);
}

const ORDER_COLS = "o.id, o.workspace_id, o.webhook_id, o.external_id, o.amount_cents, o.currency, o.product_name, o.approved_at, o.capi_match";

// Chamado depois que o webhook aprova uma venda. Pode rodar mais de uma vez para o mesmo pedido:
// o índice único em capi_events faz só a primeira chamada enviar.
export async function sendPurchase(orderId: string) {
  const o = await one<OrderRow>(`select ${ORDER_COLS} from orders o where o.id = $1 and o.status = 'approved'`, [orderId]);
  if (!o) return;
  const pixels = await query<PixelRow>(
    `select id, pixel_id, access_token_enc, test_event_code from pixels
     where workspace_id = $1 and enabled and (webhook_id is null or webhook_id = $2)`,
    [o.workspace_id, o.webhook_id],
  );
  for (const p of pixels) {
    const [row] = await query<{ id: string }>(
      `insert into capi_events (workspace_id, pixel_id, order_id) values ($1, $2, $3)
       on conflict (pixel_id, order_id, event_name) where order_id is not null do nothing returning id`,
      [o.workspace_id, p.id, o.id],
    );
    if (row) await sendOne(p, o, row.id);
  }
}

// Tenta de novo o que falhou (Meta fora do ar, token vencido já trocado...). Roda no cron e no botão.
export async function retryFailed(workspaceId: string | null) {
  const rows = await query<OrderRow & { event_row: string; pixel_row: string }>(
    `select ${ORDER_COLS}, e.id as event_row, e.pixel_id as pixel_row from capi_events e
     join orders o on o.id = e.order_id
     where e.status in ('failed','sending') and e.attempts < $2 and ($1::uuid is null or e.workspace_id = $1)
       and e.created_at < now() - interval '1 minute'
     order by e.created_at limit 200`,
    [workspaceId, MAX_ATTEMPTS],
  );
  for (const r of rows) {
    const p = await one<PixelRow>("select id, pixel_id, access_token_enc, test_event_code from pixels where id = $1 and enabled", [r.pixel_row]);
    if (p) await sendOne(p, r, r.event_row);
  }
  return rows.length;
}

// Apaga os dados de correspondência que não servem mais (o Meta só aceita compras de até 7 dias).
export async function purgeMatchData() {
  await query("update orders set capi_match = null where capi_match is not null and created_at < now() - interval '8 days'");
}

// Evento de teste: só com o código de teste do Gerenciador de Eventos, para não contar como venda.
export async function sendTestEvent(workspaceId: string, pixelRowId: string, emailHash: string): Promise<{ ok: boolean; message: string }> {
  const p = await one<PixelRow>(
    "select id, pixel_id, access_token_enc, test_event_code from pixels where id = $1 and workspace_id = $2",
    [pixelRowId, workspaceId],
  );
  if (!p) return { ok: false, message: "Pixel não encontrado." };
  if (!p.test_event_code) return { ok: false, message: "Cadastre o código de teste do Gerenciador de Eventos para enviar um teste sem contar como venda." };
  const m: MatchData = { em: [emailHash] };
  const event = purchaseEvent({ externalId: `teste-${Date.now()}`, amountCents: 100, currency: "BRL", productName: "Teste do Clickify", approvedAt: new Date() }, m);
  const r = await post(p, [event], p.test_event_code);
  await query(
    `insert into capi_events (workspace_id, pixel_id, event_name, status, fields, attempts, response, sent_at)
     values ($1, $2, 'Purchase (teste)', $3, $4, 1, $5, case when $3 = 'sent' then now() end)`,
    [workspaceId, p.id, r.ok ? "sent" : "failed", matchFields(m), r.response],
  );
  await query("update pixels set last_event_at = now(), last_error = $2 where id = $1", [p.id, r.ok ? null : r.response]);
  return r.ok
    ? { ok: true, message: "Teste enviado. Confira na aba \"Eventos de teste\" do Gerenciador de Eventos." }
    : { ok: false, message: `O Meta recusou: ${r.response}` };
}

// Confere ID e token antes de salvar (só em modo real).
export async function checkPixel(pixelId: string, token: string): Promise<string | null> {
  if (meta().mode === "mock") return null;
  try {
    const res = await fetch(`${GRAPH}/${pixelId}?fields=id,name&access_token=${encodeURIComponent(token)}`, {
      cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return null;
    const body = await res.json().catch(() => ({}));
    return body?.error?.message ?? `Meta respondeu ${res.status}`;
  } catch (e) {
    return `Sem resposta do Meta: ${(e as Error).message}`;
  }
}
