import { TriangleAlert } from "lucide-react";
import { buildFunnel, MIN_CLICKS, type Funnel, type FunnelCounts } from "@/lib/funnel";
import { circuit, COL, H } from "@/lib/circuit";
import { int, percent } from "@/lib/format";
import { ButtonLink, Card, InfoTip } from "./ui";

// Funil fixo do Resumo. No computador é um circuito que afina de etapa em etapa; no celular, barras
// empilhadas (6 colunas não cabem em 390px). Nos dois: a perda entre etapas e o maior vazamento
// destacado com o que costuma resolver.
export function FunnelCard({ counts, hasAccounts, className = "" }: { counts: FunnelCounts; hasAccounts: boolean; className?: string }) {
  const f = buildFunnel(counts);
  return (
    <Card className={`flex flex-col ${className}`} aria-labelledby="funil-titulo">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 id="funil-titulo" className="text-sm font-semibold">Funil de conversão</h2>
          <p className="text-xs text-muted">Do clique no anúncio até a venda aprovada · só tráfego do Meta</p>
        </div>
        <InfoTip label="Funil de conversão">
          As 4 primeiras etapas vêm do pixel do Meta; pedidos e vendas vêm do seu checkout, só os que chegaram com UTM de anúncio.
          A porcentagem é sempre em relação aos cliques.
        </InfoTip>
      </div>

      {!hasAccounts || counts.clicks === 0 ? (
        // Sem dados: o funil aparece inteiro (colunas, etapas, zeros) com o circuito apagado,
        // e o que falta fazer logo embaixo.
        <>
          <FunnelFlow f={f} idle />
          <FunnelList f={f} />
          <div role="note" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-2 p-3 text-sm">
            {!hasAccounts ? (
              <>
                <p className="text-muted">Conecte uma conta do Meta para ver o caminho entre o clique e a venda.</p>
                <ButtonLink href="/contas" size="sm">Conectar o Meta</ButtonLink>
              </>
            ) : (
              <p className="text-muted">Nenhum clique no período. Escolha outro período ou confira se as campanhas estão ativas.</p>
            )}
          </div>
        </>
      ) : (
        <>
          <FunnelFlow f={f} />
          <FunnelList f={f} />
          {!f.enoughData ? (
            <p className="mt-4 text-sm text-muted">
              Ainda são poucos cliques ({int(counts.clicks)}) para tirar conclusão. O funil fica confiável a partir de {MIN_CLICKS}; tente um período maior.
            </p>
          ) : f.leak && f.leak.advice ? (
            <div role="note" className="mt-4 flex gap-3 rounded-md border border-border bg-surface-2 p-3 text-sm">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              <p>
                <b>Onde mais se perde: {f.leak.from.label.toLowerCase()} → {f.leak.to.label.toLowerCase()}</b> ({percent(f.leak.lost)} ficam pelo caminho).{" "}
                <span className="text-muted">{f.leak.advice}</span>
              </p>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

// Funil em circuito: trilhas que somem de etapa em etapa e pulsos de luz correndo do clique até a
// venda. Pontos e linhas com vector-effect para não deformarem quando o SVG estica na largura.
// idle = sem dados: todas as trilhas retas e apagadas, sem pulsos.
function Circuit({ f, idle = false }: { f: Funnel; idle?: boolean }) {
  const n = f.steps.length;
  const traces = circuit(f.steps.map((s, i) => (i === 0 || idle ? 1 : s.ofFirst)));
  const dot = (x: number, y: number) => `M${x},${y} h0`;
  return (
    <svg className={`pointer-events-none absolute inset-x-0 top-12 h-44 w-full ${idle ? "opacity-25" : ""}`} viewBox={`0 0 ${n * COL} ${H}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="trilha-cor" gradientUnits="userSpaceOnUse" x1="0" x2={n * COL} y1="0" y2="0">
          <stop offset="0" stopColor="var(--color-brand-mint)" />
          <stop offset="1" stopColor="var(--color-brand-green)" />
        </linearGradient>
      </defs>
      {traces.map((t) => (
        <g key={t.y}>
          {/* Quanto mais longe a trilha chega, mais forte ela aparece. */}
          <path d={t.d} fill="none" stroke="url(#trilha-cor)"
            strokeWidth={t.reachesEnd ? 2.5 : 1.5} strokeOpacity={t.reachesEnd ? 1 : 0.3 + 0.5 * (t.lastCol / Math.max(1, n - 1))}
            vectorEffect="non-scaling-stroke" />
          {/* Junções nas passagens de etapa e o ponto onde a trilha termina */}
          {Array.from({ length: t.lastCol }, (_, i) => (
            <path key={i} d={dot((i + 1) * COL, t.y)} stroke="var(--color-brand-green)" strokeOpacity={0.6} strokeWidth={4}
              strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={dot(t.end.x, t.end.y)} stroke={t.reachesEnd ? "var(--color-brand-mint)" : "var(--color-brand-green)"}
            strokeOpacity={t.reachesEnd ? 1 : 0.55} strokeWidth={t.reachesEnd ? 10 : 6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </g>
      ))}
      {/* Pulsos: um por trilha, com ritmos diferentes para não andarem em fila */}
      {!idle && <g className="circuit-pulse">
        {traces.map((t, k) => (
          <path key={t.y} d="M0,0 h0" stroke={t.reachesEnd ? "var(--color-brand-mint)" : "var(--color-brand-green)"}
            strokeWidth={t.reachesEnd ? 8 : 5} strokeLinecap="round" vectorEffect="non-scaling-stroke">
            <animateMotion path={t.d} dur={`${(2.2 + (k % 5) * 0.45 + t.lastCol * 0.5).toFixed(2)}s`}
              begin={`-${((k * 0.73) % 3).toFixed(2)}s`} repeatCount="indefinite" />
          </path>
        ))}
      </g>}
    </svg>
  );
}

function FunnelFlow({ f, idle = false }: { f: Funnel; idle?: boolean }) {
  const n = f.steps.length;
  const cols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` };
  return (
    <ol className="relative hidden md:grid" style={cols} aria-label="Etapas do funil">
      <Circuit f={f} idle={idle} />
      {f.steps.map((s, i) => {
        const isLeak = f.leak?.to.key === s.key;
        return (
          <li key={s.key} className={`relative flex flex-col items-center text-center ${i > 0 ? "border-l border-border" : ""}`}>
            <span className={`flex h-12 items-start px-1 text-xs font-semibold leading-tight ${isLeak ? "text-warning" : "text-text"}`} title={s.hint}>{s.label}</span>
            <span className="flex h-44 items-center">
              <span className="rounded-md bg-bg/85 px-2 py-0.5 text-sm font-bold tabular-nums text-text">
                {idle ? "—" : i === 0 ? "100%" : percent(s.ofFirst)}
              </span>
            </span>
            <span className="pt-2 text-base font-semibold tabular-nums">{int(s.value)}</span>
            <span className={`min-h-5 text-xs tabular-nums ${isLeak ? "font-semibold text-warning" : "text-muted"}`}>
              {idle || i === 0 || s.fromPrev === null ? "" : s.fromPrev >= 1 ? "sem perda" : `−${percent(1 - s.fromPrev)} da anterior`}
              {isLeak && <span className="block">maior vazamento</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function FunnelList({ f }: { f: Funnel }) {
  return (
    <ol className="space-y-1 md:hidden">
      {f.steps.map((s, i) => {
        const isLeak = f.leak?.to.key === s.key;
        const width = !s.ofFirst ? 0 : Math.max(2, Math.min(100, s.ofFirst * 100));
        return (
          <li key={s.key}>
            {i > 0 && s.fromPrev !== null && (
              <p className={`py-1 pl-1 text-xs tabular-nums ${isLeak ? "font-semibold text-warning" : "text-muted"}`}>
                ↓ {s.fromPrev >= 1 ? "nenhuma perda" : `perdeu ${percent(1 - s.fromPrev)} (${int(f.steps[i - 1].value - s.value)})`}
                {isLeak && " · maior vazamento"}
              </p>
            )}
            <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_4.5rem] items-center gap-3">
              <span className="truncate text-sm" title={s.hint}>{s.label}</span>
              <span className="h-7 overflow-hidden rounded-sm bg-surface-2" aria-hidden>
                <span className="block h-full rounded-sm bg-accent" style={{ width: `${width}%`, opacity: 1 - i * 0.12 }} />
              </span>
              <span className="text-right">
                <span className="block text-sm font-semibold tabular-nums">{int(s.value)}</span>
                <span className="block text-xs tabular-nums text-muted">{i === 0 ? "base" : percent(s.ofFirst)}</span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
