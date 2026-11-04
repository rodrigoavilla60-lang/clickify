import Link from "next/link";
import { CircleCheck, RefreshCw, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { one } from "@/lib/db";
import { syncIfStale } from "@/lib/sync";
import { resolvePeriod, shiftDate, todayIn } from "@/lib/period";
import { derive, levelRows, totals, trackingRows, type Row } from "@/lib/metrics";
import { computeTracking } from "@/lib/tracking";
import { decide, DEFAULT_RULES, noSaleThreshold, trackingAlert, type Candidate, type Decision } from "@/lib/decisions";
import { money, percent } from "@/lib/format";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { DecisionButton, SubmitButton } from "@/components/client";
import { setObjectBudget, setObjectStatus, syncNow } from "../actions";

export const metadata = { title: "Hoje" };

const brDate = (d: string) => d.split("-").reverse().slice(0, 2).join("/");

export default async function Hoje() {
  const { ws } = await requireWorkspace();
  await syncIfStale(ws.id);
  const to = todayIn(ws.timezone);
  const from = shiftDate(to, -(DEFAULT_RULES.days - 1));

  const setup = await one<{ accounts: number; hooks: number; orders: number }>(
    `select (select count(*) from ad_accounts where workspace_id = $1 and enabled)::int as accounts,
            (select count(*) from webhooks where workspace_id = $1)::int as hooks,
            (select count(*) from orders where workspace_id = $1
               and (ordered_at at time zone $2)::date between $3 and $4)::int as orders`,
    [ws.id, ws.timezone, from, to],
  );
  if (!setup?.accounts || !setup.hooks) {
    return (
      <>
        <PageHeader title="Hoje" subtitle="O que fazer com os seus anúncios agora." />
        <Card>
          <EmptyState title="Ainda não dá para sugerir nada" action={<ButtonLink href="/onboarding">Terminar a configuração</ButtonLink>}>
            Para dizer o que escalar ou pausar, o Clickify precisa ver o gasto (conta de anúncio ligada) e as vendas (checkout ligado).
          </EmptyState>
        </Card>
      </>
    );
  }

  // Lucro médio de uma venda antes dos anúncios (30 dias): base do limite de "gastou sem vender".
  const month = resolvePeriod("30d", ws.timezone);
  const t30 = await totals(ws, month.from, month.to);
  const perSale = t30.sales > 0 ? Math.max(0, derive(ws, t30.revenue, 0, t30.sales, t30.productCost).profit / t30.sales) : null;

  const toCandidate = (level: Candidate["level"]) => (r: Row): Candidate => ({
    id: r.externalId, name: r.name, level, active: r.status === "ACTIVE", budget: r.budget,
    spend: r.spend, revenue: r.revenue, sales: r.sales,
    profit: derive(ws, r.revenue, r.spend, r.sales, r.productCost).profit,
  });
  const [campaigns, adsets, ads] = await Promise.all(
    (["campaign", "adset", "ad"] as const).map((l) => levelRows(ws, l, from, to).then((rows) => rows.map(toCandidate(l)))),
  );
  // Pausar olha anúncio por anúncio (o problema costuma ser um criativo). Escalar olha onde está o
  // orçamento: campanha (orçamento da campanha) ou conjunto. Assim a mesma coisa não aparece duas vezes.
  const pauses = decide(ads, perSale).filter((d) => d.kind === "pause");
  const scales = decide([...campaigns, ...adsets].filter((c) => c.budget !== null), perSale).filter((d) => d.kind === "scale");
  const alert = trackingAlert(ads.reduce((s, a) => s + a.spend, 0), setup.orders);
  // Rastreio caindo (últimos 7 dias): antes de mexer em anúncio, vale consertar a origem das vendas,
  // senão o Clickify sugere pausar o que está vendendo.
  const week = resolvePeriod("7d", ws.timezone);
  const tr = computeTracking(await trackingRows(ws, week.from, week.to));
  const trackingDrop: Decision | null = tr.level === "warn" || tr.level === "bad" ? {
    kind: "check", id: "rastreio", name: "Rastreio", level: "campaign", title: "Conferir o rastreio",
    reason: `Só ${percent(tr.rate)} das ${tr.total} vendas dos últimos 7 dias chegaram com origem. ${tr.tip ?? ""}`.trim(),
    impact: tr.none,
  } : null;
  const decisions: Decision[] = alert ? [alert] : [...(trackingDrop ? [trackingDrop] : []), ...pauses, ...scales].slice(0, 8);

  const t = await totals(ws, from, to);
  const d = derive(ws, t.revenue, t.spend, t.sales, t.productCost);
  const limit = noSaleThreshold(perSale);

  return (
    <>
      <PageHeader title="Hoje" subtitle={`O que fazer agora, olhando de ${brDate(from)} a ${brDate(to)}.`}
        actions={<form action={syncNow}><SubmitButton variant="secondary"><RefreshCw aria-hidden className="size-4" /> Atualizar</SubmitButton></form>} />

      <p className="mb-4 text-sm text-muted">
        Nos últimos {DEFAULT_RULES.days} dias: {money(t.spend)} em anúncios, {money(t.revenue)} em vendas e{" "}
        <strong className={d.profit >= 0 ? "text-success" : "text-danger"}>{d.profit >= 0 ? "lucro" : "prejuízo"} de {money(Math.abs(d.profit))}</strong>{" "}
        (sem despesas fixas). <Link href="/dashboard?p=7d" className="underline">Ver o resumo completo</Link>
      </p>

      {decisions.length === 0 ? (
        <Card>
          <EmptyState icon={<CircleCheck className="size-8 text-success" />} title="Nada urgente agora">
            Nenhum anúncio passou de {money(limit)} sem vender, e nada tem lucro e vendas suficientes para escalar com segurança.
            Volte mais tarde: a lista se atualiza sozinha.
          </EmptyState>
        </Card>
      ) : (
        <ol aria-label="Decisões sugeridas" className="grid gap-3">
          {decisions.map((x) => <DecisionCard key={`${x.kind}-${x.id}`} d={x} />)}
        </ol>
      )}

      <details className="mt-6 text-sm text-muted">
        <summary className="cursor-pointer">Como o Clickify escolhe essas sugestões?</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong>Pausar</strong>: anúncio ativo que gastou mais de {money(limit)} sem venda nos últimos {DEFAULT_RULES.days} dias
            (o lucro médio que uma venda deixou nos últimos 30 dias, antes dos anúncios; nunca menos de {money(DEFAULT_RULES.minSpendNoSale)}), ou que vendeu mas deu prejuízo.</li>
          <li><strong>Escalar</strong>: campanha ou conjunto com orçamento próprio, pelo menos {DEFAULT_RULES.scaleMinSales} vendas e
            lucro de {Math.round(DEFAULT_RULES.scaleMinMargin * 100)}% ou mais do faturamento. A sugestão é subir {Math.round(DEFAULT_RULES.scaleStep * 100)}%, um passo que não reinicia o aprendizado do Meta.</li>
          <li>O lucro já desconta impostos, taxas e custo dos produtos que você cadastrou em <Link href="/custos" className="underline">Custos</Link>.</li>
          <li>Nada muda sozinho: cada ação pede a sua confirmação.</li>
        </ul>
      </details>
    </>
  );
}

function DecisionCard({ d }: { d: Decision }) {
  const Icon = d.kind === "pause" ? TrendingDown : d.kind === "scale" ? TrendingUp : TriangleAlert;
  const tone = d.kind === "scale" ? "text-success" : d.kind === "pause" ? "text-danger" : "text-warning";
  return (
    <li>
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Icon aria-hidden className={`size-6 shrink-0 ${tone}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            <span className={tone}>{d.title}</span>
            {d.kind !== "check" && <>: <span className="break-words">{d.name}</span></>}
          </p>
          <p className="mt-0.5 text-sm text-muted">{d.reason}</p>
        </div>
        <div className="shrink-0">
          {d.kind === "pause" && (
            <DecisionButton id={d.id} danger label="Pausar" question={`Pausar "${d.name}" no Meta?`}
              detail="Ele para de veicular e de gastar até você ativar de novo em Campanhas."
              action={setObjectStatus.bind(null, d.id, "PAUSED")} />
          )}
          {d.kind === "scale" && d.newBudget && (
            <DecisionButton id={d.id} label={`Subir para ${money(d.newBudget)}/dia`} question={`Subir o orçamento de "${d.name}" para ${money(d.newBudget)} por dia?`}
              detail="O novo orçamento vale a partir de agora no Meta. Dá para mudar de novo em Campanhas."
              action={setObjectBudget.bind(null, d.id, d.newBudget)} />
          )}
          {d.kind === "check" && <ButtonLink href="/integracoes" variant="secondary" size="sm">Ver integrações</ButtonLink>}
        </div>
      </Card>
    </li>
  );
}
