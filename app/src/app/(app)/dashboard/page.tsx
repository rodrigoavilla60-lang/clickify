import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { one } from "@/lib/db";
import { syncIfStale } from "@/lib/sync";
import { resolvePeriod } from "@/lib/period";
import {
  breakdowns, dailySeries, derive, filterOptions, fixedCostFor, funnelCounts, NO_SOURCE, spendIsTotal, totals, trackingRows,
  type Filters, type PaymentSlice,
} from "@/lib/metrics";
import { PLATFORMS, isPlatform } from "@/lib/platforms";
import { FunnelCard } from "@/components/funnel-card";
import { TrackingCard } from "@/components/tracking-card";
import { int, money, percent, ratio } from "@/lib/format";
import { ButtonLink, Card, Notice, PageHeader } from "@/components/ui";
import { PeriodPicker } from "@/components/period-picker";
import { getDashboardLayout } from "@/lib/dashboard";
import { DashboardKpis, type MetricDatum } from "./kpis";

export const metadata = { title: "Resumo" };

type Search = { p?: string; conta?: string; produto?: string; checkout?: string; fonte?: string };

export default async function Dashboard({ searchParams }: { searchParams: Promise<Search> }) {
  const { ws } = await requireWorkspace();
  await syncIfStale(ws.id);
  const sp = await searchParams;
  const period = resolvePeriod(sp.p, ws.timezone);
  const options = await filterOptions(ws);
  // Só aceita valores que existem para este workspace: nada vindo da URL vai cru para a consulta.
  const filters: Filters = {
    account: options.accounts.some((a) => a.id === sp.conta) ? sp.conta : undefined,
    product: sp.produto && options.products.includes(sp.produto) ? sp.produto : undefined,
    platform: sp.checkout && options.platforms.includes(sp.checkout) ? sp.checkout : undefined,
    source: sp.fonte && (sp.fonte === NO_SOURCE || options.sources.includes(sp.fonte)) ? sp.fonte : undefined,
  };
  const filtered = Object.values(filters).some(Boolean);
  const t = await totals(ws, period.from, period.to, filters);
  // Despesa fixa é da operação inteira: num recorte (só um produto, só uma fonte) ela distorceria o lucro.
  const fixed = filtered ? 0 : await fixedCostFor(ws, period.from, period.to);
  const d = derive(ws, t.revenue, t.spend, t.sales, t.productCost, fixed);
  const series = period.from === period.to ? [] : await dailySeries(ws, period.from, period.to, filters);
  const funnel = await funnelCounts(ws, period.from, period.to, filters);
  const parts = await breakdowns(ws, period.from, period.to, filters);
  const tracking = await trackingRows(ws, period.from, period.to, filters);
  const keep = { conta: filters.account, produto: filters.product, checkout: filters.platform, fonte: filters.source };
  const setup = await one<{ accounts: number; hooks: number }>(
    `select (select count(*) from ad_accounts where workspace_id = $1 and enabled)::int as accounts,
            (select count(*) from webhooks where workspace_id = $1)::int as hooks`,
    [ws.id],
  );
  const incomplete = !setup?.accounts || !setup?.hooks;
  const profitTone = d.profit > 0 ? "text-success" : d.profit < 0 ? "text-danger" : "";
  const layout = await getDashboardLayout(ws.id);
  const metrics: MetricDatum[] = [
    {
      key: "receita", label: "Faturamento", value: money(t.revenue), small: false,
      hint: `${int(t.sales)} ${t.sales === 1 ? "venda aprovada" : "vendas aprovadas"}`,
      tip: "Soma das vendas aprovadas no período, pelo valor que o checkout mandou. Reembolsos saem quando chegam.",
    },
    {
      key: "gasto", label: "Gasto com anúncios", value: money(t.spend), small: false,
      tip: "Quanto o Meta cobrou das contas ligadas no período. O imposto sobre o anúncio entra no lucro, não aqui.",
    },
    {
      key: "lucro", label: "Lucro", value: money(d.profit), tone: profitTone, small: false,
      profitRevenue: money(d.revenue),
      profitLines: d.lines.map((l) => ({ key: l.key, label: l.label, amount: money(l.amount), how: l.how })),
    },
    {
      key: "roas", label: "ROAS", value: ratio(d.roas), small: false,
      hint: d.roas === null ? "Sem gasto no período" : `R$ 1 em anúncio voltou ${money(Math.round(d.roas * 100))}`,
      tip: "Retorno sobre o gasto com anúncios: faturamento ÷ gasto. Acima de 1 o anúncio paga a si mesmo, mas ainda não conta impostos e custos.",
    },
    {
      key: "roi", label: "ROI", value: d.roi === null ? "—" : percent(d.roi), small: true,
      tone: d.roi !== null && d.roi < 0 ? "text-danger" : "", hint: "Lucro ÷ gasto com anúncios",
      tip: "Quanto sobrou de lucro para cada real investido em anúncio, já descontando impostos, taxas e custo dos produtos. 50% = cada R$ 1 gasto deixou R$ 0,50 de lucro.",
    },
    {
      key: "cpa", label: "CPA", value: d.cpa === null ? "—" : money(Math.round(d.cpa)), small: true,
      hint: "Custo por venda",
      tip: "Gasto com anúncios ÷ vendas aprovadas. Se passar do lucro que uma venda deixa, a campanha está no prejuízo.",
    },
    {
      key: "ticket", label: "Ticket médio", value: t.sales ? money(Math.round(t.revenue / t.sales)) : "—", small: true,
      hint: "Valor médio por venda",
      tip: "Faturamento ÷ vendas aprovadas. Subir o ticket (kit, brinde, order bump) deixa mais espaço para o CPA.",
    },
    {
      key: "margem", label: "Margem", value: percent(d.margin), small: true,
      hint: "Do faturamento, virou lucro",
      tip: "Lucro ÷ faturamento. Mostra quanto de cada venda fica com você depois de anúncio, impostos, taxas e produto.",
    },
    {
      key: "pendentes", label: "Pendentes", value: money(t.pendingAmount), small: true,
      hint: `${int(t.pending)} ${t.pending === 1 ? "pedido aguardando" : "pedidos aguardando"}`,
      tip: "Pedidos feitos e ainda não pagos (Pix ou boleto em aberto, cartão em análise). Entram no faturamento quando forem aprovados.",
    },
    {
      key: "reembolsos", label: "Reembolsos", value: money(t.refundAmount), small: true,
      hint: `${int(t.refunds)} ${t.refunds === 1 ? "pedido" : "pedidos"}, com chargebacks`,
      tip: "Vendas devolvidas ou contestadas no cartão (chargeback) no período. Já saíram do faturamento.",
    },
  ];

  return (
    <>
      <PageHeader title="Resumo" subtitle={`${ws.name} · ${period.from === period.to ? period.from.split("-").reverse().join("/") : `${period.from.split("-").reverse().join("/")} a ${period.to.split("-").reverse().join("/")}`}`}
        actions={<PeriodPicker current={period.key} base="/dashboard" keep={keep} />} />
      <FilterBar period={period.key} options={options} filters={filters} />
      {spendIsTotal(filters) && (
        <Notice tone="info">
          Filtro de produto, checkout ou fonte: o gasto com anúncios continua sendo o total, porque o Meta não separa gasto por produto.
          Use o filtro de conta para recortar o gasto. Despesas fixas ficam de fora em qualquer filtro.
        </Notice>
      )}
      {incomplete && (
        <Notice tone="warning">
          Faltam passos para os números ficarem completos. <Link href="/onboarding" className="underline">Terminar a configuração</Link>
        </Notice>
      )}

      <DashboardKpis
        metrics={metrics}
        initialOrder={layout.order}
        initialHidden={layout.hidden}
        funnel={<FunnelCard counts={funnel} hasAccounts={!!setup?.accounts} className="col-span-2 lg:row-span-3" />}
      />

      {t.unattributed > 0 && (
        <p className="mt-3 text-sm text-warning">
          {int(t.unattributed)} {t.unattributed === 1 ? "venda aprovada chegou" : "vendas aprovadas chegaram"} sem UTM e não {t.unattributed === 1 ? "aparece" : "aparecem"} nas campanhas.{" "}
          <Link className="underline" href={`/vendas?p=${period.key}&s=sem-utm`}>Ver quais</Link>
        </p>
      )}

      <TrackingCard rows={tracking} period={period.key} />

      <section aria-label="De onde vêm as vendas" className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-3">
        <SliceCard title="Vendas por produto" empty="Nenhuma venda aprovada no período." rows={parts.products.map((s) => ({ ...s, label: s.key }))} />
        <SliceCard title="Vendas por fonte" empty="Nenhuma venda aprovada no período."
          rows={parts.sources.map((s) => ({ ...s, label: s.key === NO_SOURCE ? "Sem UTM" : s.key }))} />
        <PaymentCard rows={parts.payments} />
      </section>

      {series.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-4 text-sm font-semibold">Faturamento x gasto por dia</h2>
          <Bars data={series.map((s) => ({ date: s.date, revenue: Number(s.revenue), spend: Number(s.spend) }))} />
        </Card>
      )}

      {t.revenue === 0 && t.spend === 0 && !incomplete && (
        <Card className="mt-6 text-center">
          <p className="font-semibold">Sem movimento nesse período</p>
          <p className="mt-1 text-sm text-muted">Escolha outro período ou confira se as campanhas estão ativas.</p>
          <div className="mt-4"><ButtonLink href="/campanhas" variant="secondary">Ver campanhas</ButtonLink></div>
        </Card>
      )}
    </>
  );
}

