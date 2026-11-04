// Conquistas de faturamento: degraus que a operação vai batendo. Funções puras, testadas em
// tests/milestones.test.ts. Valores em centavos.

export const TIERS = [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 5_000_000, 10_000_000].map((r) => r * 100);

export interface Progress {
  total: number;
  reached: number[]; // degraus já batidos
  next: number | null; // próximo degrau; null = bateu todos
  from: number; // degrau anterior (base da barra)
  pct: number; // 0..1 entre o degrau anterior e o próximo
  missing: number; // quanto falta para o próximo
}

export function progress(total: number): Progress {
  const reached = TIERS.filter((t) => total >= t);
  const next = TIERS.find((t) => total < t) ?? null;
  const from = reached.length ? reached[reached.length - 1] : 0;
  const pct = next === null ? 1 : Math.max(0, Math.min(1, (total - from) / (next - from)));
  return { total, reached, next, from, pct, missing: next === null ? 0 : next - total };
}

// "R$ 10 mil", "R$ 1 mi": o degrau em poucas letras, para caber na barra.
export function shortMoney(cents: number): string {
  const r = cents / 100;
  if (r >= 1_000_000) return `R$ ${(r / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (r >= 1_000) return `R$ ${(r / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `R$ ${Math.round(r).toLocaleString("pt-BR")}`;
}
