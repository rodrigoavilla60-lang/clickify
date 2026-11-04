// Catálogo dos checkouts: nomes, campo de segredo e passo a passo. Sem dependências do Node,
// porque a tela de criar webhook (componente de navegador) também usa.
// Os caminhos de menu de cada plataforma mudam com frequência: os textos avisam isso.

export type CheckoutPlatform = "shopify" | "kiwify" | "hotmart" | "yampi" | "eduzz" | "generic" | "capture";

export interface PlatformInfo {
  label: string;
  beta?: boolean;
  secret: { label: string; help: string } | null;
  steps: string[];
}

export const PLATFORMS: Record<CheckoutPlatform, PlatformInfo> = {
  shopify: {
    label: "Shopify",
    secret: { label: "Chave de assinatura do Shopify", help: "Fica em Configurações → Notificações → Webhooks, no fim da página." },
    steps: [
      "No admin do Shopify: Configurações → Notificações → Webhooks.",
      "Crie um webhook para cada evento: Criação de pedido, Pagamento de pedido, Atualização de pedido e Criação de reembolso.",
      "Formato JSON, cole a URL acima e salve.",
    ],
  },
  kiwify: {
    label: "Kiwify",
    beta: true,
    secret: { label: "Token do webhook na Kiwify", help: "A Kiwify mostra o token ao criar o webhook." },
    steps: [
      "Na Kiwify, abra a área de Webhooks (em Apps) e crie um webhook novo.",
      "Cole a URL acima e escolha os produtos que entram no rastreio.",
      "Marque os eventos: Compra aprovada, Pix gerado, Boleto gerado, Compra recusada, Reembolso e Chargeback.",
      "Copie o token que a Kiwify gerar e cole no campo de token deste webhook (ou recrie o webhook aqui com ele).",
    ],
  },
  hotmart: {
    label: "Hotmart",
    beta: true,
    secret: { label: "Hottok (token da Hotmart)", help: "Aparece na tela de webhooks da Hotmart." },
    steps: [
      "Na Hotmart, abra Ferramentas → Webhook (API e notificações) e cadastre um webhook.",
      "Cole a URL acima, versão 2.0.0, e marque os eventos de compra: aprovada, completa, boleto impresso, cancelada, expirada, reembolsada e chargeback.",
      "A Hotmart não repassa UTMs: nos anúncios, use o texto de parâmetros da Hotmart que está na tela UTMs (ele manda os IDs do anúncio no campo sck).",
    ],
  },
  yampi: {
    label: "Yampi",
    beta: true,
    secret: { label: "Chave secreta do webhook na Yampi", help: "A Yampi mostra a chave ao criar o webhook." },
    steps: [
      "Na Yampi, abra a área de Webhooks e crie um webhook novo.",
      "Cole a URL acima e marque os eventos order.created, order.paid e order.status.updated.",
      "Copie a chave secreta que a Yampi mostrar e use neste webhook.",
    ],
  },
  eduzz: {
    label: "Eduzz",
    beta: true,
    secret: { label: "Chave secreta (tela Segurança da Eduzz)", help: "Gere na tela Segurança do Developers da Eduzz." },
    steps: [
      "No Developers da Eduzz, crie uma configuração de webhook com a URL acima.",
      "Marque os eventos de Fatura: paga, aguardando pagamento, cancelada, expirada, reembolsada e chargeback.",
      "Na tela Segurança, gere uma chave secreta e use neste webhook.",
    ],
  },
  generic: {
    label: "Outro checkout (JSON genérico)",
    secret: null,
    steps: ["Configure o checkout para mandar um POST com o formato abaixo."],
  },
  capture: {
    label: "Outro checkout (capturar formato)",
    secret: null,
    steps: [
      "Cole a URL acima no seu checkout e faça uma venda de teste.",
      "O Clickify guarda o que chegar, sem criar venda. Com esse exemplo real, dá para escrever a integração certinha.",
    ],
  },
};

export function isPlatform(v: string): v is CheckoutPlatform {
  return v in PLATFORMS;
}

// O texto de parâmetros da Hotmart: ela só repassa src e sck.
export const HOTMART_PARAMS = "src=FB&sck={{campaign.id}}-{{adset.id}}-{{ad.id}}";
