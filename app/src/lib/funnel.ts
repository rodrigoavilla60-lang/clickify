// Funil de conversão: funções puras (sem banco), para dar para testar isolado.

export interface MetaAction {
  action_type: string;
  value: string;
}

export interface FunnelActions {
  landingPageViews: number;
  addToCart: number;
  initiateCheckout: number;
}

// O Meta devolve o mesmo evento com nomes diferentes conforme a origem (pixel, app, offline).
// Os "omni_" já juntam as origens sem contar duas vezes, então têm prioridade.
const ALIASES: Record<keyof FunnelActions, string[]> = {
  landingPageViews: ["omni_landing_page_view", "landing_page_view"],
  addToCart: ["omni_add_to_cart", "add_to_cart", "offsite_conversion.fb_pixel_add_to_cart"],
  initiateCheckout: ["omni_initiated_checkout", "initiate_checkout", "offsite_conversion.fb_pixel_initiate_checkout"],
};

export function parseActions(actions: MetaAction[] | undefined | null): FunnelActions {
  const byType = new Map((actions ?? []).map((a) => [a.action_type, Number(a.value) || 0]));
  const pick = (names: string[]) => {
    for (const n of names) if (byType.has(n)) return byType.get(n)!;
    return 0;
  };
  return {
    landingPageViews: pick(ALIASES.landingPageViews),
    addToCart: pick(ALIASES.addToCart),
    initiateCheckout: pick(ALIASES.initiateCheckout),
  };
}

export type StepKey = "clicks" | "pageViews" | "addToCart" | "checkout" | "orders" | "approved";

export interface FunnelCounts {
  clicks: number;
  pageViews: number;
  addToCart: number;
  checkout: number;
  orders: number;
  approved: number;
}

export interface FunnelStep {
  key: StepKey;
  label: string;
  hint: string;
  value: number;
  ofFirst: number | null; // fração dos cliques
  fromPrev: number | null; // fração da etapa anterior
}

export interface Funnel {
  steps: FunnelStep[];
  leak: { from: FunnelStep; to: FunnelStep; lost: number; advice: string } | null;
  enoughData: boolean;
}

const STEPS: { key: StepKey; label: string; hint: string }[] = [
  { key: "clicks", label: "Cliques no link", hint: "Pessoas que clicaram no anúncio para ir ao site (Meta)." },
  { key: "pageViews", label: "Viram a página", hint: "Cliques em que a página chegou a carregar (pixel do Meta)." },
  { key: "addToCart", label: "Carrinho", hint: "Adicionaram ao carrinho (pixel do Meta). Some quando a loja não manda esse evento." },
  { key: "checkout", label: "Checkout", hint: "Começaram a finalizar a compra (pixel do Meta)." },
  { key: "orders", label: "Pedidos", hint: "Pedidos que chegaram do checkout com UTM de anúncio, pagos ou não." },
  { key: "approved", label: "Vendas aprovadas", hint: "Pedidos com pagamento aprovado." },
];

// O que costuma explicar cada vazamento. Linguagem de quem toca a loja, não de analista.
const ADVICE: Partial<Record<`${StepKey}>${StepKey}`, string>> = {
  "clicks>pageViews": "Muita gente clica e não espera a página abrir. Veja a velocidade do site no celular e se o link do anúncio está certo.",
  "pageViews>addToCart": "A página não está convencendo. Revise oferta, preço, fotos e prova social logo no começo.",
  "pageViews>checkout": "A página não está convencendo. Revise oferta, preço, fotos e prova social logo no começo.",
  "addToCart>checkout": "Colocam no carrinho e desistem. Frete caro ou surpresa no valor costuma ser o motivo.",
  "checkout>orders": "Desistem no checkout. Veja frete, formas de pagamento e se há campos demais para preencher.",
  "orders>approved": "Pedido feito e não pago. Pix e boleto vencendo ou cartão recusado: vale recuperar os pendentes.",
};

// Abaixo disso a porcentagem pula muito com uma venda a mais ou a menos.
export const MIN_CLICKS = 30;
// Uma etapa só é apontada como vazamento se partir de pelo menos tanta gente:
// "perdeu 100%" de 3 pessoas não é o problema da loja.
export const MIN_LEAK_BASE = 10;

export function buildFunnel(c: FunnelCounts): Funnel {
  // Carrinho só entra quando a loja manda o evento; senão viraria um "vazamento" falso de 100%.
  const keys = STEPS.filter((s) => s.key !== "addToCart" || c.addToCart > 0);
  const first = c.clicks;
  const steps: FunnelStep[] = keys.map((s, i) => {
    const value = c[s.key];
    const prev = i > 0 ? c[keys[i - 1].key] : null;
    return {
      ...s,
      value,
      ofFirst: first > 0 ? value / first : null,
      fromPrev: prev === null ? null : prev > 0 ? value / prev : null,
    };
  });

  let leak: Funnel["leak"] = null;
  for (let i = 1; i < steps.length; i++) {
    const from = steps[i - 1];
    const to = steps[i];
    if (from.value < MIN_LEAK_BASE || to.fromPrev === null) continue;
    const lost = 1 - Math.min(1, to.fromPrev);
    if (!leak || lost > leak.lost)
      leak = { from, to, lost, advice: ADVICE[`${from.key}>${to.key}`] ?? "" };
  }
  return { steps, leak: leak && leak.lost > 0 ? leak : null, enoughData: c.clicks >= MIN_CLICKS };
}
