// Taxa de rastreio: das vendas aprovadas, quantas chegaram sabendo de onde vieram.
// Função pura, testada em tests/tracking.test.ts.
//
// Cada venda cai em um de três grupos:
// - anúncio: a UTM trouxe o ID do Meta, então a venda aparece na campanha certa;
// - origem: veio com UTM, mas sem ID de anúncio (orgânico, e-mail, outro modelo de UTM);
// - sem origem: nenhuma UTM chegou. Ou foi venda direta, ou o checkout perdeu os parâmetros.
// A taxa principal é "com origem" (anúncio + origem): é o que mostra se o rastreio funciona.

export interface TrackingRow {
  key: string; // checkout (nome do webhook)
  platform: string;
  total: number;
  ad: number;
  utmOnly: number;
  none: number;
}

export type TrackingLevel = "good" | "warn" | "bad" | "few";

export interface Tracking {
  total: number;
  ad: number;
  utmOnly: number;
  none: number;
  rate: number | null; // com origem ÷ total
  adRate: number | null; // ligadas a anúncio ÷ total
  level: TrackingLevel;
  tip: string | null;
}

export const GOOD = 0.9;
export const WARN = 0.7;
export const MIN_SALES = 5;

export function levelOf(rate: number | null, total: number): TrackingLevel {
  if (rate === null || total < MIN_SALES) return "few";
  return rate >= GOOD ? "good" : rate >= WARN ? "warn" : "bad";
}

export function computeTracking(rows: TrackingRow[]): Tracking {
  const sum = (k: "total" | "ad" | "utmOnly" | "none") => rows.reduce((s, r) => s + r[k], 0);
  const total = sum("total");
  const ad = sum("ad");
  const utmOnly = sum("utmOnly");
  const none = sum("none");
  const rate = total ? (ad + utmOnly) / total : null;
  const level = levelOf(rate, total);
  const adRate = total ? ad / total : null;
  return { total, ad, utmOnly, none, rate, adRate, level, tip: tip(rows, level, adRate) };
}

// O conselho aponta o checkout que mais perde, com o que costuma resolver:
// - taxa baixa: vendas sem UTM nenhuma (o rastreio quebrou no caminho);
// - taxa boa, mas poucas ligadas a anúncio: a UTM chega sem o ID do Meta.
function tip(rows: TrackingRow[], level: TrackingLevel, adRate: number | null): string | null {
  const by = (k: "none" | "utmOnly") => [...rows].filter((r) => r[k] > 0).sort((a, b) => b[k] - a[k])[0];
  if (level === "warn" || level === "bad") {
    const w = by("none");
    if (!w) return null;
    if (w.platform === "hotmart")
      return `As vendas de ${w.key} chegam sem origem. Na Hotmart, os IDs do anúncio vão no parâmetro sck do link: confira em Conexões → UTMs.`;
    return `As vendas de ${w.key} chegam sem UTM. Confira se o link do anúncio leva os parâmetros até o checkout e se a página não os apaga no caminho (Conexões → UTMs).`;
  }
  if (level === "good" && adRate !== null && adRate < WARN) {
    const w = by("utmOnly");
    if (w) return `As vendas de ${w.key} trazem UTM, mas sem o ID do anúncio. Use o modelo de UTMs do Clickify, que inclui {{campaign.id}}, {{adset.id}} e {{ad.id}}.`;
  }
  return null;
}