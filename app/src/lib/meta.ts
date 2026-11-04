import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parseActions, type MetaAction } from "./funnel";

// Uma interface, duas implementações: a API oficial do Meta (com o app do próprio usuário)
// e um mock que roda sem conta nenhuma (META_MODE=mock, o padrão em dev).

export type Level = "campaign" | "adset" | "ad";
export type MetaStatus = "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED" | "OTHER";

export interface MetaAdAccount {
  externalId: string;
  name: string;
  currency: string;
  timezone: string;
}

export interface MetaObject {
  level: Level;
  externalId: string;
  parentExternalId: string | null;
  campaignExternalId: string;
  name: string;
  status: MetaStatus;
  dailyBudgetCents: number | null;
}

export interface MetaInsight {
  campaignExternalId: string;
  adsetExternalId: string;
  adExternalId: string;
  date: string; // YYYY-MM-DD no fuso da conta
  spendCents: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  landingPageViews: number;
  addToCart: number;
  initiateCheckout: number;
}

export interface MetaProvider {
  mode: "mock" | "live";
  authUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<{ token: string; expiresAt: Date | null }>;
  listAdAccounts(token: string): Promise<MetaAdAccount[]>;
  listObjects(token: string, accountId: string): Promise<MetaObject[]>;
  insights(token: string, accountId: string, since: string, until: string): Promise<MetaInsight[]>;
  setStatus(token: string, objectId: string, status: "ACTIVE" | "PAUSED"): Promise<void>;
  setDailyBudget(token: string, objectId: string, cents: number): Promise<void>;
}

// v25.0 vale até 2028. Dá para subir sem mexer no código via META_GRAPH_VERSION.
// `||` e não `??`: no .env a variável costuma existir vazia (META_GRAPH_VERSION=).
const VERSION = env("META_GRAPH_VERSION") || "v25.0";

// Valores colados em painel ou terminal às vezes chegam com espaço ou quebra de linha no fim;
// um "live\r" faria o app cair no modo simulado sem avisar.
function env(name: string): string {
  return (process.env[name] ?? "").trim();
}
export const GRAPH = `https://graph.facebook.com/${VERSION}`;

// Usamos `status` (o liga/desliga que o usuário escolheu), não `effective_status`: este vem
// como CAMPAIGN_PAUSED, ADSET_PAUSED, WITH_ISSUES etc. e escondia conjuntos e anúncios da tabela.
function normStatus(s: string | undefined): MetaStatus {
  return s === "ACTIVE" || s === "PAUSED" || s === "DELETED" || s === "ARCHIVED" ? s : "OTHER";
}

class LiveMeta implements MetaProvider {
  mode = "live" as const;
  private appId = env("META_APP_ID");
  private appSecret = env("META_APP_SECRET");

  private async get<T>(url: string): Promise<T> {
    const res = await fetch(url, { cache: "no-store" });
    const body = await res.json();
    // O caminho (sem a query, que tem token e segredo) diz qual chamada falhou.
    if (!res.ok) throw new Error(`${new URL(url).pathname}: ${body?.error?.message ?? `Meta respondeu ${res.status}`}`);
    return body as T;
  }

  private async getAll<T>(url: string): Promise<T[]> {
    const out: T[] = [];
    let next: string | undefined = url;
    while (next) {
      const page: { data: T[]; paging?: { next?: string } } = await this.get(next);
      out.push(...page.data);
      next = page.paging?.next;
    }
    return out;
  }

