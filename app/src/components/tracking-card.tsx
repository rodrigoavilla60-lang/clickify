import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { computeTracking, MIN_SALES, type TrackingRow } from "@/lib/tracking";
import { int, percent } from "@/lib/format";
import { Card, InfoTip } from "./ui";
import { PlatformLogo } from "./platform-logo";

const LEVEL = {
  good: { label: "Ótimo", cls: "text-success" },
  warn: { label: "Atenção", cls: "text-warning" },
  bad: { label: "Baixo", cls: "text-danger" },
  few: { label: "Poucas vendas para avaliar", cls: "text-muted" },
} as const;

// Taxa de rastreio do Resumo: quanto das vendas chegou sabendo de onde veio, por checkout,
// com o que fazer quando cai.
export function TrackingCard({ rows, period }: { rows: TrackingRow[]; period: string }) {
  const t = computeTracking(rows);
  const lv = LEVEL[t.level];
  const seg = (v: number) => (t.total ? `${(v / t.total) * 100}%` : "0%");
  return (
    <Card className="mt-6" aria-labelledby="rastreio-titulo">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 id="rastreio-titulo" className="text-sm font-semibold">Taxa de rastreio</h2>
          <p className="text-xs text-muted">Das vendas aprovadas, quantas chegaram sabendo de onde vieram</p>
        </div>
        <InfoTip label="Taxa de rastreio">
          Conta as vendas que chegaram do checkout com UTM. As ligadas a um anúncio aparecem na campanha certa; as só com UTM
          vieram de outra origem (orgânico, e-mail) ou de um link sem o ID do anúncio. Sem origem pode ser venda direta ou rastreio
          quebrado no caminho. Acima de 90% está ótimo.
        </InfoTip>
      </div>

      {t.total === 0 ? (
        <p className="text-sm text-muted">Nenhuma venda aprovada no período.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,22rem)] lg:items-center">
          <div>
            <p className={`text-4xl font-bold tabular-nums ${lv.cls}`}>{percent(t.rate)}</p>
            <p className={`text-sm font-semibold ${lv.cls}`}>{lv.label}</p>
            {t.level === "few" && <p className="text-xs text-muted">A taxa fica confiável a partir de {MIN_SALES} vendas.</p>}
          </div>

          <div>
            <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <span className="bg-brand-green" style={{ width: seg(t.ad) }} />
              <span className="bg-brand-mint" style={{ width: seg(t.utmOnly) }} />
              <span className="bg-warning/70" style={{ width: seg(t.none) }} />
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
              <li className="flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full bg-brand-green" /> Ligadas a anúncio: <b className="tabular-nums">{int(t.ad)}</b></li>
              <li className="flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full bg-brand-mint" /> Só com UTM: <b className="tabular-nums">{int(t.utmOnly)}</b></li>
              <li className="flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full bg-warning/70" /> Sem origem: <b className="tabular-nums">{int(t.none)}</b></li>
            </ul>
            {t.ad + t.utmOnly < t.total && (
              <Link href={`/vendas?${new URLSearchParams({ p: period, s: "sem-utm" })}`} className="mt-2 inline-block text-xs text-accent underline">
                Ver as vendas não atribuídas
              </Link>
            )}
          </div>

          <table className="w-full text-sm">
            <caption className="sr-only">Rastreio por checkout</caption>
            <thead className="text-left text-xs text-muted">
              <tr>
                <th scope="col" className="pb-2 font-medium">Checkout</th>
                <th scope="col" className="pb-2 text-right font-medium">Vendas</th>
                <th scope="col" className="pb-2 text-right font-medium">Com origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const rr = (r.ad + r.utmOnly) / r.total;
                return (
                  <tr key={r.key}>
                    <th scope="row" className="py-1.5 text-left font-normal">
                      <span className="flex min-w-0 items-center gap-2"><PlatformLogo id={r.platform} size={20} /><span className="truncate" title={r.key}>{r.key}</span></span>
                    </th>
                    <td className="py-1.5 text-right tabular-nums">{int(r.total)}</td>
                    <td className={`py-1.5 text-right tabular-nums ${rr >= 0.9 ? "text-success" : rr >= 0.7 ? "text-warning" : "text-danger"}`}>{percent(rr)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {t.tip && (
        <div role="note" className="mt-4 flex gap-3 rounded-md border border-border bg-surface-2 p-3 text-sm">
          <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>{t.tip}</p>
        </div>
      )}
    </Card>
  );
}
