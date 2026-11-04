// Funções puras: payload do checkout -> pedido normalizado, e UTMs -> IDs do Meta.
// Sem banco aqui, para dar para testar isolado.

export type OrderStatus = "approved" | "pending" | "refused" | "refunded" | "chargeback";

export interface Utms {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
}

export type PaymentMethod = "pix" | "card" | "boleto" | "other";

// Dados do comprador usados só para o pixel pelo servidor (API de Conversões do Meta).
// Ficam em claro só na memória: o que vai para o banco já sai com hash (ver capi.ts).
export interface Buyer {
  name?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  document?: string | null; // CPF/CNPJ
  ip?: string | null;
  userAgent?: string | null;
  fbc?: string | null; // cookie _fbc
  fbp?: string | null; // cookie _fbp
  fbclid?: string | null;
}

export interface NormalizedOrder extends Utms {
  externalId: string;
  status: OrderStatus;
  amountCents: number;
  currency: string;
  productName: string | null;
  email: string | null;
  orderedAt: Date;
  approvedAt: Date | null;
  paymentMethod?: PaymentMethod | null;
  buyer?: Buyer;
  // Vem do script de tracking (campo oculto ck_vid no checkout). Quando presente,
  // a atribuição usa o clique persistido em vez de depender das UTMs do webhook.
  trackingVisitorKey?: string | null;
}

// Cada checkout escreve a forma de pagamento de um jeito (PIX, pix, credit_card, CREDIT_CARD,
// creditCard, billet, bankslip, boleto...). Aqui vira um dos quatro valores do Clickify.
export function paymentMethodOf(raw: unknown): PaymentMethod | null {
  const s = String(raw ?? "").toLowerCase().replace(/[\s-]/g, "_");
  if (!s) return null;
  if (s.includes("pix")) return "pix";
  if (/(credit|card|cartao|cartão)/.test(s)) return "card";
  if (/(billet|boleto|bankslip|bank_slip)/.test(s)) return "boleto";
  return "other";
}

export interface Attribution {
  campaign: string | null;
  adset: string | null;
  ad: string | null;
}

// O que mandamos colar no anúncio. Os {{...}} são os parâmetros dinâmicos do próprio Meta.
export const UTM_TEMPLATE =
  "utm_source=FB&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

// O ID é o que vem depois do último "|". Só aceita se for numérico (IDs do Meta são).
export function idFromUtm(value: string | null | undefined): string | null {
  if (!value) return null;
  const decoded = safeDecode(value);
  const i = decoded.lastIndexOf("|");
  const tail = (i >= 0 ? decoded.slice(i + 1) : decoded).trim();
  return /^\d{6,}$/.test(tail) ? tail : null;
}

export function attribute(u: Utms): Attribution {
  return {
    campaign: idFromUtm(u.utm_campaign),
    adset: idFromUtm(u.utm_medium),
    ad: idFromUtm(u.utm_content),
  };
}

export function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
}

export function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function emptyUtms(): Utms {
  return { utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null };
}

// Junta UTMs de vários lugares; o primeiro que tiver valor ganha.
export function mergeUtms(...sources: Array<Record<string, unknown> | null | undefined>): Utms {
  const out = emptyUtms();
  for (const src of sources) {
    if (!src) continue;
    for (const k of UTM_KEYS) if (!out[k]) out[k] = str(src[k]);
  }
  return out;
}

export function utmsFromUrl(url: unknown): Record<string, string> | null {
  const s = str(url);
  if (!s) return null;
  const q = s.includes("?") ? s.slice(s.indexOf("?") + 1) : s;
  const params = new URLSearchParams(q);
  const out: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

export function fbclidFromUrl(url: unknown): string | null {
  const s = str(url);
  if (!s || !s.includes("fbclid=")) return null;
  return new URLSearchParams(s.slice(s.indexOf("?") + 1)).get("fbclid");
}

export function toCents(v: unknown): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "0").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

