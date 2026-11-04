import "server-only";
import { query } from "./db";
import type { Workspace } from "./auth";
import type { Level } from "./meta";
import type { FunnelCounts } from "./funnel";
import { computeProfit, daysBetween, proRata, type CostSettings, type Profit } from "./profit";
import type { TrackingRow } from "./tracking";

export interface Totals {
  revenue: number; // centavos
  spend: number;
  sales: number;
  productCost: number;
  pending: number;
  pendingAmount: number;
  refunds: number;
  refundAmount: number;
  unattributed: number;
}

export type Derived = Profit & { costs: number };

type CostWs = Pick<Workspace, "tax_rate_bps" | "gateway_fee_bps" | "ad_tax_bps">;

export function costSettings(ws: CostWs): CostSettings {
  return { saleTaxBps: ws.tax_rate_bps, gatewayFeeBps: ws.gateway_fee_bps, adTaxBps: ws.ad_tax_bps };
}

export function derive(ws: CostWs, revenue: number, spend: number, sales: number, productCost = 0, fixedCost = 0): Derived {
  const p = computeProfit(costSettings(ws), { revenue, spend, sales, productCost, fixedCost });
  return { ...p, costs: p.costsTotal };
}

const n = (v: unknown) => Number(v ?? 0);

// Custo de produto + frete de um pedido: o cadastrado para o produto ou, sem cadastro, o padrão.
// Usado com "left join product_costs pc" e "join workspaces w" já na consulta.
const ORDER_COST = `(coalesce(pc.cost_cents, w.default_product_cost_cents) + coalesce(pc.shipping_cents, w.default_shipping_cents))`;
const COST_JOINS = `join workspaces w on w.id = o.workspace_id
  left join product_costs pc on pc.workspace_id = o.workspace_id and lower(pc.product_name) = lower(o.product_name)`;

// ---------------- Filtros do Resumo ----------------
export interface Filters {
  account?: string; // ad_accounts.id
  product?: string;
  platform?: string; // checkout
  source?: string; // utm_source; "__none__" = vendas sem UTM
}

export const NO_SOURCE = "__none__";

