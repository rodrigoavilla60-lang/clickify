// Períodos sempre no fuso do workspace. Datas como YYYY-MM-DD.

export const PERIODS = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "mes", label: "Este mês" },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];

export function todayIn(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now);
}

function shift(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function resolvePeriod(key: string | undefined, tz: string, now = new Date()) {
  const p = (PERIODS.find((x) => x.key === key)?.key ?? "hoje") as PeriodKey;
  const today = todayIn(tz, now);
  switch (p) {
    case "ontem":
      return { key: p, from: shift(today, -1), to: shift(today, -1) };
    case "7d":
      return { key: p, from: shift(today, -6), to: today };
    case "30d":
      return { key: p, from: shift(today, -29), to: today };
    case "mes":
      return { key: p, from: `${today.slice(0, 8)}01`, to: today };
    default:
      return { key: p, from: today, to: today };
  }
}

export { shift as shiftDate };

// O Meta às vezes devolve nomes antigos de fuso ("Brazil/East" é o mesmo que "America/Sao_Paulo").
export function sameTimeZone(a: string, b: string): boolean {
  const canon = (z: string) => {
    try {
      return new Intl.DateTimeFormat("en", { timeZone: z }).resolvedOptions().timeZone;
    } catch {
      return z;
    }
  };
  return canon(a) === canon(b);
}
