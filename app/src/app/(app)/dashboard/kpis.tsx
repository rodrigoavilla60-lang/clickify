"use client";

import { useActionState, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  GripVertical,
  Pencil,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { Card, FieldError, InfoTip, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { isMainKey, sanitizeLayout } from "@/lib/dashboard-layout";
import {
  resetDashboardLayout,
  saveDashboardLayout,
  type LayoutState,
} from "../actions";

export interface MetricDatum {
  key: string;
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  tip?: string;
  small: boolean;
  profitRevenue?: string;
  profitLines?: { key: string; label: string; amount: string; how?: string }[];
}

// Os indicadores do Resumo, com modo de personalização: arrastar (ou setas) para
// reordenar, olho para mostrar/ocultar. O layout é salvo por workspace.
export function DashboardKpis({ metrics, initialOrder, initialHidden, funnel }: {
  metrics: MetricDatum[];
  initialOrder: string[];
  initialHidden: string[];
  funnel: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState(initialOrder);
  const [hidden, setHidden] = useState(initialHidden);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [state, action] = useActionState<LayoutState, FormData>(saveDashboardLayout, {});

  // Depois de salvar (ou restaurar), o servidor manda o layout novo: sincroniza.
  const syncKey = `${initialOrder.join(",")}|${initialHidden.join(",")}`;
  useEffect(() => {
    const s = sanitizeLayout(initialOrder, initialHidden);
    setOrder(s.order);
    setHidden(s.hidden);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey]);
  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);

  const byKey = new Map(metrics.map((m) => [m.key, m]));
  const visible = (main: boolean) =>
    order
      .filter((k) => !hidden.includes(k) && isMainKey(k) === main)
      .map((k) => byKey.get(k))
      .filter((m): m is MetricDatum => !!m);
  const hiddenMetrics = order.map((k) => byKey.get(k)).filter((m): m is MetricDatum => !!m && hidden.includes(m.key));

  function move(key: string, dir: -1 | 1) {
    setOrder((o) => {
      const i = o.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= o.length) return o;
      const next = [...o];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function dropOn(target: string) {
    if (!dragKey || dragKey === target) return;
    setOrder((o) => {
      const next = o.filter((k) => k !== dragKey);
      next.splice(next.indexOf(target), 0, dragKey);
      return next;
    });
  }
  function toggleHidden(key: string) {
    setHidden((h) => (h.includes(key) ? h.filter((k) => k !== key) : [...h, key]));
  }

  function card(m: MetricDatum) {
    const controls = editing && (
      <span className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => move(m.key, -1)} aria-label={`Mover ${m.label} para trás`}
          className="rounded p-1 text-muted hover:bg-surface-2 hover:text-text">
          <ArrowUp className="size-3.5" />
        </button>
        <button type="button" onClick={() => move(m.key, 1)} aria-label={`Mover ${m.label} para frente`}
          className="rounded p-1 text-muted hover:bg-surface-2 hover:text-text">
          <ArrowDown className="size-3.5" />
        </button>
        <button type="button" onClick={() => toggleHidden(m.key)}
          aria-label={hidden.includes(m.key) ? `Mostrar ${m.label}` : `Ocultar ${m.label}`}
          aria-pressed={hidden.includes(m.key)}
          className="rounded p-1 text-muted hover:bg-surface-2 hover:text-text">
          {hidden.includes(m.key) ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </span>
    );
    return (
      <div
        key={m.key}
        draggable={editing}
        onDragStart={(e) => {
          setDragKey(m.key);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => setDragKey(null)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          dropOn(m.key);
        }}
        className={dragKey === m.key ? "opacity-40" : ""}
      >
        <Card className={`h-full p-4 md:p-5 ${editing ? "ring-2 ring-accent/60" : ""}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted">
              {editing && (
                <GripVertical aria-hidden className="size-3.5 shrink-0 cursor-grab text-muted" />
              )}
              <span className="truncate">{m.label}</span>
            </p>
            <span className="flex shrink-0 items-center gap-0.5">
              {m.tip && <InfoTip label={m.label}>{m.tip}</InfoTip>}
              {controls}
            </span>
          </div>
          <p className={`mt-1 font-bold tabular-nums ${m.small ? "text-lg" : "text-xl md:text-[28px] md:leading-[34px]"} ${m.tone ?? ""}`}>
            {m.value}
          </p>
          {m.hint && <p className="mt-1 text-xs text-muted">{m.hint}</p>}
          {m.profitLines && (
            <details className="mt-1 text-xs">
              <summary className="cursor-pointer text-muted hover:text-text">De onde veio isso?</summary>
              <dl className="mt-2 space-y-1.5">
                <div className="flex justify-between gap-2"><dt>Faturamento</dt><dd className="tabular-nums">{m.profitRevenue}</dd></div>
                {m.profitLines.map((l) => (
                  <div key={l.key} className="flex justify-between gap-2" title={l.how}>
                    <dt className="text-muted">− {l.label}</dt>
                    <dd className="tabular-nums text-muted">{l.amount}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-2 border-t border-border pt-1.5 font-semibold">
                  <dt>= Lucro</dt><dd className={`tabular-nums ${m.tone ?? ""}`}>{m.value}</dd>
                </div>
              </dl>
              <Link href="/custos" className="mt-2 inline-block text-accent underline">Ajustar custos</Link>
            </details>
          )}
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        {editing ? (
          <button type="button" onClick={() => { setEditing(false); setOrder(initialOrder); setHidden(initialHidden); }}
            className="h-9 rounded-md border border-border px-3 text-sm font-semibold hover:border-border-input">
            Cancelar
          </button>
        ) : (
          <button type="button" onClick={() => setEditing(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold hover:border-border-input">
            <Pencil className="size-3.5" /> Personalizar
          </button>
        )}
      </div>

      {state.ok && <Notice tone="success">{state.ok}</Notice>}
      <FieldError id="kpi-err">{state.error}</FieldError>

      <section aria-label="Indicadores principais" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {visible(true).map(card)}
      </section>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {funnel}
        {visible(false).map(card)}
      </div>

      {editing && (
        <Card className="mt-3 p-4 md:p-5">
          <h2 className="mb-1 text-sm font-semibold">Editar layout</h2>
          <p className="mb-4 text-xs text-muted">
            Arraste os cartões (ou use as setas) para reordenar. O olho oculta sem apagar —
            o indicador continua nos relatórios.
          </p>
          {hiddenMetrics.length > 0 && (
            <>
              <h3 className="mb-2 text-xs font-semibold text-muted">Ocultos</h3>
              <div className="mb-4 flex flex-wrap gap-2">
                {hiddenMetrics.map((m) => (
                  <button key={m.key} type="button" onClick={() => toggleHidden(m.key)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:border-border-input">
                    <Eye className="size-3.5" /> {m.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <form action={action}>
              <input type="hidden" name="order" value={JSON.stringify(order)} />
              <input type="hidden" name="hidden" value={JSON.stringify(hidden)} />
              <SubmitButton>Salvar layout</SubmitButton>
            </form>
            <form action={resetDashboardLayout}>
              <SubmitButton variant="secondary">
                <span className="inline-flex items-center gap-1.5"><RotateCcw className="size-3.5" /> Restaurar padrão</span>
              </SubmitButton>
            </form>
          </div>
        </Card>
      )}
    </>
  );
}