// Filtros como formulário GET: o link fica compartilhável e funciona sem JavaScript.
function FilterBar({ period, options, filters }: {
  period: string;
  options: { accounts: { id: string; name: string }[]; products: string[]; platforms: string[]; sources: string[] };
  filters: Filters;
}) {
  const select = "h-9 w-full rounded-md border border-border-input bg-surface px-2 text-sm";
  const active = Object.values(filters).some(Boolean);
  return (
    <form method="get" role="search" aria-label="Filtros do resumo" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
      <input type="hidden" name="p" value={period} />
      <label className="sr-only" htmlFor="f-conta">Conta de anúncio</label>
      <select id="f-conta" name="conta" defaultValue={filters.account ?? ""} className={select}>
        <option value="">Todas as contas</option>
        {options.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <label className="sr-only" htmlFor="f-produto">Produto</label>
      <select id="f-produto" name="produto" defaultValue={filters.product ?? ""} className={select}>
        <option value="">Todos os produtos</option>
        {options.products.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <label className="sr-only" htmlFor="f-checkout">Checkout</label>
      <select id="f-checkout" name="checkout" defaultValue={filters.platform ?? ""} className={select}>
        <option value="">Todos os checkouts</option>
        {options.platforms.map((p) => <option key={p} value={p}>{isPlatform(p) ? PLATFORMS[p].label : p}</option>)}
      </select>
      <label className="sr-only" htmlFor="f-fonte">Fonte</label>
      <select id="f-fonte" name="fonte" defaultValue={filters.source ?? ""} className={select}>
        <option value="">Todas as fontes</option>
        {options.sources.map((s) => <option key={s} value={s}>{s}</option>)}
        <option value={NO_SOURCE}>Sem UTM</option>
      </select>
      <div className="col-span-2 flex gap-2 sm:col-span-1">
        <button type="submit" className="h-9 flex-1 rounded-md bg-surface-2 px-3 text-sm font-semibold border border-border hover:border-border-input">Filtrar</button>
        {active && <Link href={`/dashboard?p=${period}`} className="inline-flex h-9 items-center px-2 text-sm text-muted hover:text-text">Limpar</Link>}
      </div>
    </form>
  );
}

function SliceCard({ title, rows, empty }: { title: string; empty: string; rows: { label: string; sales: number; revenue: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <Card className="p-4 md:p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-muted">{empty}</p> : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex justify-between gap-2 text-sm">
                <span className="min-w-0 truncate" title={r.label}>{r.label}</span>
                <span className="shrink-0 tabular-nums">{money(r.revenue)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${(r.revenue / max) * 100}%` }} />
                </span>
                <span className="w-16 text-right text-xs tabular-nums text-muted">{int(r.sales)} {r.sales === 1 ? "venda" : "vendas"}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const PAY_LABEL: Record<string, string> = { pix: "Pix", card: "Cartão", boleto: "Boleto", other: "Outros" };

function PaymentCard({ rows }: { rows: PaymentSlice[] }) {
  const order = ["pix", "card", "boleto", "other"];
  const list = order.map((k) => rows.find((r) => r.key === k)).filter((r): r is PaymentSlice => !!r && (r.sales > 0 || r.decided > 0));
  return (
    <Card className="p-4 md:p-5">
      <h2 className="mb-3 text-sm font-semibold">Formas de pagamento</h2>
      {list.length === 0 ? <p className="text-sm text-muted">Sem pedidos no período.</p> : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th scope="col" className="pb-2 font-medium">Forma</th>
              <th scope="col" className="pb-2 text-right font-medium">Faturamento</th>
              <th scope="col" className="pb-2 text-right font-medium" title="Dos pedidos já decididos, quantos foram pagos">Aprovação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.map((r) => (
              <tr key={r.key}>
                <th scope="row" className="py-2 text-left font-normal">{PAY_LABEL[r.key] ?? r.key}</th>
                <td className="py-2 text-right tabular-nums">{money(r.revenue)}</td>
                <td className="py-2 text-right tabular-nums">{r.decided ? percent(r.approved / r.decided) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-xs text-muted">Aprovação = pedidos pagos ÷ pedidos já decididos (pagos ou recusados). Pendentes ainda não contam.</p>
    </Card>
  );
}

// Barras simples em SVG: sem lib de gráfico para 30 pontos.
function Bars({ data }: { data: { date: string; revenue: number; spend: number }[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.revenue, d.spend]));
  const w = 100 / data.length;
  return (
    <figure>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-48 w-full" role="img"
        aria-label={`Gráfico de ${data.length} dias. Maior faturamento: ${money(Math.max(...data.map((d) => d.revenue)))}.`}>
        {data.map((d, i) => (
          <g key={d.date}>
            <rect x={i * w + w * 0.12} width={w * 0.36} y={40 - (d.revenue / max) * 38} height={(d.revenue / max) * 38} className="fill-accent">
              <title>{`${d.date.split("-").reverse().join("/")}: faturamento ${money(d.revenue)}`}</title>
            </rect>
            <rect x={i * w + w * 0.52} width={w * 0.36} y={40 - (d.spend / max) * 38} height={(d.spend / max) * 38} className="fill-border-input">
              <title>{`${d.date.split("-").reverse().join("/")}: gasto ${money(d.spend)}`}</title>
            </rect>
          </g>
        ))}
      </svg>
      <figcaption className="mt-3 flex gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-accent" />Faturamento</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-border-input" />Gasto</span>
      </figcaption>
    </figure>
  );
}
