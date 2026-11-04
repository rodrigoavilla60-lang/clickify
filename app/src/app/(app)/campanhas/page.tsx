import Link from "next/link";
import { Columns3, Download, Megaphone, RefreshCw } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { one } from "@/lib/db";
import { syncIfStale } from "@/lib/sync";
import { resolvePeriod } from "@/lib/period";
import { derive, levelRows, type Row } from "@/lib/metrics";
import { COLUMNS, columnByKey, parseColumns, type BaseNumbers, type Column, type Format } from "@/lib/columns";
import type { Level } from "@/lib/meta";
import { int, money, percent, ratio } from "@/lib/format";
import { buttonClass, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { BudgetEditor, StatusToggle, SubmitButton } from "@/components/client";
import { PeriodPicker } from "@/components/period-picker";
import { setObjectBudget, setObjectStatus, syncNow } from "../actions";

export const metadata = { title: "Campanhas" };

const LEVEL_LABEL: Record<Level, string> = { campaign: "Campanhas", adset: "Conjuntos", ad: "Anúncios" };

type Search = {
  p?: string; nivel?: string; pai?: string; ordem?: string; dir?: string; q?: string; status?: string;
  cols?: string; c?: string | string[];
};

function fmt(v: number | null, f: Format): string {
  if (v === null || !Number.isFinite(v)) return "—";
  if (f === "money") return money(Math.round(v));
  if (f === "int") return int(Math.round(v));
  if (f === "ratio") return ratio(v);
  return percent(v);
}

export default async function Campanhas({ searchParams }: { searchParams: Promise<Search> }) {
  const { ws } = await requireWorkspace();
  await syncIfStale(ws.id);
  const sp = await searchParams;
  const period = resolvePeriod(sp.p, ws.timezone);
  const level: Level = sp.nivel === "adset" || sp.nivel === "ad" ? sp.nivel : "campaign";
  const parent = level !== "campaign" && sp.pai && /^\d+$/.test(sp.pai) ? sp.pai : undefined;
  // "c" vem do seletor de colunas (vários checkboxes); "cols" é o mesmo, já junto, nos links.
  const cols = parseColumns(Array.isArray(sp.c) ? sp.c.join(",") : sp.c ?? sp.cols);
  const visible = cols.map(columnByKey).filter((c): c is Column => !!c);
  const sort = sp.ordem === "name" || COLUMNS.some((c) => c.key === sp.ordem) ? sp.ordem! : "profit";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const search = (sp.q ?? "").slice(0, 80);
  const status = sp.status === "ACTIVE" || sp.status === "PAUSED" ? sp.status : undefined;

  const parentRow = parent
    ? await one<{ name: string; level: string; parent_external_id: string | null }>(
        "select name, level, parent_external_id from ad_objects where workspace_id = $1 and external_id = $2",
        [ws.id, parent],
      )
    : null;
  const accounts = await one<{ n: number }>("select count(*)::int as n from ad_accounts where workspace_id = $1 and enabled", [ws.id]);

  const raw = await levelRows(ws, level, period.from, period.to, parent, { search, status });
  const base = (r: Pick<Row, "spend" | "revenue" | "sales" | "productCost" | "impressions" | "linkClicks" | "pageViews" | "addToCart" | "checkout">): BaseNumbers => ({
    ...r, profit: derive(ws, r.revenue, r.spend, r.sales, r.productCost).profit,
  });
  const rows = raw.map((r) => ({ ...r, b: base(r) }));
  const sortCol = columnByKey(sort);
  rows.sort((a, b) => {
    if (sort === "name") return (dir === "asc" ? 1 : -1) * a.name.localeCompare(b.name, "pt-BR");
    // Sem valor (ex.: CPA sem venda) vai sempre para o fim, nos dois sentidos.
    const x = sortCol!.value(a.b), y = sortCol!.value(b.b);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return dir === "asc" ? x - y : y - x;
  });
  const sum = rows.reduce(
    (t, r) => ({
      spend: t.spend + r.spend, revenue: t.revenue + r.revenue, sales: t.sales + r.sales, productCost: t.productCost + r.productCost,
      impressions: t.impressions + r.impressions, linkClicks: t.linkClicks + r.linkClicks, pageViews: t.pageViews + r.pageViews,
      addToCart: t.addToCart + r.addToCart, checkout: t.checkout + r.checkout,
    }),
    { spend: 0, revenue: 0, sales: 0, productCost: 0, impressions: 0, linkClicks: 0, pageViews: 0, addToCart: 0, checkout: 0 },
  );
  const totalB = base(sum);

  const state = { p: period.key, nivel: level, pai: parent, ordem: sort, dir, q: search || undefined, status, cols: cols.join(",") };
  const href = (over: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...state, ...over })) if (v) q.set(k, v);
    return `/campanhas?${q}`;
  };
  const childLevel: Level | null = level === "campaign" ? "adset" : level === "adset" ? "ad" : null;
  const tone = (c: Column, v: number | null) =>
    c.key === "profit" && v !== null ? (v > 0 ? "text-success" : v < 0 ? "text-danger" : "") : "";

  return (
    <>
      <PageHeader
        title={parentRow ? parentRow.name : LEVEL_LABEL[level]}
        subtitle={
          parentRow ? (
            <Link className="hover:text-text" href={parentRow.level === "adset" && parentRow.parent_external_id
              ? href({ nivel: "adset", pai: parentRow.parent_external_id }) : href({ nivel: "campaign", pai: undefined })}>
              ← voltar
            </Link>
          ) : "Todas as plataformas numa tabela só: gasto x vendas aprovadas no checkout. Ordene por lucro e aja direto daqui."
        }
        actions={
          <>
            <PeriodPicker current={period.key} base="/campanhas" keep={{ ...state, p: undefined }} />
            <form action={syncNow}><SubmitButton variant="secondary"><RefreshCw aria-hidden className="size-4" /><span className="sr-only md:not-sr-only">Atualizar</span></SubmitButton></form>
            {rows.length > 0 && (
              <a href={`/api/export/campanhas?${new URLSearchParams(Object.entries(state).filter((e): e is [string, string] => !!e[1]))}`}
                download className={buttonClass("secondary", "md")}>
                <Download aria-hidden className="size-4" /><span className="sr-only md:not-sr-only">Exportar planilha</span>
              </a>
            )}
          </>
        }
      />
      {!parent && (
        <nav aria-label="Nível" className="mb-4 flex gap-1 border-b border-border">
          {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
            <Link key={l} href={href({ nivel: l, pai: undefined })} aria-current={l === level ? "page" : undefined}
              className={`-mb-px border-b-2 px-4 py-2 text-sm ${l === level ? "border-accent font-semibold" : "border-transparent text-muted hover:text-text"}`}>
              {LEVEL_LABEL[l]}
            </Link>
          ))}
        </nav>
      )}

      <div className="mb-3 flex flex-wrap items-start gap-2">
        <form method="get" role="search" aria-label="Buscar campanhas" className="flex flex-wrap gap-2">
          {Object.entries({ ...state, q: undefined, status: undefined }).map(([k, v]) => v ? <input key={k} type="hidden" name={k} value={v} /> : null)}
          <label htmlFor="busca" className="sr-only">Buscar pelo nome</label>
          <input id="busca" name="q" defaultValue={search} placeholder="Buscar pelo nome…" className="h-9 w-56 rounded-md border border-border-input bg-surface px-3 text-sm" />
          <label htmlFor="status" className="sr-only">Status</label>
          <select id="status" name="status" defaultValue={status ?? ""} className="h-9 rounded-md border border-border-input bg-surface px-2 text-sm">
            <option value="">Ativas e pausadas</option>
            <option value="ACTIVE">Só ativas</option>
            <option value="PAUSED">Só pausadas</option>
          </select>
          <button type="submit" className="h-9 rounded-md border border-border bg-surface-2 px-3 text-sm font-semibold hover:border-border-input">Buscar</button>
        </form>

        <details className="relative ml-auto">
          <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-surface-2 px-3 text-sm font-semibold hover:border-border-input">
            <Columns3 aria-hidden className="size-4" /> Colunas
          </summary>
          <form method="get" aria-label="Escolher colunas" className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-border bg-surface p-4 shadow-pop">
            {Object.entries({ ...state, cols: undefined }).map(([k, v]) => v ? <input key={k} type="hidden" name={k} value={v} /> : null)}
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Mostrar na tabela</legend>
              <div className="max-h-72 space-y-1.5 overflow-y-auto">
                {COLUMNS.map((c) => (
                  <label key={c.key} className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name="c" value={c.key} defaultChecked={cols.includes(c.key)} className="mt-1 accent-[var(--c-accent)]" />
                    <span><span className="font-medium">{c.label}</span><span className="block text-xs text-muted">{c.explain}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="submit" className="mt-3 h-9 w-full rounded-md bg-accent text-sm font-semibold text-on-accent">Aplicar</button>
          </form>
        </details>
      </div>

      <Card className="overflow-hidden p-0 md:p-0">
        {!accounts?.n ? (
          <EmptyState icon={<Megaphone className="size-8" />} title="Conecte o Meta para ver suas campanhas"
            action={<ButtonLink href="/contas">Conectar conta</ButtonLink>}>
            Puxamos as campanhas, o status, o orçamento e o gasto de cada anúncio.
          </EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Megaphone className="size-8" />}
            title={search || status ? "Nada com essa busca" : `Nenhum${level === "campaign" ? "a campanha" : level === "adset" ? " conjunto" : " anúncio"} ativo ou pausado`}>
            {search || status ? "Tente outro nome ou status." : "Se você acabou de criar no Meta, clique em Atualizar."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: `${420 + visible.length * 110}px` }}>
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th scope="col" className="w-12 px-4 py-3 text-left font-medium"><span className="sr-only">Ativo</span></th>
                  <SortTh label="Nome" k="name" sort={sort} dir={dir} href={href} align="left" />
                  {level !== "ad" && <th scope="col" className="px-4 py-3 text-right font-medium">Orçamento/dia</th>}
                  {visible.map((c) => <SortTh key={c.key} label={c.label} title={c.explain} k={c.key} sort={sort} dir={dir} href={href} first={c.higherIsBetter ? "desc" : "asc"} />)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.externalId} className="hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <StatusToggle id={r.externalId} name={r.name} active={r.status === "ACTIVE"} action={setObjectStatus} />
                    </td>
                    <td className="max-w-[340px] px-4 py-3">
                      {childLevel ? (
                        <Link href={href({ nivel: childLevel, pai: r.externalId })} className="block truncate font-medium hover:text-accent" title={r.name}>{r.name}</Link>
                      ) : <span className="block truncate font-medium" title={r.name}>{r.name}</span>}
                      <span className="block truncate text-xs text-muted"><span className="font-medium text-text/80">Meta</span> · {r.accountName}</span>
                    </td>
                    {level !== "ad" && (
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {r.budget !== null ? <BudgetEditor id={r.externalId} cents={r.budget} action={setObjectBudget} />
                          : <span className="text-xs text-muted">{level === "campaign" ? "no conjunto" : "na campanha"}</span>}
                      </td>
                    )}
                    {visible.map((c) => {
                      const v = c.value(r.b);
                      return <Num key={c.key} v={fmt(v, c.format)} tone={tone(c, v)} />;
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border bg-surface-2 font-semibold">
                <tr>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3">Total ({rows.length})</td>
                  {level !== "ad" && <td />}
                  {visible.map((c) => {
                    const v = c.value(totalB);
                    return <Num key={c.key} v={fmt(v, c.format)} tone={tone(c, v)} />;
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
      <details className="mt-3 text-xs text-muted">
        <summary className="cursor-pointer hover:text-text">O que é cada coluna?</summary>
        <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {visible.map((c) => <div key={c.key}><dt className="inline font-semibold text-text">{c.label}:</dt> <dd className="inline">{c.explain}</dd></div>)}
        </dl>
      </details>
      <p className="mt-2 text-xs text-muted">Lucro = faturamento − gasto − impostos, taxa do gateway e custo dos produtos (tela Custos). Despesas fixas e vendas sem UTM entram só no Resumo.</p>
    </>
  );
}

function Num({ v, tone = "" }: { v: string; tone?: string }) {
  return <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${tone}`}>{v}</td>;
}

function SortTh({ label, title, k, sort, dir, href, align = "right", first = "desc" }: {
  label: string; title?: string; k: string; sort: string; dir: string; align?: "left" | "right"; first?: "asc" | "desc";
  href: (o: Record<string, string | undefined>) => string;
}) {
  const active = sort === k;
  const next = active ? (dir === "desc" ? "asc" : "desc") : first;
  return (
    <th scope="col" title={title} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} className={`px-4 py-3 font-medium ${align === "left" ? "text-left" : "text-right"}`}>
      <Link href={href({ ordem: k, dir: next })} className={`hover:text-text ${active ? "text-text" : ""}`}>
        {label}{active ? (dir === "asc" ? " ↑" : " ↓") : ""}
      </Link>
    </th>
  );
}
