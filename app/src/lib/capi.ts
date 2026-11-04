// Pixel pelo servidor (API de Conversões do Meta): monta o evento "Purchase" a partir do pedido.
// Funções puras, testadas em tests/capi.test.ts. Regras de normalização e hash seguem a
// documentação do Meta ("Customer Information Parameters"): minúsculas, sem espaços nem pontuação,
// SHA-256 em hexadecimal. IP, navegador e os cookies _fbc/_fbp vão sem hash, como o Meta pede.

import crypto from "node:crypto";
import type { Buyer } from "./normalize.ts";

const hash = (v: string) => crypto.createHash("sha256").update(v, "utf8").digest("hex");

// O que guardamos no pedido para enviar depois: já com hash, nunca o dado em claro.
export interface MatchData {
  em?: string[];
  ph?: string[];
  fn?: string[];
  ln?: string[];
  ct?: string[];
  st?: string[];
  zp?: string[];
  country?: string[];
  external_id?: string[];
  client_ip_address?: string;
  client_user_agent?: string;
  fbc?: string;
  fbp?: string;
}

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const letters = (s: string) => plain(s).replace(/[^a-z0-9]/g, "");

// Telefone com DDI: no Brasil, 10 ou 11 dígitos ganham o 55 na frente.
export function normPhone(v: string): string | null {
  let d = v.replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length >= 8 ? d : null;
}

export function splitName(full: string): { fn: string | null; ln: string | null } {
  const parts = plain(full).replace(/[^a-z\s'-]/g, "").replace(/['-]/g, "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { fn: null, ln: null };
  return { fn: parts[0], ln: parts.length > 1 ? parts[parts.length - 1] : null };
}

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-f:]+$/i;

// fbc vem do cookie _fbc; sem ele, o fbclid do link do anúncio vira um fbc válido
// (formato do Meta: fb.1.<milissegundos>.<fbclid>).
export function fbcFrom(b: Buyer, at: Date): string | null {
  if (b.fbc && /^fb\.\d\.\d+\./.test(b.fbc)) return b.fbc;
  if (b.fbclid) return `fb.1.${at.getTime()}.${b.fbclid}`;
  return null;
}

export function matchData(emailHash: string | null, b: Buyer | undefined, at: Date): MatchData {
  const m: MatchData = {};
  if (emailHash) m.em = [emailHash];
  if (!b) return m;
  const ph = b.phone ? normPhone(b.phone) : null;
  if (ph) m.ph = [hash(ph)];
  const { fn, ln } = b.name ? splitName(b.name) : { fn: null, ln: null };
  if (fn) m.fn = [hash(fn)];
  if (ln) m.ln = [hash(ln)];
  const ct = b.city ? letters(b.city) : "";
  if (ct) m.ct = [hash(ct)];
  const st = b.state ? letters(b.state) : "";
  if (st) m.st = [hash(st)];
  const zp = b.zip ? letters(b.zip) : "";
  if (zp) m.zp = [hash(zp)];
  // Checkouts brasileiros quase nunca mandam o país; sem ele o Meta casa menos.
  const country = b.country ? letters(b.country).slice(0, 2) : "br";
  if (country.length === 2) m.country = [hash(country)];
  const doc = b.document?.replace(/\D/g, "");
  if (doc && (doc.length === 11 || doc.length === 14)) m.external_id = [hash(doc)];
  const ip = b.ip?.split(",")[0].trim();
  if (ip && (IPV4.test(ip) || (ip.includes(":") && IPV6.test(ip)))) m.client_ip_address = ip;
  if (b.userAgent) m.client_user_agent = b.userAgent.slice(0, 500);
  const fbc = fbcFrom(b, at);
  if (fbc) m.fbc = fbc;
  if (b.fbp && /^fb\.\d\.\d+\.\d+$/.test(b.fbp)) m.fbp = b.fbp;
  return m;
}

// Nomes em português dos campos enviados, para mostrar na tela "o que foi junto".
const FIELD_LABEL: Record<keyof MatchData, string> = {
  em: "e-mail", ph: "telefone", fn: "nome", ln: "sobrenome", ct: "cidade", st: "estado", zp: "CEP",
  country: "país", external_id: "CPF/CNPJ", client_ip_address: "IP", client_user_agent: "navegador",
  fbc: "clique do anúncio", fbp: "cookie do pixel",
};

export function matchFields(m: MatchData): string[] {
  return (Object.keys(FIELD_LABEL) as (keyof MatchData)[]).filter((k) => m[k] !== undefined).map((k) => FIELD_LABEL[k]);
}

// O Meta só aceita compra com algum dado do cliente; e-mail, telefone ou clique do anúncio
// são os que mais ajudam. Sem nenhum deles, nem vale enviar.
export function hasStrongMatch(m: MatchData): boolean {
  return !!(m.em || m.ph || m.fbc || m.external_id || (m.client_ip_address && m.client_user_agent));
}

export interface PurchaseInput {
  externalId: string;
  amountCents: number;
  currency: string;
  productName: string | null;
  approvedAt: Date;
}

export interface CapiEvent {
  event_name: "Purchase";
  event_time: number;
  event_id: string;
  action_source: "website";
  user_data: MatchData;
  custom_data: { currency: string; value: number; order_id: string; content_name?: string };
}

// event_id = número do pedido: se o checkout também dispara o pixel do navegador com o mesmo
// número, o Meta junta os dois e conta uma compra só.
export function purchaseEvent(o: PurchaseInput, m: MatchData, now = new Date()): CapiEvent {
  // O Meta recusa eventos com mais de 7 dias ou no futuro.
  const t = Math.min(o.approvedAt.getTime(), now.getTime());
  return {
    event_name: "Purchase",
    event_time: Math.floor(t / 1000),
    event_id: o.externalId,
    action_source: "website",
    user_data: m,
    custom_data: {
      currency: o.currency.toUpperCase(),
      value: Math.round(o.amountCents) / 100,
      order_id: o.externalId,
      ...(o.productName ? { content_name: o.productName.slice(0, 200) } : {}),
    },
  };
}

export const MAX_EVENT_AGE_DAYS = 7;

export function tooOld(approvedAt: Date, now = new Date()): boolean {
  return now.getTime() - approvedAt.getTime() > MAX_EVENT_AGE_DAYS * 864e5;
}

export function validPixelId(v: string): boolean {
  return /^\d{10,20}$/.test(v);
}
