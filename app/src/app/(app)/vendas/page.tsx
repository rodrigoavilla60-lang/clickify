import Link from "next/link";
import { Download, Receipt } from "lucide-react";
import { requireWorkspace, type Workspace } from "@/lib/auth";
import { query } from "@/lib/db";
import { resolvePeriod } from "@/lib/period";
import { dateTime, int, money, ratio } from "@/lib/format";
import { isPlatform, PLATFORMS } from "@/lib/platforms";
import { listSales, SALE_STATUS as STATUS, UTM_FIELD_LABEL, UTM_FIELDS, utmReport, type UtmField } from "@/lib/sales";
import { buttonClass, ButtonLink, Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { PeriodPicker } from "@/components/period-picker";

export const metadata = { title: "Vendas" };

const FILTERS = [
  { key: "", label: "Todas" },
  { key: "approved", label: "Aprovadas" },
  { key: "pending", label: "Pendentes" },
  { key: "refunded", label: "Reembolsadas" },
  { key: "sem-utm", label: "Não atribuídas" },
];

export default async function Vendas({ searchParams }: { searchParams: Promise<{ p?: string; s?: string; q?: string; ver?: string; por?: string }> }) {
  const { ws } = await requireWorkspace();
  const sp = await searchParams;
  const period = resolvePeriod(sp.p, ws.timezone);
  const s = STATUS.includes(sp.s ?? "") || sp.s === "sem-utm" ? sp.s! : "";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const byUtm = sp.ver === "utm";
  const por: UtmField = (UTM_FIELDS as readonly string[]).includes(sp.por ?? "") ? (sp.por as UtmField) : "utm_campaign";

  const rows = byUtm ? [] : await listSales(ws, period.from, period.to, s, q, 200);
  const hasAny = rows.length > 0 || (await query("select 1 from orders where workspace_id = $1 limit 1", [ws.id])).length > 0;
  const tabs = [
    { key: "lista", label: "Lista de pedidos", href: `/vendas?${new URLSearchParams({ p: period.key })}` },
    { key: "utm", label: "Por UTM", href: `/vendas?${new URLSearchParams({ p: period.key, ver: "utm", por })}` },
  ];
  const exportHref = byUtm
    ? `/api/export/utm?${new URLSearchParams({ p: period.key, por })}`
    : `/api/export/vendas?${new URLSearchParams({ p: period.key, s, q })}`;

  return (
    <>
      <PageHeader title="Vendas" subtitle="Cada pedido que o checkout mandou, com o anúncio de origem."
        actions={
          <>
            <PeriodPicker current={period.key} base="/vendas" keep={byUtm ? { ver: "utm", por } : { s, q }} />
            {hasAny && (
              <a href={exportHref} download className={buttonClass("secondary", "sm")}>
                <Download aria-hidden className="size-4" /> Exportar planilha
              </a>
            )}
          </>
        } />
      <nav aria-label="Visão" className="mb-4 flex gap-1 border-b border-border">
        {tabs.map((t) => {
          const on = (t.key === "utm") === byUtm;
          return (
            <Link key={t.key} href={t.href} aria-current={on ? "page" : undefined}
              className={`-mb-px border-b-2 px-4 py-2 text-sm ${on ? "border-accent font-semibold" : "border-transparent text-muted hover:text-text"}`}>
              {t.label}
            </Link>
          );
        })}
      </nav>
      {byUtm ? <UtmView ws={ws} period={period} por={por} /> : (
      <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav aria-label="Filtrar por status" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Link key={f.key} href={`/vendas?${new URLSearchParams({ p: period.key, s: f.key, q })}`}
              aria-current={s === f.key ? "true" : undefined}
              className={`rounded-full border px-3 py-1 text-xs ${s === f.key ? "border-accent text-text" : "border-border text-muted hover:text-text"}`}>
              {f.label}
            </Link>
          ))}
        </nav>
        <form className="ml-auto flex gap-2" role="search">
          <input type="hidden" name="p" value={period.key} />
          <input type="hidden" name="s" value={s} />
          <label htmlFor="q" className="sr-only">Buscar venda</label>
          <input id="q" name="q" defaultValue={q} placeholder="Pedido, produto, campanha…" className="h-8 w-56 rounded-md border border-border-input bg-surface px-3 text-sm" />
        </form>
      </div>
      <Card className="overflow-hidden p-0 md:p-0">
        {!hasAny ? (
          <EmptyState icon={<Receipt className="size-8" />} title="Nenhuma venda recebida ainda"
            action={<ButtonLink href="/integracoes">Ligar um checkout</ButtonLink>}>
            Assim que o checkout mandar o primeiro pedido, ele aparece aqui com a campanha de origem.
          </EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState title="Nada com esses filtros">Tente outro período ou limpe a busca.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-border text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Quando</th>
                  <th scope="col" className="px-4 py-3 font-medium">Pedido</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Valor</th>
                  <th scope="col" className="px-4 py-3 font-medium">Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top hover:bg-surface-2">
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">{dateTime(r.ordered_at, ws.timezone)}</td>
                    <td className="max-w-[220px] px-4 py-3">
                      <p className="truncate font-medium" title={r.external_id}>{r.external_id}</p>
                      <p className="truncate text-xs text-muted" title={r.product_name ?? ""}>{r.product_name ?? "—"} · {isPlatform(r.platform) ? PLATFORMS[r.platform].label.replace(/^Outro checkout.*/, "Webhook") : r.platform}</p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{money(Number(r.amount_cents), r.currency)}</td>
                    <td className="max-w-[320px] px-4 py-3">
                      {r.campaign_external_id ? (
                        <>
                          <p className="truncate" title={r.campaign ?? r.campaign_external_id}>{r.campaign ?? `Campanha ${r.campaign_external_id}`}</p>
                          <p className="truncate text-xs text-muted" title={`${r.adset ?? ""} › ${r.ad ?? ""}`}>{r.adset ?? "—"} › {r.ad ?? "—"}</p>
                        </>
                      ) : (
                        <p className="text-xs text-warning">{r.utm_source ? `Não atribuída (origem: ${r.utm_source})` : "Não atribuída (sem UTM)"}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {rows.length === 200 && <p className="mt-2 text-xs text-muted">Mostrando as 200 mais recentes. A planilha exportada traz todas.</p>}
      </>
      )}
    </>
  );
}

// Relatório por UTM: agrupa as vendas por um campo da UTM. Em campanha, conjunto e anúncio
// junta o gasto pelo ID do Meta que vem na UTM, e calcula o ROAS.
async function UtmView({ ws, period, por }: { ws: Workspace; period: { key: string; from: string; to: string }; por: UtmField }) {
  const rows = await utmReport(ws, period.from, period.to, por);
  const withSpend = rows.some((r) => r.spend !== null);
  return (
    <>
      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <input type="hidden" name="p" value={period.key} />
        <input type="hidden" name="ver" value="utm" />
        <label htmlFor="por" className="text-sm text-muted">Agrupar por</label>
        <select id="por" name="por" defaultValue={por} className="h-9 rounded-md border border-border-input bg-surface px-2 text-sm">
          {UTM_FIELDS.map((f) => <option key={f} value={f}>{UTM_FIELD_LABEL[f]}</option>)}
        </select>
        <button type="submit" className="h-9 rounded-md border border-border bg-surface-2 px-3 text-sm font-semibold hover:border-border-input">Ver</button>
      </form>
      <Card className="overflow-hidden p-0 md:p-0">
        {rows.length === 0 ? (
          <EmptyState title="Nenhuma venda no período">Escolha outro período.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">{UTM_FIELD_LABEL[por]}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Pedidos</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Vendas</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Faturamento</th>
                  {withSpend && <th scope="col" className="px-4 py-3 text-right font-medium">Gasto</th>}
                  {withSpend && <th scope="col" className="px-4 py-3 text-right font-medium">ROAS</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.key ?? "(sem)"} className="hover:bg-surface-2">
                    <th scope="row" className="max-w-[360px] px-4 py-3 text-left font-normal">
                      <span className={`block truncate ${r.key ? "" : "text-warning"}`} title={r.key ?? ""}>{r.key ?? "(sem UTM)"}</span>
                    </th>
                    <td className="px-4 py-3 text-right tabular-nums">{int(r.orders)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{int(r.sales)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(r.revenue)}</td>
                    {withSpend && <td className="px-4 py-3 text-right tabular-nums">{r.spend === null ? "—" : money(r.spend)}</td>}
                    {withSpend && <td className="px-4 py-3 text-right tabular-nums">{r.spend ? ratio(r.revenue / r.spend) : "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {withSpend && <p className="mt-2 text-xs text-muted">O gasto é encontrado pelo ID do Meta que vem no fim da UTM (ex.: &quot;Nome|123…&quot;). UTM sem ID aparece com gasto zero.</p>}
    </>
  );
}