  private async post(objectId: string, token: string, fields: Record<string, string>) {
    const res = await fetch(`${GRAPH}/${objectId}`, {
      method: "POST",
      body: new URLSearchParams({ ...fields, access_token: token }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`${objectId}: ${body?.error?.message ?? `Meta respondeu ${res.status}`}`);
  }

  authUrl(state: string, redirectUri: string) {
    const q = new URLSearchParams({ client_id: this.appId, redirect_uri: redirectUri, state });
    // Apps com "Login do Facebook para Empresas" usam uma configuração (config_id) que já
    // lista as permissões; apps com o Login clássico usam scope.
    const configId = env("META_CONFIG_ID");
    if (configId) q.set("config_id", configId);
    else q.set("scope", "ads_read,ads_management");
    return `https://www.facebook.com/${VERSION}/dialog/oauth?${q}`;
  }

  async exchangeCode(code: string, redirectUri: string) {
    const short = await this.get<{ access_token: string }>(
      `${GRAPH}/oauth/access_token?${new URLSearchParams({
        client_id: this.appId,
        client_secret: this.appSecret,
        redirect_uri: redirectUri,
        code,
      })}`,
    );
    const long = await this.get<{ access_token: string; expires_in?: number }>(
      `${GRAPH}/oauth/access_token?${new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: this.appId,
        client_secret: this.appSecret,
        fb_exchange_token: short.access_token,
      })}`,
    );
    return {
      token: long.access_token,
      expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null,
    };
  }

  async listAdAccounts(token: string) {
    const rows = await this.getAll<{ id: string; name: string; currency: string; timezone_name: string }>(
      `${GRAPH}/me/adaccounts?fields=id,name,currency,timezone_name&limit=100&access_token=${token}`,
    );
    return rows.map((r) => ({ externalId: r.id, name: r.name, currency: r.currency, timezone: r.timezone_name }));
  }

  async listObjects(token: string, accountId: string) {
    const out: MetaObject[] = [];
    const camps = await this.getAll<{ id: string; name: string; status: string; daily_budget?: string }>(
      `${GRAPH}/${accountId}/campaigns?fields=id,name,status,daily_budget&limit=200&access_token=${token}`,
    );
    for (const c of camps)
      out.push({
        level: "campaign",
        externalId: c.id,
        parentExternalId: null,
        campaignExternalId: c.id,
        name: c.name,
        status: normStatus(c.status),
        dailyBudgetCents: c.daily_budget ? Number(c.daily_budget) : null,
      });
    const sets = await this.getAll<{ id: string; name: string; status: string; daily_budget?: string; campaign_id: string }>(
      `${GRAPH}/${accountId}/adsets?fields=id,name,status,daily_budget,campaign_id&limit=200&access_token=${token}`,
    );
    for (const s of sets)
      out.push({
        level: "adset",
        externalId: s.id,
        parentExternalId: s.campaign_id,
        campaignExternalId: s.campaign_id,
        name: s.name,
        status: normStatus(s.status),
        dailyBudgetCents: s.daily_budget ? Number(s.daily_budget) : null,
      });
    const ads = await this.getAll<{ id: string; name: string; status: string; adset_id: string; campaign_id: string }>(
      `${GRAPH}/${accountId}/ads?fields=id,name,status,adset_id,campaign_id&limit=200&access_token=${token}`,
    );
    for (const a of ads)
      out.push({
        level: "ad",
        externalId: a.id,
        parentExternalId: a.adset_id,
        campaignExternalId: a.campaign_id,
        name: a.name,
        status: normStatus(a.status),
        dailyBudgetCents: null,
      });
    return out;
  }

  async insights(token: string, accountId: string, since: string, until: string) {
    const q = new URLSearchParams({
      level: "ad",
      fields: "campaign_id,adset_id,ad_id,spend,impressions,clicks,inline_link_clicks,actions",
      time_range: JSON.stringify({ since, until }),
      time_increment: "1",
      limit: "500",
      access_token: token,
    });
    const rows = await this.getAll<{
      campaign_id: string; adset_id: string; ad_id: string; date_start: string;
      spend: string; impressions: string; clicks: string; inline_link_clicks?: string; actions?: MetaAction[];
    }>(`${GRAPH}/${accountId}/insights?${q}`);
    return rows.map((r) => ({
      campaignExternalId: r.campaign_id,
      adsetExternalId: r.adset_id,
      adExternalId: r.ad_id,
      date: r.date_start,
      spendCents: Math.round(Number(r.spend) * 100),
      impressions: Number(r.impressions),
      clicks: Number(r.clicks),
      linkClicks: Number(r.inline_link_clicks ?? 0),
      ...parseActions(r.actions),
    }));
  }

  setStatus(token: string, objectId: string, status: "ACTIVE" | "PAUSED") {
    return this.post(objectId, token, { status });
  }

  setDailyBudget(token: string, objectId: string, cents: number) {
    return this.post(objectId, token, { daily_budget: String(cents) });
  }
}

// ---------- Mock: dados determinísticos, estado salvo em .data/meta-mock.json ----------

const MOCK_ACCOUNTS: MetaAdAccount[] = [
  { externalId: "act_100000001", name: "Conta Principal", currency: "BRL", timezone: "America/Sao_Paulo" },
  { externalId: "act_100000002", name: "Conta de Testes", currency: "BRL", timezone: "America/Sao_Paulo" },
];

const MOCK_CAMPAIGNS = [
  "[CBO] Sutiã Conforto - Compra",
  "[ABO] Teste de Criativos - Compra",
  "[ADV+] Escala Nacional",
];

function seed(s: string): number {
  return crypto.createHash("md5").update(s).digest().readUInt32BE(0) / 0xffffffff;
}

function mockFile() {
  return process.env.META_MOCK_FILE || path.join(/* turbopackIgnore: true */ process.cwd(), ".data", "meta-mock.json");
}

function mockState(): { status: Record<string, MetaStatus>; budget: Record<string, number> } {
  try {
    return JSON.parse(fs.readFileSync(mockFile(), "utf8"));
  } catch {
    return { status: {}, budget: {} };
  }
}

function saveMockState(s: ReturnType<typeof mockState>) {
  fs.mkdirSync(path.dirname(mockFile()), { recursive: true });
  fs.writeFileSync(mockFile(), JSON.stringify(s));
}

function mockTree(accountId: string): MetaObject[] {
  const n = accountId.slice(-1);
  const st = mockState();
  const out: MetaObject[] = [];
  MOCK_CAMPAIGNS.forEach((name, ci) => {
    const cid = `23850${n}${ci}000000`;
    const cbo = name.startsWith("[CBO]") || name.startsWith("[ADV+]");
    out.push({
      level: "campaign", externalId: cid, parentExternalId: null, campaignExternalId: cid, name,
      status: st.status[cid] ?? "ACTIVE",
      dailyBudgetCents: cbo ? st.budget[cid] ?? 15000 + ci * 10000 : null,
    });
    for (let si = 0; si < 2; si++) {
      const sid = `23850${n}${ci}1${si}0000`;
      out.push({
        level: "adset", externalId: sid, parentExternalId: cid, campaignExternalId: cid,
        name: si === 0 ? "Mulheres 30-55 | Aberto" : "Mulheres 25-45 | Interesse Moda",
        status: st.status[sid] ?? "ACTIVE",
        dailyBudgetCents: cbo ? null : st.budget[sid] ?? 5000,
      });
      for (let ai = 0; ai < 2; ai++) {
        const aid = `23850${n}${ci}1${si}2${ai}00`;
        out.push({
          level: "ad", externalId: aid, parentExternalId: sid, campaignExternalId: cid,
          name: `Criativo ${ci + 1}.${si + 1}.${ai + 1} | ${ai === 0 ? "Vídeo UGC" : "Carrossel"}`,
          status: st.status[aid] ?? "ACTIVE", dailyBudgetCents: null,
        });
      }
    }
  });
  return out;
}

function eachDate(since: string, until: string): string[] {
  const out: string[] = [];
  const d = new Date(`${since}T12:00:00Z`);
  const end = new Date(`${until}T12:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

class MockMeta implements MetaProvider {
  mode = "mock" as const;

  authUrl(state: string, redirectUri: string) {
    return `${redirectUri}?${new URLSearchParams({ code: "mock-code", state })}`;
  }
  async exchangeCode() {
    return { token: "mock-token", expiresAt: new Date(Date.now() + 60 * 864e5) };
  }
  async listAdAccounts() {
    return MOCK_ACCOUNTS;
  }
  async listObjects(_token: string, accountId: string) {
    return mockTree(accountId);
  }
  async insights(_token: string, accountId: string, since: string, until: string) {
    const ads = mockTree(accountId).filter((o) => o.level === "ad");
    const parents = new Map(mockTree(accountId).map((o) => [o.externalId, o]));
    const out: MetaInsight[] = [];
    for (const date of eachDate(since, until))
      for (const ad of ads) {
        const r = seed(ad.externalId + date);
        const paused = ad.status !== "ACTIVE" || parents.get(ad.parentExternalId!)?.status !== "ACTIVE"
          || parents.get(ad.campaignExternalId)?.status !== "ACTIVE";
        const spend = paused ? 0 : Math.round(1500 + r * 9000);
        const clicks = Math.round(spend * (0.004 + r * 0.004));
        const linkClicks = Math.round(clicks * 0.8);
        const pageViews = Math.round(linkClicks * (0.6 + r * 0.25));
        out.push({
          campaignExternalId: ad.campaignExternalId,
          adsetExternalId: ad.parentExternalId!,
          adExternalId: ad.externalId,
          date,
          spendCents: spend,
          impressions: Math.round(spend * (0.35 + r * 0.2)),
          clicks,
          linkClicks,
          landingPageViews: pageViews,
          addToCart: Math.round(pageViews * (0.08 + r * 0.08)),
          initiateCheckout: Math.round(pageViews * (0.03 + r * 0.04)),
        });
      }
    return out;
  }
  async setStatus(_token: string, objectId: string, status: "ACTIVE" | "PAUSED") {
    const st = mockState();
    st.status[objectId] = status;
    saveMockState(st);
  }
  async setDailyBudget(_token: string, objectId: string, cents: number) {
    const st = mockState();
    st.budget[objectId] = cents;
    saveMockState(st);
  }
}

export function meta(): MetaProvider {
  const live = env("META_MODE") === "live" && env("META_APP_ID") && env("META_APP_SECRET");
  return live ? new LiveMeta() : new MockMeta();
}
