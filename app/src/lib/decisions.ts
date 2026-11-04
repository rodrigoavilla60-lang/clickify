// Tela "Hoje": transforma os números dos últimos dias em poucas decisões, cada uma com o motivo
// e o botão de agir. Função pura (sem banco), testada em tests/decisions.test.ts.
// Regras conservadoras de propósito: na dúvida, não sugere nada. Quem decide é a pessoa.

export interface Candidate {
  id: string; // ID no Meta
  name: string;
  level: "campaign" | "adset" | "ad";
  active: boolean;
  budget: number | null; // centavos/dia, quando o orçamento está neste nível
  spend: number; // centavos no período analisado
  revenue: number;
  sales: number;
  profit: number; // centavos, já com impostos, taxas e custo de produto
}

export type DecisionKind = "pause" | "scale" | "check";

export interface Decision {
  kind: DecisionKind;
  id: string;
  name: string;
  level: Candidate["level"];
  title: string;
  reason: string;
  impact: number; // centavos: dinheiro em jogo, para ordenar
  newBudget?: number; // para "scale"
}

export interface Rules {
  days: number; // janela analisada
  minSpendNoSale: number; // gasto mínimo sem venda para sugerir pausa
  scaleMinSales: number; // vendas mínimas para sugerir escalar
  scaleMinMargin: number; // lucro/faturamento mínimo para escalar (ex.: 0,2 = 20%)
  scaleStep: number; // quanto subir o orçamento (0,2 = 20%)
}

export const DEFAULT_RULES: Rules = { days: 3, minSpendNoSale: 5000, scaleMinSales: 2, scaleMinMargin: 0.2, scaleStep: 0.2 };

// O limite de gasto sem venda é o quanto uma venda deixa de lucro antes dos anúncios (média dos
// últimos 30 dias), nunca abaixo do mínimo das regras. Passou disso sem vender, aquele anúncio já
// gastou mais do que a próxima venda conseguiria pagar.
export function noSaleThreshold(profitPerSale: number | null, rules: Rules = DEFAULT_RULES): number {
  return Math.max(rules.minSpendNoSale, profitPerSale ? Math.round(profitPerSale) : 0);
}

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const LEVEL_NAME = { campaign: "campanha", adset: "conjunto", ad: "anúncio" } as const;

export function decide(candidates: Candidate[], profitPerSale: number | null, rules: Rules = DEFAULT_RULES): Decision[] {
  const limit = noSaleThreshold(profitPerSale, rules);
  const when = rules.days === 1 ? "hoje" : `nos últimos ${rules.days} dias`;
  const out: Decision[] = [];
  for (const c of candidates) {
    if (!c.active) continue;
    if (c.sales === 0 && c.spend >= limit) {
      out.push({
        kind: "pause", id: c.id, name: c.name, level: c.level,
        title: `Pausar ${LEVEL_NAME[c.level]}`,
        reason: `Gastou ${brl(c.spend)} ${when} e não trouxe nenhuma venda. Já passou de ${brl(limit)}, o lucro que uma venda costuma deixar.`,
        impact: c.spend,
      });
    } else if (c.sales > 0 && c.profit < 0 && c.spend >= limit) {
      out.push({
        kind: "pause", id: c.id, name: c.name, level: c.level,
        title: `Pausar ${LEVEL_NAME[c.level]}`,
        reason: `Vendeu ${c.sales}x ${when}, mas deu prejuízo de ${brl(-c.profit)} depois de impostos e custo dos produtos.`,
        impact: -c.profit,
      });
    } else if (
      c.budget !== null && c.sales >= rules.scaleMinSales && c.profit > 0 && c.revenue > 0 &&
      c.profit / c.revenue >= rules.scaleMinMargin
    ) {
      const newBudget = Math.round((c.budget * (1 + rules.scaleStep)) / 100) * 100; // arredonda no real
      out.push({
        kind: "scale", id: c.id, name: c.name, level: c.level,
        title: `Escalar ${LEVEL_NAME[c.level]}`,
        reason: `Lucro de ${brl(c.profit)} ${when} com ${c.sales} vendas (margem de ${Math.round((c.profit / c.revenue) * 100)}%). Subir o orçamento de ${brl(c.budget)} para ${brl(newBudget)} por dia.`,
        impact: c.profit,
        newBudget,
      });
    }
  }
  // Pausas primeiro (dinheiro saindo agora), depois escalas; dentro de cada uma, maior impacto antes.
  return out.sort((a, b) => (a.kind === b.kind ? b.impact - a.impact : a.kind === "pause" ? -1 : 1)).slice(0, 8);
}

// Aviso de rastreio: dinheiro saindo e nenhuma venda chegando em lugar nenhum costuma ser o
// webhook ou as UTMs, não o anúncio.
export function trackingAlert(totalSpend: number, ordersReceived: number, rules: Rules = DEFAULT_RULES): Decision | null {
  if (totalSpend < rules.minSpendNoSale * 2 || ordersReceived > 0) return null;
  return {
    kind: "check", id: "tracking", name: "Rastreio", level: "campaign",
    title: "Conferir o rastreio",
    reason: `Foram ${brl(totalSpend)} em anúncios e nenhum pedido chegou do checkout. Antes de pausar campanhas, confira se o webhook e as UTMs estão funcionando.`,
    impact: totalSpend,
  };
}