export function toDate(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const GENERIC_STATUS: Record<string, OrderStatus> = {
  approved: "approved", paid: "approved", pago: "approved", aprovado: "approved", aprovada: "approved", completed: "approved",
  pending: "pending", pendente: "pending", waiting_payment: "pending", aguardando: "pending",
  refused: "refused", recusado: "refused", recusada: "refused", canceled: "refused", cancelled: "refused",
  cancelado: "refused", expired: "refused",
  refunded: "refunded", reembolsado: "refunded", reembolsada: "refunded",
  chargeback: "chargeback", chargedback: "chargeback",
};

/**
 * JSON genérico. Campos aceitos (documentados na tela de integrações):
 * id, status, amount (reais) ou amount_cents, currency, product, email,
 * created_at, approved_at, e as UTMs soltas, em "utms": {...} ou numa "url".
 */
export function normalizeGeneric(p: Record<string, unknown>): NormalizedOrder {
  const id = str(p.id ?? p.order_id ?? p.external_id);
  if (!id) throw new Error("campo id ausente");
  const rawStatus = String(p.status ?? "").toLowerCase();
  const status = GENERIC_STATUS[rawStatus];
  if (!status) throw new Error(`status desconhecido: ${rawStatus || "(vazio)"}`);
  const amountCents = p.amount_cents !== undefined ? Math.max(0, Math.round(Number(p.amount_cents))) : toCents(p.amount);
  const orderedAt = toDate(p.created_at) ?? new Date();
  return {
    externalId: id,
    status,
    amountCents,
    currency: (str(p.currency) ?? "BRL").toUpperCase(),
    productName: str(p.product ?? p.product_name),
    email: str(p.email ?? (p.customer as Record<string, unknown> | undefined)?.email),
    orderedAt,
    approvedAt: status === "approved" ? toDate(p.approved_at) ?? new Date() : toDate(p.approved_at),
    paymentMethod: paymentMethodOf(p.payment_method),
    buyer: genericBuyer(p),
    ...mergeUtms(p, p.utms as Record<string, unknown>, p.tracking as Record<string, unknown>, utmsFromUrl(p.url)),
    trackingVisitorKey: str(p.ck_vid) ?? null,
  };
}

// Campos do comprador no JSON genérico: soltos ou dentro de "customer".
function genericBuyer(p: Record<string, unknown>) {
  const c = (p.customer ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = str(p[k]) ?? str(c[k]);
      if (v) return v;
    }
    return null;
  };
  return {
    name: pick("name", "customer_name"), phone: pick("phone"), city: pick("city"), state: pick("state"),
    zip: pick("zip", "zipcode"), country: pick("country"), document: pick("document", "cpf"),
    ip: pick("ip", "client_ip"), userAgent: pick("user_agent"), fbc: pick("fbc"), fbp: pick("fbp"),
    fbclid: pick("fbclid") ?? fbclidFromUrl(p.url),
  };
}

/** Shopify: tópicos orders/create, orders/paid, orders/updated, orders/cancelled e refunds/create. */
export function normalizeShopify(topic: string, p: Record<string, unknown>): NormalizedOrder | { refundOf: string } {
  if (topic === "refunds/create") {
    const orderId = str(p.order_id);
    if (!orderId) throw new Error("refund sem order_id");
    return { refundOf: orderId };
  }
  const id = str(p.id);
  if (!id) throw new Error("pedido sem id");
  const fin = String(p.financial_status ?? "");
  let status: OrderStatus;
  if (p.cancelled_at || fin === "voided") status = "refused";
  else if (fin === "refunded") status = "refunded";
  else if (fin === "paid" || fin === "partially_refunded") status = "approved";
  else status = "pending";

  const notes: Record<string, unknown> = {};
  for (const a of (p.note_attributes as Array<{ name: string; value: string }>) ?? []) notes[a.name] = a.value;
  const items = (p.line_items as Array<{ title?: string }>) ?? [];
  return {
    externalId: id,
    status,
    amountCents: toCents(p.total_price),
    currency: (str(p.currency) ?? "BRL").toUpperCase(),
    productName: str(items[0]?.title),
    email: str(p.email ?? p.contact_email),
    orderedAt: toDate(p.created_at) ?? new Date(),
    approvedAt: status === "approved" ? toDate(p.processed_at) ?? new Date() : null,
    paymentMethod: paymentMethodOf(((p.payment_gateway_names as string[] | undefined) ?? []).join(" ") || p.gateway),
    buyer: shopifyBuyer(p, notes),
    ...mergeUtms(notes, utmsFromUrl(p.landing_site)),
    trackingVisitorKey: str(notes.ck_vid ?? notes._ck_vid) ?? null,
  };
}

function shopifyBuyer(p: Record<string, unknown>, notes: Record<string, unknown>) {
  const c = (p.customer ?? {}) as Record<string, unknown>;
  const a = (p.billing_address ?? p.shipping_address ?? {}) as Record<string, unknown>;
  const cd = (p.client_details ?? {}) as Record<string, unknown>;
  return {
    name: [str(c.first_name) ?? str(a.first_name), str(c.last_name) ?? str(a.last_name)].filter(Boolean).join(" ") || null,
    phone: str(p.phone) ?? str(c.phone) ?? str(a.phone), city: str(a.city), state: str(a.province_code ?? a.province),
    zip: str(a.zip), country: str(a.country_code), ip: str(p.browser_ip ?? cd.browser_ip),
    userAgent: str(cd.user_agent), fbc: str(notes._fbc ?? notes.fbc), fbp: str(notes._fbp ?? notes.fbp),
    fbclid: fbclidFromUrl(p.landing_site),
  };
}

// O status só avança: pendente -> aprovado/recusado -> reembolsado/chargeback.
// Evento atrasado (pendente depois de aprovado) é ignorado.
const RANK: Record<OrderStatus, number> = { pending: 0, approved: 1, refused: 1, refunded: 2, chargeback: 2 };

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  if (from === "refused" && (to === "refunded" || to === "chargeback")) return false;
  return RANK[to] > RANK[from];
}
