import "server-only";
import { query } from "./db";
import { decrypt } from "./crypto";
import { meta } from "./meta";
import { shiftDate, todayIn } from "./period";

interface AccountRow {
  id: string;
  workspace_id: string;
  external_id: string;
  timezone: string;
  access_token_enc: string | null;
}

// Puxa a árvore (status, orçamento) e o gasto de ontem e hoje. Ontem porque o Meta
// ainda ajusta o gasto do dia anterior. `days` maior serve para o 1º sync.
export async function syncAccount(acc: AccountRow, days = 2) {
  if (!acc.access_token_enc) return;
  const provider = meta();
  const token = decrypt(acc.access_token_enc);
  try {
    const objects = await provider.listObjects(token, acc.external_id);
    for (const o of objects)
      await query(
        `insert into ad_objects (workspace_id, ad_account_id, level, external_id, parent_external_id,
           campaign_external_id, name, status, daily_budget_cents)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (ad_account_id, level, external_id) do update set
           parent_external_id = excluded.parent_external_id, campaign_external_id = excluded.campaign_external_id,
           name = excluded.name, status = excluded.status, daily_budget_cents = excluded.daily_budget_cents,
           updated_at = now()`,
        [acc.workspace_id, acc.id, o.level, o.externalId, o.parentExternalId, o.campaignExternalId,
          o.name, o.status, o.dailyBudgetCents],
      );

    const until = todayIn(acc.timezone);
    const since = shiftDate(until, -(days - 1));
    const rows = await provider.insights(token, acc.external_id, since, until);
    for (const r of rows)
      await query(
        `insert into ad_insights_daily (workspace_id, ad_account_id, campaign_external_id, adset_external_id,
           ad_external_id, date, spend_cents, impressions, clicks, link_clicks, landing_page_views,
           add_to_cart, initiate_checkout)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         on conflict (ad_account_id, ad_external_id, date) do update set
           spend_cents = excluded.spend_cents, impressions = excluded.impressions, clicks = excluded.clicks,
           link_clicks = excluded.link_clicks, landing_page_views = excluded.landing_page_views,
           add_to_cart = excluded.add_to_cart, initiate_checkout = excluded.initiate_checkout,
           campaign_external_id = excluded.campaign_external_id, adset_external_id = excluded.adset_external_id,
           updated_at = now()`,
        [acc.workspace_id, acc.id, r.campaignExternalId, r.adsetExternalId, r.adExternalId, r.date,
          r.spendCents, r.impressions, r.clicks, r.linkClicks, r.landingPageViews, r.addToCart, r.initiateCheckout],
      );
    await query("update ad_accounts set last_synced_at = now(), last_sync_error = null where id = $1", [acc.id]);
  } catch (e) {
    await query("update ad_accounts set last_sync_error = $2 where id = $1", [acc.id, (e as Error).message]);
    throw e;
  }
}

export async function syncWorkspace(workspaceId: string | null, days = 2) {
  const accounts = await query<AccountRow>(
    `select id, workspace_id, external_id, timezone, access_token_enc from ad_accounts
     where enabled and ($1::uuid is null or workspace_id = $1)`,
    [workspaceId],
  );
  const errors: string[] = [];
  for (const acc of accounts) {
    try {
      await syncAccount(acc, days);
    } catch (e) {
      errors.push(`${acc.external_id}: ${(e as Error).message}`);
    }
  }
  return { accounts: accounts.length, errors };
}

// No plano grátis da Vercel o cron roda só 1x por dia. Para os números estarem frescos
// quando alguém olha, as telas de Resumo e Campanhas sincronizam antes se faz mais de 10 min.
const STALE_MS = 10 * 60e3;
const g = globalThis as unknown as { __syncing?: Map<string, Promise<unknown>> };
const running = (g.__syncing ??= new Map());

export async function syncIfStale(workspaceId: string) {
  const [row] = await query<{ stale: boolean }>(
    `select exists (select 1 from ad_accounts where workspace_id = $1 and enabled and access_token_enc is not null
       and (last_synced_at is null or last_synced_at < now() - make_interval(secs => $2))) as stale`,
    [workspaceId, STALE_MS / 1000],
  );
  if (!row?.stale) return;
  // Duas abas abertas ao mesmo tempo esperam o mesmo sync em vez de rodar dois.
  let p = running.get(workspaceId);
  if (!p) {
    p = syncWorkspace(workspaceId).finally(() => running.delete(workspaceId));
    running.set(workspaceId, p);
  }
  await p;
}
