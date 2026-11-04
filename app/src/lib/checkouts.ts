// Adaptadores dos checkouts brasileiros: payload da plataforma -> pedido do Clickify.
// Funções puras (sem banco), testadas em tests/checkouts.test.ts com exemplos montados a partir
// da documentação de cada plataforma. Confirmar com a 1ª venda real de cada uma (o evento cru
// fica guardado em webhook_events).

import crypto from "node:crypto";
import {
  fbclidFromUrl, mergeUtms, paymentMethodOf, str, toCents, type Buyer, type NormalizedOrder, type OrderStatus,
} from "./normalize.ts"; // com extensão: os testes rodam direto no Node
import type { CheckoutPlatform } from "./platforms.ts";
export type { CheckoutPlatform };

type Obj = Record<string, unknown>;

// Lê um caminho ignorando maiúsculas: a Kiwify manda "Customer.email" no webhook e "customer.email" na API.
export function get(o: unknown, path: string): unknown {
  let cur: unknown = o;
  for (const key of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    if (Array.isArray(cur)) {
      cur = cur[Number(key)];
      continue;
    }
    const rec = cur as Obj;
    const found = Object.keys(rec).find((k) => k.toLowerCase() === key.toLowerCase());
    cur = found === undefined ? undefined : rec[found];
  }
  return cur;
}

