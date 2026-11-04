// Lucro real: faturamento menos tudo o que a operação paga. Função pura (sem banco), testada em
// tests/profit.test.ts. Cada custo vira uma linha, que é o "de onde veio isso?" da tela.

export interface CostSettings {
  saleTaxBps: number; // imposto sobre a venda (% do faturamento, em pontos-base)
  gatewayFeeBps: number; // taxa do gateway/checkout (% do faturamento)
  adTaxBps: number; // imposto cobrado pelo Meta sobre o anúncio (% do gasto)
}

export interface ProfitInputs {
  revenue: number; // centavos, vendas aprovadas
  spend: number; // centavos, gasto com anúncios
  sales: number; // número de vendas aprovadas
  productCost?: number; // custo dos produtos + frete das vendas aprovadas
  fixedCost?: number; // despesas fixas proporcionais ao período
}

export type CostKey = "spend" | "adTax" | "saleTax" | "gatewayFee" | "productCost" | "fixedCost";

export interface CostLine {
  key: CostKey;
  label: string;
  amount: number;
  how: string; // explicação curta da conta, em português simples
}

export interface Profit {
  revenue: number;
  lines: CostLine[];
  costsTotal: number; // tudo menos o gasto com anúncios
  profit: number;
  roas: number | null;
  roi: number | null;
  cpa: number | null;
  margin: number | null;
}

const pct = (bps: number) => `${(bps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

export function computeProfit(s: CostSettings, i: ProfitInputs): Profit {
  const productCost = Math.max(0, Math.round(i.productCost ?? 0));
  const fixedCost = Math.max(0, Math.round(i.fixedCost ?? 0));
  const all: CostLine[] = [
    { key: "spend", label: "Gasto com anúncios", amount: i.spend, how: "O que o Meta cobrou no período." },
    { key: "adTax", label: "Imposto sobre o anúncio", amount: Math.round((i.spend * s.adTaxBps) / 10000), how: `${pct(s.adTaxBps)} sobre o gasto com anúncios.` },
    { key: "saleTax", label: "Imposto sobre a venda", amount: Math.round((i.revenue * s.saleTaxBps) / 10000), how: `${pct(s.saleTaxBps)} sobre o faturamento.` },
    { key: "gatewayFee", label: "Taxa do gateway", amount: Math.round((i.revenue * s.gatewayFeeBps) / 10000), how: `${pct(s.gatewayFeeBps)} sobre o faturamento.` },
    { key: "productCost", label: "Custo dos produtos e frete", amount: productCost, how: "Soma do custo cadastrado de cada venda aprovada." },
    { key: "fixedCost", label: "Despesas fixas", amount: fixedCost, how: "Parte das despesas do mês que cabe nos dias escolhidos." },
  ];
  // Linha zerada só aparece se for o gasto: o resto some para não poluir a conta.
  const lines = all.filter((l) => l.key === "spend" || l.amount > 0);
  const total = all.reduce((t, l) => t + l.amount, 0);
  const profit = i.revenue - total;
  return {
    revenue: i.revenue,
    lines,
    costsTotal: total - i.spend,
    profit,
    roas: i.spend > 0 ? i.revenue / i.spend : null,
    roi: i.spend > 0 ? profit / i.spend : null,
    cpa: i.sales > 0 ? i.spend / i.sales : null,
    margin: i.revenue > 0 ? profit / i.revenue : null,
  };
}

// Despesa fixa mensal proporcional aos dias do período (mês médio de 365/12 dias).
export function proRata(monthlyCents: number, days: number): number {
  return Math.round((monthlyCents * 12 * days) / 365);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 864e5) + 1;
}