// Condições extras para consultas de pedidos (alias "o"). Os valores vão como parâmetros a partir de $start.
export function orderFilter(f: Filters, start: number): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${start + params.length - 1}`;
  };
  if (f.account)
    parts.push(`o.campaign_external_id in (select external_id from ad_objects where level = 'campaign' and ad_account_id = ${p(f.account)})`);
  if (f.product) parts.push(`lower(o.product_name) = lower(${p(f.product)})`);
  if (f.platform) parts.push(`o.platform = ${p(f.platform)}`);
  if (f.source === NO_SOURCE) parts.push("o.utm_source is null");
  else if (f.source) parts.push(`o.utm_source = ${p(f.source)}`);
  return { sql: parts.map((s) => ` and ${s}`).join(""), params };
}

// O gasto só dá para filtrar por conta: o Meta não separa gasto por produto, checkout ou fonte.
export function spendFilter(f: Filters, start: number): { sql: string; params: unknown[] } {
  return f.account ? { sql: ` and i.ad_account_id = $${start}`, params: [f.account] } : { sql: "", params: [] };
}

export function spendIsTotal(f: Filters): boolean {
  return !!(f.product || f.platform || f.source);
}

export async function fixedCostFor(ws: Workspace, from: string, to: string): Promise<number> {
  const [r] = await query<{ monthly: string }>(
    "select coalesce(sum(monthly_cents),0) as monthly from fixed_expenses where workspace_id = $1",
    [ws.id],
  );
  return proRata(n(r.monthly), daysBetween(from, to));
}

export async function totals(ws: Workspace, from: string, to: string, f: Filters = {}): Promise<Totals> {
  const of = orderFilter(f, 5);
  const sf = spendFilter(f, 4);
  const [o] = await query<Record<string, string>>(
    `select
       coalesce(sum(amount_cents) filter (where status = 'approved'
         and (approved_at at time zone $2)::date between $3 and $4), 0) as revenue,
       count(*) filter (where status = 'approved' and (approved_at at time zone $2)::date between $3 and $4) as sales,
       count(*) filter (where status = 'approved' and campaign_external_id is null
         and (approved_at at time zone $2)::date between $3 and $4) as unattributed,
       count(*) filter (where status = 'pending' and (ordered_at at time zone $2)::date between $3 and $4) as pending,
       coalesce(sum(amount_cents) filter (where status = 'pending'
         and (ordered_at at time zone $2)::date between $3 and $4), 0) as pending_amount,
       count(*) filter (where status in ('refunded','chargeback')
         and (status_changed_at at time zone $2)::date between $3 and $4) as refunds,
       coalesce(sum(amount_cents) filter (where status in ('refunded','chargeback')
         and (status_changed_at at time zone $2)::date between $3 and $4), 0) as refund_amount,
       coalesce(sum(${ORDER_COST}) filter (where status = 'approved'
         and (approved_at at time zone $2)::date between $3 and $4), 0) as product_cost
     from orders o ${COST_JOINS} where o.workspace_id = $1${of.sql}`,
    [ws.id, ws.timezone, from, to, ...of.params],
  );
  const [s] = await query<{ spend: string }>(
    `select coalesce(sum(i.spend_cents), 0) as spend from ad_insights_daily i
     join ad_accounts a on a.id = i.ad_account_id and a.enabled
     where i.workspace_id = $1 and i.date between $2 and $3${sf.sql}`,
    [ws.id, from, to, ...sf.params],
  );
  return {
    revenue: n(o.revenue), spend: n(s.spend), sales: n(o.sales), productCost: n(o.product_cost), pending: n(o.pending),
    pendingAmount: n(o.pending_amount), refunds: n(o.refunds), refundAmount: n(o.refund_amount),
    unattributed: n(o.unattributed),
  };
}

// Funil: as 4 primeiras etapas vêm do Meta, as 2 últimas do checkout. Só pedidos com UTM de
// anúncio entram, porque os cliques também são só de anúncio.
export async function funnelCounts(ws: Workspace, from: string, to: string, f: Filters = {}): Promise<FunnelCounts> {
  const sf = spendFilter(f, 4);
  const of = orderFilter(f, 5);
  const [m] = await query<Record<string, string>>(
    `select coalesce(sum(i.link_clicks),0) as clicks, coalesce(sum(i.landing_page_views),0) as page_views,
            coalesce(sum(i.add_to_cart),0) as add_to_cart, coalesce(sum(i.initiate_checkout),0) as checkout
     from ad_insights_daily i join ad_accounts a on a.id = i.ad_account_id and a.enabled
     where i.workspace_id = $1 and i.date between $2 and $3${sf.sql}`,
    [ws.id, from, to, ...sf.params],
  );
  const [o] = await query<Record<string, string>>(
    `select
       count(*) filter (where (o.ordered_at at time zone $2)::date between $3 and $4) as orders,
       count(*) filter (where o.status = 'approved' and (o.approved_at at time zone $2)::date between $3 and $4) as approved
     from orders o where o.workspace_id = $1 and o.campaign_external_id is not null${of.sql}`,
    [ws.id, ws.timezone, from, to, ...of.params],
  );
  return {
    clicks: n(m.clicks), pageViews: n(m.page_views), addToCart: n(m.add_to_cart), checkout: n(m.checkout),
    orders: n(o.orders), approved: n(o.approved),
  };
}

export async function dailySeries(ws: Workspace, from: string, to: string, f: Filters = {}) {
  const of = orderFilter(f, 5);
  const sf = spendFilter(f, 5 + of.params.length);
  return query<{ date: string; revenue: string; spend: string }>(
    `with days as (select generate_series($3::date, $4::date, interval '1 day')::date as date),
     rev as (select (o.approved_at at time zone $2)::date as date, sum(o.amount_cents) as revenue from orders o
             where o.workspace_id = $1 and o.status = 'approved'${of.sql} group by 1),
     sp as (select i.date, sum(i.spend_cents) as spend from ad_insights_daily i
            join ad_accounts a on a.id = i.ad_account_id and a.enabled
            where i.workspace_id = $1${sf.sql} group by 1)
     select to_char(d.date, 'YYYY-MM-DD') as date, coalesce(rev.revenue, 0) as revenue, coalesce(sp.spend, 0) as spend
     from days d left join rev on rev.date = d.date left join sp on sp.date = d.date order by d.date`,
    [ws.id, ws.timezone, from, to, ...of.params, ...sf.params],
  );
}

// ---------------- Quebras do Resumo: produto, fonte, forma de pagamento ----------------
export interface Slice { key: string; sales: number; revenue: number }
export interface PaymentSlice extends Slice { approved: number; decided: number } // decided = aprovadas + recusadas

export async function breakdowns(ws: Workspace, from: string, to: string, f: Filters = {}) {
  const of = orderFilter(f, 5);
  const args = [ws.id, ws.timezone, from, to, ...of.params];
  const approvedIn = `o.status = 'approved' and (o.approved_at at time zone $2)::date between $3 and $4`;
  const by = (expr: string) =>
    query<{ key: string; sales: string; revenue: string }>(
      `select ${expr} as key, count(*) as sales, sum(o.amount_cents) as revenue from orders o
       where o.workspace_id = $1 and ${approvedIn}${of.sql}
       group by 1 order by sum(o.amount_cents) desc limit 8`,
      args,
    );
  const [products, sources] = await Promise.all([
    by("coalesce(o.product_name, 'Sem nome')"),
    by(`coalesce(o.utm_source, '${NO_SOURCE}')`),
  ]);
  // Taxa de aprovação: dos pedidos criados no período já decididos (aprovados ou recusados),
  // quantos foram aprovados. Pendentes ainda não contam.
  const payments = await query<Record<string, string>>(
    `select coalesce(o.payment_method, 'other') as key,
       count(*) filter (where ${approvedIn}) as sales,
       coalesce(sum(o.amount_cents) filter (where ${approvedIn}), 0) as revenue,
       count(*) filter (where (o.ordered_at at time zone $2)::date between $3 and $4 and o.status in ('approved','refunded','chargeback')) as approved,
       count(*) filter (where (o.ordered_at at time zone $2)::date between $3 and $4 and o.status <> 'pending') as decided
     from orders o where o.workspace_id = $1${of.sql}
     group by 1 order by 1`,
    args,
  );
  const slice = (r: { key: string; sales: string; revenue: string }): Slice => ({ key: r.key, sales: n(r.sales), revenue: n(r.revenue) });
  return {
    products: products.map(slice),
    sources: sources.map(slice),
    payments: payments.map((r) => ({ ...slice(r as never), approved: n(r.approved), decided: n(r.decided) })) as PaymentSlice[],
  };
}

// Taxa de rastreio por checkout: vendas aprovadas com ID de anúncio, só com UTM, ou sem nada.
export async function trackingRows(ws: Workspace, from: string, to: string, f: Filters = {}): Promise<TrackingRow[]> {
  const of = orderFilter(f, 5);
  const rows = await query<Record<string, string>>(
    `select coalesce(w.name, o.platform) as key, o.platform,
       count(*) as total,
       count(*) filter (where o.campaign_external_id is not null) as ad,
       count(*) filter (where o.campaign_external_id is null and coalesce(o.utm_source, o.utm_campaign) is not null) as utm_only,
       count(*) filter (where o.campaign_external_id is null and coalesce(o.utm_source, o.utm_campaign) is null) as none
     from orders o left join webhooks w on w.id = o.webhook_id
     where o.workspace_id = $1 and o.status = 'approved' and (o.approved_at at time zone $2)::date between $3 and $4${of.sql}
     group by 1, 2 order by count(*) desc`,
    [ws.id, ws.timezone, from, to, ...of.params],
  );
  return rows.map((r) => ({ key: r.key, platform: r.platform, total: n(r.total), ad: n(r.ad), utmOnly: n(r.utm_only), none: n(r.none) }));
}

export async function filterOptions(ws: Workspace) {
  const [accounts, products, platforms, sources] = await Promise.all([
    query<{ id: string; name: string }>("select id, name from ad_accounts where workspace_id = $1 and enabled order by name", [ws.id]),
    query<{ v: string }>(
      `select product_name as v from orders where workspace_id = $1 and product_name is not null
       group by 1 order by count(*) desc limit 50`, [ws.id]),
    query<{ v: string }>("select distinct platform as v from orders where workspace_id = $1 order by 1", [ws.id]),
    query<{ v: string }>(
      `select utm_source as v from orders where workspace_id = $1 and utm_source is not null
       group by 1 order by count(*) desc limit 30`, [ws.id]),
  ]);
  return { accounts, products: products.map((r) => r.v), platforms: platforms.map((r) => r.v), sources: sources.map((r) => r.v) };
}

export interface Row {
  externalId: string;
  name: string;
  status: string;
  budget: number | null;
  accountName: string;
  spend: number;
  revenue: number;
  sales: number;
  productCost: number;
  clicks: number;
  impressions: number;
  linkClicks: number;
  pageViews: number;
  addToCart: number;
  checkout: number;
}

export interface RowFilter {
  search?: string;
  status?: "ACTIVE" | "PAUSED";
}

const KEY: Record<Level, string> = {
  campaign: "campaign_external_id",
  adset: "adset_external_id",
  ad: "ad_external_id",
};

// Tabela de campanhas, conjuntos ou anúncios. `parent` filtra o drill-down.
export async function levelRows(ws: Workspace, level: Level, from: string, to: string, parent?: string, rf: RowFilter = {}): Promise<Row[]> {
  const k = KEY[level];
  const rows = await query<Record<string, string | null>>(
    `with sp as (
       select i.${k} as id, sum(i.spend_cents) as spend, sum(i.clicks) as clicks, sum(i.impressions) as impressions,
         sum(i.link_clicks) as link_clicks, sum(i.landing_page_views) as page_views,
         sum(i.add_to_cart) as add_to_cart, sum(i.initiate_checkout) as checkout
       from ad_insights_daily i where i.workspace_id = $1 and i.date between $2 and $3 group by 1),
     rv as (
       select o.${k} as id, sum(o.amount_cents) as revenue, count(*) as sales, sum(${ORDER_COST}) as product_cost
       from orders o ${COST_JOINS}
       where o.workspace_id = $1 and o.status = 'approved' and (o.approved_at at time zone $4)::date between $2 and $3
       group by 1)
     select o.external_id, o.name, o.status, o.daily_budget_cents, a.name as account_name,
       coalesce(sp.spend,0) as spend, coalesce(sp.clicks,0) as clicks, coalesce(sp.impressions,0) as impressions,
       coalesce(rv.revenue,0) as revenue, coalesce(rv.sales,0) as sales, coalesce(rv.product_cost,0) as product_cost,
       coalesce(sp.link_clicks,0) as link_clicks, coalesce(sp.page_views,0) as page_views,
       coalesce(sp.add_to_cart,0) as add_to_cart, coalesce(sp.checkout,0) as checkout
     from ad_objects o
     join ad_accounts a on a.id = o.ad_account_id and a.enabled
     left join sp on sp.id = o.external_id
     left join rv on rv.id = o.external_id
     where o.workspace_id = $1 and o.level = $5 and o.status in ('ACTIVE','PAUSED')
       and ($6::text is null or o.parent_external_id = $6)
       and ($7::text is null or o.name ilike '%' || $7 || '%')
       and ($8::text is null or o.status = $8)
     order by coalesce(rv.revenue,0) - coalesce(sp.spend,0) desc, o.name`,
    [ws.id, from, to, ws.timezone, level, parent ?? null, rf.search?.trim() || null, rf.status ?? null],
  );
  return rows.map((r) => ({
    externalId: r.external_id!, name: r.name!, status: r.status!,
    budget: r.daily_budget_cents === null ? null : n(r.daily_budget_cents),
    accountName: r.account_name!, spend: n(r.spend), revenue: n(r.revenue), sales: n(r.sales),
    productCost: n(r.product_cost), clicks: n(r.clicks), impressions: n(r.impressions),
    linkClicks: n(r.link_clicks), pageViews: n(r.page_views), addToCart: n(r.add_to_cart), checkout: n(r.checkout),
  }));
}
