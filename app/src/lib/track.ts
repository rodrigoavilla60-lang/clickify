import "server-only";
import { one, query } from "./db";
import { randomToken } from "./crypto";
import { attribute, emptyUtms, type Attribution, type Utms } from "./normalize";

// Lado servidor do Clickify Tracking (script first-party t.js).
// O script captura UTMs + click IDs no navegador e manda para /api/t/e.
// Quando a venda chega pelo webhook com o ck_vid, findClickAttribution() recupera
// o clique de origem dentro da janela — sem depender do checkout repassar as UTMs.

// Janela de atribuição: clique até 30 dias antes do pedido vale.
export const TRACK_WINDOW_DAYS = 30;

const CLICK_KEYS = ["fbclid", "gclid", "gbraid", "wbraid", "ttclid", "msclkid"] as const;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export function newSiteKey(): string {
  return `ck_${randomToken(18)}`;
}

interface SiteRow {
  id: string;
  workspace_id: string;
}

export async function siteByKey(publicKey: string): Promise<SiteRow | null> {
  return one<SiteRow>("select id, workspace_id from tracking_sites where public_key = $1", [publicKey]);
}

function hasPaidParams(attr: Record<string, string | null>): boolean {
  for (const k of [...UTM_KEYS, ...CLICK_KEYS]) if (attr[k]) return true;
  return false;
}

// Guarda o beacon: atualiza o visitante e, se veio com parâmetro pago, registra o clique.
// Pageviews sem parâmetro só atualizam o last_seen (volume do coletor fica sob controle).
export async function recordBeacon(
  siteId: string,
  visitorKey: string,
  url: string | null,
  referrer: string | null,
  attr: Record<string, string | null> | null,
): Promise<void> {
  const v = await one<{ id: string }>(
    `insert into tracking_visitors (site_id, visitor_key) values ($1, $2)
     on conflict (site_id, visitor_key) do update set last_seen_at = now()
     returning id`,
    [siteId, visitorKey],
  );
  if (!v || !attr || !hasPaidParams(attr)) return;
  await query(
    `insert into tracking_clicks (site_id, visitor_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
       fbclid, gclid, gbraid, wbraid, ttclid, msclkid, landing_url, referrer)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [siteId, v.id, attr.utm_source, attr.utm_medium, attr.utm_campaign, attr.utm_content, attr.utm_term,
      attr.fbclid, attr.gclid, attr.gbraid, attr.wbraid, attr.ttclid, attr.msclkid, url, referrer],
  );
}

export interface ClickAttribution {
  attr: Attribution;
  utms: Utms;
  at: Date;
}

interface ClickRow {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  created_at: Date;
}

// Último clique do visitante (em qualquer site do workspace) dentro da janela.
// Usado no upsertOrder quando o pedido traz o ck_vid do script.
export async function findClickAttribution(
  workspaceId: string,
  visitorKey: string,
): Promise<ClickAttribution | null> {
  const row = await one<ClickRow>(
    `select c.utm_source, c.utm_medium, c.utm_campaign, c.utm_content, c.utm_term, c.created_at
     from tracking_clicks c
     join tracking_sites s on s.id = c.site_id
     join tracking_visitors v on v.id = c.visitor_id
     where s.workspace_id = $1 and v.visitor_key = $2
       and c.created_at > now() - ($3 || ' days')::interval
     order by c.created_at desc
     limit 1`,
    [workspaceId, visitorKey, String(TRACK_WINDOW_DAYS)],
  );
  if (!row) return null;
  const utms: Utms = { ...emptyUtms() };
  for (const k of UTM_KEYS) utms[k] = row[k];
  return { attr: attribute(utms), utms, at: row.created_at };
}
