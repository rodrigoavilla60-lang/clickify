import "server-only";
import { query } from "./db";
import type { Workspace } from "./auth";

export const SALE_STATUS = ["approved", "pending", "refused", "refunded", "chargeback"];

export interface SaleRow {
  id: string; external_id: string; status: string; amount_cents: string; currency: string; product_name: string | null;
  ordered_at: string; approved_at: string | null; platform: string; payment_method: string | null;
  campaign: string | null; adset: string | null; ad: string | null; campaign_external_id: string | null;
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_content: string | null; utm_term: string | null;
}

// Lista de vendas do período com o anúncio de origem. s = status ou "sem-utm"; q = busca livre.
export async function listSales(ws: Workspace, from: string, to: string, s: string, q: string, limit: number): Promise<SaleRow[]> {
  const status = SALE_STATUS.includes(s) || s === "sem-utm" ? s : "";
  return query<SaleRow>(
    `select o.id, o.external_id, o.status, o.amount_cents, o.currency, o.product_name, o.ordered_at, o.approved_at,
       o.platform, o.payment_method, o.campaign_external_id,
       o.utm_source, o.utm_medium, o.utm_campaign, o.utm_content, o.utm_term,
       c.name as campaign, s.name as adset, a.name as ad
     from orders o
     left join ad_objects c on c.workspace_id = o.workspace_id and c.level = 'campaign' and c.external_id = o.campaign_external_id
     left join ad_objects s on s.workspace_id = o.workspace_id and s.level = 'adset' and s.external_id = o.adset_external_id
     left join ad_objects a on a.workspace_id = o.workspace_id and a.level = 'ad' and a.external_id = o.ad_external_id
     where o.workspace_id = $1 and (o.ordered_at at time zone $2)::date between $3 and $4
       and ($5 = '' or ($5 = 'sem-utm' and o.campaign_external_id is null) or o.status = $5)
       and ($6 = '' or o.external_id ilike '%' || $6 || '%' or o.product_name ilike '%' || $6 || '%'
            or c.name ilike '%' || $6 || '%' or a.name ilike '%' || $6 || '%')
     order by o.ordered_at desc limit $7`,
    [ws.id, ws.timezone, from, to, status, q, limit],
  );
}

export const UTM_FIELDS = ["utm_campaign", "utm_medium", "utm_content", "utm_source", "utm_term"] as const;
export type UtmField = (typeof UTM_FIELDS)[number];

export const UTM_FIELD_LABEL: Record<UtmField, string> = {
  utm_campaign: "Campanha (utm_campaign)",
  utm_medium: "Conjunto (utm_medium)",
  utm_content: "Anúncio (utm_content)",
  utm_source: "Fonte (utm_source)",
  utm_term: "Posicionamento (utm_term)",
};

// Em campanha, conjunto e anúncio a UTM traz o ID do Meta no fim ("Nome|123"): dá para juntar o gasto.
const SPEND_LEVEL: Partial<Record<UtmField, string>> = {
  utm_campaign: "campaign_external_id",
  utm_medium: "adset_external_id",
  utm_content: "ad_external_id",
};

export interface UtmRow { key: string | null; orders: number; sales: number; revenue: number; spend: number | null }

export async function utmReport(ws: Workspace, from: string, to: string, field: UtmField): Promise<UtmRow[]> {
  const spendCol = SPEND_LEVEL[field];
  // field e spendCol vêm de listas fixas acima, nunca da URL: seguros para entrar no SQL.
  const rows = await query<Record<string, string | null>>(
    `with g as (
       select o.${field} as key,
         count(*) filter (where (o.ordered_at at time zone $2)::date between $3 and $4) as orders,
         count(*) filter (where o.status = 'approved' and (o.approved_at at time zone $2)::date between $3 and $4) as sales,
         coalesce(sum(o.amount_cents) filter (where o.status = 'approved' and (o.approved_at at time zone $2)::date between $3 and $4), 0) as revenue
       from orders o where o.workspace_id = $1
       group by 1)
     ${spendCol ? `, sp as (
       select i.${spendCol} as id, sum(i.spend_cents) as spend from ad_insights_daily i
       join ad_accounts a on a.id = i.ad_account_id and a.enabled
       where i.workspace_id = $1 and i.date between $3 and $4 group by 1)` : ""}
     select g.key, g.orders, g.sales, g.revenue, ${spendCol ? "sp.spend" : "null"} as spend
     from g ${spendCol ? "left join sp on sp.id = substring(g.key from '(\\d{6,})\\s*$')" : ""}
     where g.orders > 0 or g.sales > 0
     order by g.revenue desc, g.orders desc limit 300`,
    [ws.id, ws.timezone, from, to],
  );
  return rows.map((r) => ({
    key: r.key, orders: Number(r.orders), sales: Number(r.sales), revenue: Number(r.revenue),
    spend: r.spend === null ? (spendCol ? 0 : null) : Number(r.spend),
  }));
}
