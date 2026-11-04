// Catálogo das colunas da tabela de campanhas. Cada métrica tem nome em português, uma frase
// curta dizendo o que é, e a conta. A mesma conta vale para a linha e para o total.

export interface BaseNumbers {
  spend: number; // centavos
  revenue: number; // centavos
  sales: number;
  profit: number; // centavos, já com custos
  productCost: number;
  impressions: number;
  linkClicks: number;
  pageViews: number;
  addToCart: number;
  checkout: number;
}

export type Format = "money" | "int" | "ratio" | "percent";

export interface Column {
  key: string;
  label: string;
  explain: string;
  format: Format;
  value: (b: BaseNumbers) => number | null;
  // Maior é melhor? Define a ordem padrão ao clicar no cabeçalho.
  higherIsBetter: boolean;
}

const div = (a: number, b: number) => (b > 0 ? a / b : null);

export const COLUMNS: Column[] = [
  { key: "spend", label: "Gasto", explain: "Quanto o anúncio custou no período.", format: "money", value: (b) => b.spend, higherIsBetter: true },
  { key: "sales", label: "Vendas", explain: "Vendas aprovadas que vieram desse anúncio.", format: "int", value: (b) => b.sales, higherIsBetter: true },
  { key: "revenue", label: "Faturamento", explain: "Soma das vendas aprovadas.", format: "money", value: (b) => b.revenue, higherIsBetter: true },
  { key: "profit", label: "Lucro", explain: "Faturamento menos gasto, impostos, taxas e custo dos produtos.", format: "money", value: (b) => b.profit, higherIsBetter: true },
  { key: "roas", label: "ROAS", explain: "Quantos reais voltaram de faturamento para cada R$ 1 gasto.", format: "ratio", value: (b) => div(b.revenue, b.spend), higherIsBetter: true },
  { key: "cpa", label: "CPA", explain: "Quanto custou, em anúncio, cada venda.", format: "money", value: (b) => div(b.spend, b.sales), higherIsBetter: false },
  { key: "margin", label: "Margem", explain: "Quanto do faturamento sobra como lucro.", format: "percent", value: (b) => div(b.profit, b.revenue), higherIsBetter: true },
  { key: "productCost", label: "Custo dos produtos", explain: "Custo + frete das vendas aprovadas (tela Custos).", format: "money", value: (b) => b.productCost, higherIsBetter: false },
  { key: "impressions", label: "Impressões", explain: "Quantas vezes o anúncio apareceu.", format: "int", value: (b) => b.impressions, higherIsBetter: true },
  { key: "cpm", label: "CPM", explain: "Custo para aparecer mil vezes.", format: "money", value: (b) => div(b.spend * 1000, b.impressions), higherIsBetter: false },
  { key: "linkClicks", label: "Cliques", explain: "Cliques no link do anúncio.", format: "int", value: (b) => b.linkClicks, higherIsBetter: true },
  { key: "ctr", label: "CTR", explain: "De quem viu o anúncio, quantos clicaram.", format: "percent", value: (b) => div(b.linkClicks, b.impressions), higherIsBetter: true },
  { key: "cpc", label: "CPC", explain: "Quanto custou cada clique.", format: "money", value: (b) => div(b.spend, b.linkClicks), higherIsBetter: false },
  { key: "pageViews", label: "Viram a página", explain: "Cliques em que a página chegou a carregar.", format: "int", value: (b) => b.pageViews, higherIsBetter: true },
  { key: "addToCart", label: "Carrinho", explain: "Adições ao carrinho (pixel).", format: "int", value: (b) => b.addToCart, higherIsBetter: true },
  { key: "checkout", label: "Checkout", explain: "Checkouts iniciados (pixel).", format: "int", value: (b) => b.checkout, higherIsBetter: true },
  { key: "conversion", label: "Conversão", explain: "De quem clicou, quantos compraram.", format: "percent", value: (b) => div(b.sales, b.linkClicks), higherIsBetter: true },
];

export const DEFAULT_COLUMNS = ["spend", "sales", "revenue", "profit", "roas", "cpa"];

export function parseColumns(v: string | undefined): string[] {
  const keys = (v ?? "").split(",").filter((k) => COLUMNS.some((c) => c.key === k));
  return keys.length ? keys : DEFAULT_COLUMNS;
}

export function columnByKey(k: string): Column | undefined {
  return COLUMNS.find((c) => c.key === k);
}