function first(o: unknown, ...paths: string[]): unknown {
  for (const p of paths) {
    const v = get(o, p);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

// Datas sem fuso ("2026-11-01 14:03" na Kiwify, "2026-11-01 14:03:00.000000" na Yampi) estão no
// horário de Brasília; sem isto o servidor (em UTC) erraria a venda em 3 horas, às vezes de dia.
export function toDateBr(v: unknown, tz = "-03:00"): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return new Date(v > 1e12 ? v : v * 1000);
  const s = String(v).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(\.\d+)?$/);
  const d = m ? new Date(`${m[1]}T${m[2].length === 5 ? `${m[2]}:00` : m[2]}${tz}`) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Comprador: para cada campo, os caminhos possíveis no payload daquela plataforma.
function buyer(o: unknown, paths: Partial<Record<keyof Buyer, string[]>>): Buyer {
  const out: Buyer = {};
  for (const [k, ps] of Object.entries(paths) as [keyof Buyer, string[]][]) out[k] = str(first(o, ...ps));
  if (!out.fbclid) out.fbclid = fbclidFromUrl(first(o, "url", "checkout_url", "TrackingParameters.url"));
  return out;
}

function reais(v: unknown): number {
  return toCents(v);
}

function cents(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function build(o: Omit<NormalizedOrder, "currency"> & { currency?: unknown }): NormalizedOrder {
  return { ...o, currency: (str(o.currency) ?? "BRL").toUpperCase() };
}

// ---------------- Kiwify ----------------
const KIWIFY: Record<string, OrderStatus> = {
  paid: "approved", approved: "approved", waiting_payment: "pending", pending: "pending",
  refused: "refused", refunded: "refunded", chargedback: "chargeback", chargeback: "chargeback",
};

export function normalizeKiwify(p: Obj): NormalizedOrder | null {
  const rawStatus = str(first(p, "order_status", "status"))?.toLowerCase();
  // Carrinho abandonado não tem status: não é pedido.
  if (!rawStatus) return null;
  const status = KIWIFY[rawStatus];
  if (!status) throw new Error(`status da Kiwify desconhecido: ${rawStatus}`);
  const id = str(first(p, "order_id", "id"));
  if (!id) throw new Error("pedido da Kiwify sem order_id");
  const tracking = (first(p, "TrackingParameters", "tracking") ?? {}) as Obj;
  return build({
    externalId: id,
    status,
    // Kiwify manda valores em centavos (ex.: 10388 = R$ 103,88).
    amountCents: cents(first(p, "Commissions.charge_amount", "payment.charge_amount", "Commissions.product_base_price", "payment.product_base_price")),
    currency: first(p, "Commissions.currency", "payment.charge_currency", "currency"),
    productName: str(first(p, "Product.product_name", "product.name")),
    email: str(first(p, "Customer.email", "customer.email")),
    orderedAt: toDateBr(first(p, "created_at")) ?? new Date(),
    approvedAt: status === "approved" ? toDateBr(first(p, "approved_date")) ?? new Date() : toDateBr(first(p, "approved_date")),
    paymentMethod: paymentMethodOf(first(p, "payment_method")),
    buyer: buyer(p, {
      name: ["Customer.full_name", "customer.full_name", "Customer.first_name"], phone: ["Customer.mobile", "customer.mobile"],
      city: ["Customer.city"], state: ["Customer.state"], zip: ["Customer.zipcode"], document: ["Customer.CPF", "Customer.cnpj"],
      ip: ["Customer.ip", "customer.ip"], fbclid: ["TrackingParameters.fbclid"],
    }),
    ...mergeUtms(tracking),
  });
}

// ---------------- Hotmart ----------------
const HOTMART: Record<string, OrderStatus> = {
  APPROVED: "approved", COMPLETE: "approved",
  WAITING_PAYMENT: "pending", PRINTED_BILLET: "pending", BILLET_PRINTED: "pending", PROCESSING_TRANSACTION: "pending",
  STARTED: "pending", UNDER_ANALISYS: "pending", UNDER_ANALYSIS: "pending", PRE_ORDER: "pending", OVERDUE: "pending",
  CANCELLED: "refused", CANCELED: "refused", EXPIRED: "refused", NO_FUNDS: "refused", BLOCKED: "refused",
  REFUNDED: "refunded", PARTIALLY_REFUNDED: "refunded",
  CHARGEBACK: "chargeback", DISPUTE: "chargeback", PROTEST: "chargeback",
};

// A Hotmart não repassa utm_*. O Clickify manda colar os IDs do Meta no parâmetro sck
// (ex.: sck=120001-120002-120003) e lê aqui, na ordem campanha, conjunto, anúncio.
export function metaIdsFrom(...values: unknown[]): string[] {
  for (const v of values) {
    const ids = String(v ?? "").match(/\d{6,}/g);
    if (ids?.length) return ids.slice(0, 3);
  }
  return [];
}

export function normalizeHotmart(p: Obj): NormalizedOrder {
  const d = (get(p, "data") ?? p) as Obj;
  const id = str(first(d, "purchase.transaction"));
  if (!id) throw new Error("compra da Hotmart sem purchase.transaction");
  const raw = str(first(d, "purchase.status"))?.toUpperCase() ?? str(get(p, "event"))?.replace(/^PURCHASE_/, "") ?? "";
  const status = HOTMART[raw];
  if (!status) throw new Error(`status da Hotmart desconhecido: ${raw || "(vazio)"}`);
  const [campaign, adset, ad] = metaIdsFrom(get(d, "purchase.origin.sck"), get(d, "purchase.origin.xcod"));
  return build({
    externalId: id,
    status,
    // Hotmart manda o valor em reais (double).
    amountCents: reais(first(d, "purchase.price.value", "purchase.full_price.value")),
    currency: first(d, "purchase.price.currency_value"),
    productName: str(first(d, "product.name")),
    email: str(first(d, "buyer.email")),
    orderedAt: toDateBr(first(d, "purchase.order_date")) ?? new Date(),
    approvedAt: status === "approved" ? toDateBr(first(d, "purchase.approved_date")) ?? new Date() : toDateBr(first(d, "purchase.approved_date")),
    paymentMethod: paymentMethodOf(first(d, "purchase.payment.type")),
    buyer: buyer(d, {
      name: ["buyer.name"], phone: ["buyer.checkout_phone", "buyer.phone"], city: ["buyer.address.city"],
      state: ["buyer.address.state"], zip: ["buyer.address.zipcode"], country: ["buyer.address.country_iso"],
      document: ["buyer.document"],
    }),
    utm_source: str(first(d, "purchase.origin.src")) ?? (campaign ? "FB" : null),
    utm_campaign: campaign ?? null,
    utm_medium: adset ?? null,
    utm_content: ad ?? null,
    utm_term: null,
  });
}

// ---------------- Yampi ----------------
const YAMPI: Record<string, OrderStatus> = {
  paid: "approved", authorized: "approved", invoiced: "approved", shipped: "approved", on_carriage: "approved",
  delivered: "approved", handling_products: "approved",
  waiting_payment: "pending", pending: "pending", in_review: "pending",
  cancelled: "refused", canceled: "refused", refused: "refused",
  refunded: "refunded", chargeback: "chargeback",
};

export function normalizeYampi(p: Obj): NormalizedOrder | null {
  const event = str(get(p, "event")) ?? "";
  if (event && !event.startsWith("order.")) return null; // produto, cliente, carrinho: não é pedido
  const r = (get(p, "resource") ?? p) as Obj;
  const id = str(first(r, "id", "number"));
  if (!id) throw new Error("pedido da Yampi sem id");
  const alias = str(first(r, "status.data.alias", "status.alias", "status"))?.toLowerCase() ?? "";
  const status = YAMPI[alias] ?? (event === "order.paid" ? "approved" : undefined);
  if (!status) throw new Error(`status da Yampi desconhecido: ${alias || "(vazio)"}`);
  return build({
    externalId: id,
    status,
    amountCents: reais(first(r, "value_total", "buyer_value_total")),
    currency: "BRL",
    productName: str(first(r, "items.data.0.sku.data.title", "items.data.0.name")),
    email: str(first(r, "customer.data.email", "customer.email")),
    orderedAt: toDateBr(first(r, "created_at.date", "created_at")) ?? new Date(),
    approvedAt: status === "approved" ? toDateBr(first(r, "updated_at.date", "updated_at")) ?? new Date() : null,
    paymentMethod: paymentMethodOf(first(r, "payments.0.alias", "payments.data.0.alias", "payment_method")),
    buyer: buyer(r, {
      name: ["customer.data.name", "customer.data.first_name"], phone: ["customer.data.phone.full_number", "customer.data.phone"],
      city: ["shipping_address.data.city"], state: ["shipping_address.data.uf"], zip: ["shipping_address.data.zipcode"],
      document: ["customer.data.cpf"], ip: ["ip"], userAgent: ["user_agent"],
    }),
    ...mergeUtms(r),
  });
}

// ---------------- Eduzz ----------------
const EDUZZ: Record<string, OrderStatus> = {
  paid: "approved", approved: "approved",
  open: "pending", waiting_payment: "pending", waitingpayment: "pending", scheduled: "pending", recovering: "pending",
  negotiated: "pending",
  canceled: "refused", cancelled: "refused", expired: "refused",
  refunded: "refunded", waiting_refund: "refunded", waitingrefund: "refunded",
  chargeback: "chargeback",
};

export function normalizeEduzz(p: Obj): NormalizedOrder | null {
  const event = str(get(p, "event")) ?? "";
  if (event && !event.includes("invoice")) return null; // eventos de contrato, aluno...: não é pedido
  const d = (get(p, "data") ?? p) as Obj;
  const id = str(first(d, "id"));
  if (!id) throw new Error("fatura da Eduzz sem id");
  const fromEvent = event.split(".").pop()?.replace(/^invoice_/, "") ?? "";
  const raw = (str(first(d, "status")) ?? fromEvent).toLowerCase().replace(/\s/g, "_");
  const status = EDUZZ[raw] ?? EDUZZ[fromEvent];
  if (!status) throw new Error(`status da Eduzz desconhecido: ${raw || "(vazio)"}`);
  const utm = (get(d, "utm") ?? {}) as Obj;
  return build({
    externalId: id,
    status,
    // Eduzz manda em reais (ex.: 301.5).
    amountCents: reais(first(d, "paid.value", "price.value")),
    currency: first(d, "paid.currency", "price.currency"),
    productName: str(first(d, "items.0.name")),
    email: str(first(d, "buyer.email", "student.email")),
    orderedAt: toDateBr(first(d, "createdAt")) ?? new Date(),
    approvedAt: status === "approved" ? toDateBr(first(d, "paidAt")) ?? new Date() : toDateBr(first(d, "paidAt")),
    paymentMethod: paymentMethodOf(first(d, "paymentMethod", "payment.method")),
    buyer: buyer(d, {
      name: ["buyer.name"], phone: ["buyer.cellphone", "buyer.phone"], city: ["buyer.address.city"],
      state: ["buyer.address.state"], zip: ["buyer.address.zipCode"], country: ["buyer.address.country"],
      document: ["buyer.document"],
    }),
    utm_source: str(get(utm, "source")),
    utm_medium: str(get(utm, "medium")),
    utm_campaign: str(get(utm, "campaign")),
    utm_content: str(get(utm, "content")),
    utm_term: str(get(utm, "term")),
  });
}

// ---------------- Assinaturas ----------------
function hmac(alg: "sha1" | "sha256", secret: string, body: string, enc: "hex" | "base64") {
  return crypto.createHmac(alg, secret).update(body, "utf8").digest(enc);
}

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Cada plataforma prova a origem de um jeito. Sem segredo cadastrado, o token da URL é a única proteção.
export function signatureOk(platform: CheckoutPlatform, secret: string | null, raw: string, headers: Headers, url: URL): boolean {
  if (!secret) return true;
  const h = (name: string) => headers.get(name)?.trim() ?? "";
  switch (platform) {
    case "shopify":
      return same(h("x-shopify-hmac-sha256"), hmac("sha256", secret, raw, "base64"));
    case "kiwify":
      // HMAC-SHA1 do corpo exatamente como chegou, em hex, no parâmetro ?signature= da URL.
      return same((url.searchParams.get("signature") ?? "").toLowerCase(), hmac("sha1", secret, raw, "hex"));
    case "yampi":
      return same(h("x-yampi-hmac-sha256"), hmac("sha256", secret, raw, "base64"));
    case "eduzz": {
      // A documentação não diz se é hex ou base64: aceita os dois.
      const given = h("x-signature");
      return same(given.toLowerCase(), hmac("sha256", secret, raw, "hex")) || same(given, hmac("sha256", secret, raw, "base64"));
    }
    case "hotmart":
      return same(h("x-hotmart-hottok"), secret);
    default:
      return true;
  }
}
