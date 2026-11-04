import "server-only";
import { one, query } from "./db";
import {
  DEFAULT_LAYOUT,
  sanitizeLayout,
  type DashboardLayout,
} from "./dashboard-layout";

export type { DashboardLayout };

export async function getDashboardLayout(workspaceId: string): Promise<DashboardLayout> {
  const row = await one<{ metric_order: string[]; hidden: string[] }>(
    "select metric_order, hidden from dashboard_layouts where workspace_id = $1",
    [workspaceId],
  );
  if (!row) return DEFAULT_LAYOUT;
  return sanitizeLayout(row.metric_order, row.hidden);
}

export async function saveDashboardLayoutDb(workspaceId: string, layout: DashboardLayout): Promise<void> {
  await query(
    `insert into dashboard_layouts (workspace_id, metric_order, hidden)
     values ($1, $2, $3)
     on conflict (workspace_id)
     do update set metric_order = excluded.metric_order, hidden = excluded.hidden, updated_at = now()`,
    [workspaceId, layout.order, layout.hidden],
  );
}
