// Catálogo dos indicadores do Resumo. Puro (sem banco): o componente cliente também usa.
// A ordem padrão é a que o dashboard sempre teve.

export const METRIC_KEYS = [
  "receita",
  "gasto",
  "lucro",
  "roas",
  "roi",
  "cpa",
  "ticket",
  "margem",
  "pendentes",
  "reembolsos",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

const MAIN: ReadonlySet<string> = new Set(["receita", "gasto", "lucro", "roas"]);

export function isMainKey(k: string): boolean {
  return MAIN.has(k);
}

export function isMetricKey(k: string): k is MetricKey {
  return (METRIC_KEYS as readonly string[]).includes(k);
}

export interface DashboardLayout {
  order: MetricKey[];
  hidden: MetricKey[];
}

export const DEFAULT_LAYOUT: DashboardLayout = {
  order: [...METRIC_KEYS],
  hidden: [],
};

// Sanitiza o que veio do banco (ou do formulário): chaves desconhecidas somem,
// as que faltam entram no fim, na ordem padrão.
export function sanitizeLayout(order: unknown, hidden: unknown): DashboardLayout {
  const o = Array.isArray(order) ? order.filter(isMetricKey) : [];
  const h = Array.isArray(hidden) ? hidden.filter(isMetricKey) : [];
  const seen = new Set(o);
  for (const k of METRIC_KEYS) if (!seen.has(k)) o.push(k);
  return { order: o, hidden: h.filter((k) => o.includes(k)) };
}
