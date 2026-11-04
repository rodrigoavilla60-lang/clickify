import Link from "next/link";
import { Cable } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { query } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ConnectionsNav } from "@/components/client";
import { PlatformLogo } from "@/components/platform-logo";
import { NewWebhookForm } from "./new-webhook-form";
import { PLATFORMS, type CheckoutPlatform } from "@/lib/platforms";

export const metadata = { title: "Checkouts" };

const PLATFORM = Object.fromEntries(Object.entries(PLATFORMS).map(([k, v]) => [k, v.label])) as Record<CheckoutPlatform, string>;

// Faixa de logos: o que já conecta. Os "beta" foram feitos pela documentação e esperam a 1ª venda real.
const SUPPORTED = [
  { id: "shopify", label: "Shopify" },
  { id: "kiwify", label: "Kiwify", note: "beta" },
  { id: "hotmart", label: "Hotmart", note: "beta" },
  { id: "yampi", label: "Yampi", note: "beta" },
  { id: "eduzz", label: "Eduzz", note: "beta" },
  { id: "cartpanda", label: "Cartpanda", note: "em breve" },
  { id: "generic", label: "Outro checkout (webhook)" },
];

export default async function Integracoes() {
  const { ws } = await requireWorkspace();
  const hooks = await query<{ id: string; name: string; platform: keyof typeof PLATFORM; last_event_at: string | null; orders: number }>(
    `select w.id, w.name, w.platform, w.last_event_at,
       (select count(*) from orders o where o.webhook_id = w.id)::int as orders
     from webhooks w where w.workspace_id = $1 order by w.created_at`,
    [ws.id],
  );
  return (
    <>
      <ConnectionsNav />
      <PageHeader title="Checkouts" subtitle="Cada checkout manda as vendas para uma URL de webhook só dele." />
      <section aria-label="Checkouts que o Clickify recebe" className="mb-6 flex flex-wrap gap-2">
        {SUPPORTED.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface py-1.5 pl-1.5 pr-3 text-sm">
            <PlatformLogo id={s.id} size={26} />
            {s.label}
            {s.note && <span className="text-xs text-muted">{s.note}</span>}
          </span>
        ))}
      </section>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="p-0 md:p-0">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold md:px-6">Webhooks ativos</h2>
          {hooks.length === 0 ? (
            <EmptyState icon={<Cable className="size-8" />} title="Nenhum checkout ligado ainda">
              Crie o primeiro webhook ao lado. Leva menos de um minuto.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {hooks.map((h) => (
                <li key={h.id}>
                  <Link href={`/integracoes/${h.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-2 md:px-6">
                    <PlatformLogo id={h.platform} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold" title={h.name}>{h.name}</p>
                      <p className="text-xs text-muted">
                        {PLATFORM[h.platform]} · {h.last_event_at ? `último evento ${dateTime(h.last_event_at, ws.timezone)}` : "aguardando o primeiro evento"}
                      </p>
                    </div>
                    <span className="text-sm tabular-nums text-muted">{h.orders} vendas</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-4 text-sm font-semibold">Novo webhook</h2>
          <NewWebhookForm />
        </Card>
      </div>
    </>
  );
}
