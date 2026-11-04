# Recon map: UTMify (web)

Scope: o loop principal de rastreamento. Conectar a conta do Meta Ads, receber
vendas do checkout por webhook, atribuir cada venda à campanha, conjunto e
anúncio pelas UTMs, e mostrar gasto x faturamento x lucro numa tabela onde dá
para pausar a campanha ou mudar o orçamento. WhatsApp, regras programadas,
app mobile e as mais de 150 integrações de checkout ficam para depois.
For: a operação de drop do próprio usuário primeiro, com opção de vender como
SaaS depois (por isso multi-tenant desde o início).
Date: 2026-11-01

Status da proposta de escopo: **proposto, aguardando o sim do usuário.**

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | site / marketing | https://utmify.com.br/ | 6 pilares: dashboard, gestão de tráfego automática, server-side, app, múltiplos dashboards, suporte |
| 2 | FAQ (no site) | https://utmify.com.br/ | só vendas aprovadas contam no limite; integração em menos de 5 min; não acessa criativos, só IDs de campanha; cancela quando quiser |
| 3 | preços | https://app.utmify.com.br/precos?locale=pt | 5 planos. Os limites são por vendas aprovadas, contas de anúncio, webhooks, dashboards, pixels, números de WhatsApp e regras programadas |
| 4 | integrações | https://app.utmify.com.br/integracoes?locale=pt | ~170 logos de checkouts e gateways (Shopify, Yampi, Kiwify, Hotmart, Cartpanda, Appmax...). Anúncios: o FAQ só cita o Meta Ads |
| 5 | termos e condições | https://app.utmify.com.br/termos-e-condicoes | **não lido**: a verificação do Cloudflare bloqueou o navegador. Ler antes de usar uma conta própria para estudar o app |
| 6 | central de ajuda / docs da API | — | não encontrei documentação pública na busca |
| 7 | conta do próprio usuário | https://app.utmify.com.br/ | não usada. Se você tiver conta, dá para confirmar as telas S03 a S10 com você no controle |

**Confiança geral:** as funcionalidades vêm das fontes 1 a 4 e são confiáveis.
O layout das telas logadas é **inferido**: o padrão de ferramentas de
atribuição e o que os planos limitam. A coluna "evidence" diz de onde veio
cada item.

## Core loop

O gestor de tráfego vê, por campanha, conjunto e anúncio, quanto gastou e
quanto vendeu de verdade (venda aprovada no checkout, não o evento do pixel).
Ele otimiza direto na tabela, sem abrir o Gerenciador de Anúncios.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Cadastro | /register | criar conta, inicia o teste grátis | form e-mail/senha, nome, telefone (WhatsApp) | inferido: vazio, erro, carregando |
| S02 | Login | /login | entrar | form, "esqueci a senha" | inferido |
| S03 | Onboarding / checklist | 1º acesso | guiar os 3 passos: conectar o Meta, criar o webhook, colocar as UTMs nos anúncios | stepper, status de cada passo | inferido: 0/3, 1/3, completo |
| S04 | Dashboard | / (home logada) | KPIs do período: faturamento, gasto, lucro, ROAS, ROI, CPA, vendas, margem, reembolsos e chargebacks, vendas pendentes | filtro de período, filtro de conta, cards de KPI, gráfico por dia, ranking por produto e por fonte | fonte 1 "dashboard minimalista"; vazio sem integração |
| S05 | Campanhas (Meta) | /meta ou aba | a tela principal: tabela de campanha > conjunto > anúncio com gasto, vendas, faturamento, lucro, ROAS e CPA, com ações | abas de nível, tabela ordenável, toggle ativo/pausado, edição inline do orçamento, seletor de colunas, filtro de período e de conta | fonte 1 "gestão de tráfego automática… sem precisar abrir o Facebook" |
| S06 | Vendas | /vendas | lista de pedidos recebidos com a atribuição de cada um | tabela, status (aprovada, pendente, recusada, reembolsada, chargeback), UTMs, filtro, busca | inferido; FAQ fala em status |
| S07 | Integrações: lista | /integracoes (logado) | conectar o checkout e ver os webhooks ativos | grid de plataformas com busca, webhooks criados, limite do plano | fonte 4; limite de webhooks na fonte 3 |
| S08 | Integração: criar webhook | modal a partir de S07 | gerar a URL do webhook para colar no checkout | nome, plataforma, URL gerada com botão copiar, passo a passo, "aguardando 1ª venda" | FAQ "menos de 5 minutos, passo a passo" |
| S09 | Contas de anúncio | /contas ou dentro de S07 | conectar o Meta por OAuth e escolher as contas | botão "conectar com Facebook", lista de contas com toggle, limite do plano, status do token | limite de contas na fonte 3 |
| S10 | UTMs / script | /utms | parâmetros de UTM prontos para colar no anúncio e script para a página | bloco de código com botão copiar, instruções | inferido do loop: sem UTM não tem atribuição |
| S11 | Pixels de otimização | /pixels | mandar a venda aprovada de volta para o Meta via Conversions API (server-side) | lista de pixels, token CAPI, eventos enviados | fonte 1 server-side; limite de pixels na fonte 3 |
| S12 | Múltiplos dashboards | seletor no topo | separar operações (uma por loja ou cliente) | troca de dashboard, criar, renomear | fonte 1; limite na fonte 3 |
| S13 | Plano e cobrança | /planos | ver o uso de vendas no mês e trocar de plano | barra de uso, cards de plano, excedente | fonte 3 |
| S14 | Configurações | /config | imposto, taxas do gateway, custo do produto para calcular o lucro; fuso; moeda | form | inferido: o lucro precisa desses custos |

Fora do escopo agora, mas existe no original: Regras programadas, rastreio de
WhatsApp, app mobile, parceiros e afiliados.

## Flows

```
F01 Primeira configuração (onboarding até a 1ª venda atribuída)   ← FLUXO PRINCIPAL
    S01 -> S03 -> S09 conectar Meta (OAuth) -> escolher conta
        -> S07 -> S08 criar webhook, copiar URL, colar no checkout
        -> S10 copiar UTMs para os anúncios
        -> (venda acontece) -> S06 venda aparece atribuída -> S05 campanha mostra a venda
    happy path clicks: ~12 (sem contar o que é feito no checkout e no Meta)
    edge: token do Meta expira; venda chega sem UTM (vai para "não atribuída");
          webhook com payload de outra plataforma; venda chega antes do gasto sincronizar;
          mesmo pedido chega 2x (pendente e depois aprovado); fuso do Meta ≠ fuso da conta

F02 Otimizar campanhas (uso diário)
    S04 -> S05 -> filtrar "hoje" -> ordenar por lucro -> pausar perdedora / subir orçamento da vencedora
    happy path clicks: 4
    edge: falha na API do Meta ao pausar; orçamento no nível de campanha (CBO) x conjunto;
          sem permissão de edição na conta

F03 Acompanhar vendas
    S06 -> filtrar por status ou UTM -> abrir venda -> ver a origem (campanha, conjunto, anúncio)
    edge: reembolso ou chargeback depois da aprovação muda o lucro retroativamente

F04 Enviar conversão server-side
    S11 cadastrar pixel e token -> cada venda aprovada vai como Purchase via CAPI
    edge: deduplicação com o pixel do navegador (event_id); token inválido

F05 Assinar plano
    S13 -> escolher plano -> checkout -> limites atualizados
    edge: passou do limite de vendas (cobra excedente, não bloqueia)
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger | default, hover, focus, disabled, loading | todas |
| KPI card | money, percent, count | loading, vazio, positivo, negativo | S04 |
| DataTable | ordenável, com linhas expansíveis, colunas configuráveis | loading (skeleton), vazio, filled, erro | S05, S06, S07 |
| Status toggle | ativo/pausado | on, off, saving, erro | S05, S09 |
| Inline money editor | orçamento | view, editing, saving, erro | S05 |
| Date range picker | presets (hoje, ontem, 7d, 30d, mês) + personalizado | — | S04, S05, S06 |
| Account filter | multi-select | — | S04, S05 |
| Status badge | aprovada, pendente, recusada, reembolsada, chargeback | — | S06 |
| Copy field | URL, código | default, copiado | S08, S10, S11 |
| Integration tile | logo + nome | disponível, conectado | S07 |
| Stepper / checklist | — | pendente, feito | S03 |
| Usage bar | — | ok, perto do limite, excedido | S13 |
| Modal, Toast, Empty state, Sidebar nav, Dashboard switcher | | | todas |

## Inferred data model

```
Workspace (Dashboard)  id, owner_id, name, timezone, currency, tax_rate, gateway_fee_rate
            evidence: "Múltiplos dashboards" (fonte 1), limite por plano (fonte 3)
            confidence: high que existe; fields: medium

User        id, email, name, phone   confidence: high

AdAccount   id, workspace_id, provider (meta), external_id, name, access_token (encrypted),
            token_expires_at, enabled
            evidence: limite "Contas de Anúncio" (fonte 3); FAQ cita Meta Ads
            confidence: high

Campaign / AdSet / Ad   id, ad_account_id, external_id, parent_id, name, status, daily_budget
            evidence: "quantas vendas cada campanha teve… otimizações pelo relatório" (fonte 1)
            confidence: high (é o modelo do próprio Meta)

AdInsightDaily  ad_id, date, spend, impressions, clicks, (cpm, ctr derivados)
            evidence: gasto x venda na tabela
            confidence: high

Webhook     id, workspace_id, platform, name, secret_token, last_event_at
            evidence: limite "Webhooks" (fonte 3), FAQ
            confidence: high

Order       id, workspace_id, webhook_id, external_id, platform, status
            (approved | pending | refused | refunded | chargeback), amount, currency,
            product_name, customer (hash), utm_source, utm_medium, utm_campaign,
            utm_content, utm_term, campaign_id?, adset_id?, ad_id?, approved_at, created_at
            evidence: FAQ "recusadas, reembolsadas, chargeback"; "só aprovadas contam"
            confidence: high que existe; colunas de UTM: medium

Pixel       id, workspace_id, pixel_id, capi_token (encrypted)
            evidence: "Pixels de Otimização" (fonte 3), "server-side" (fonte 1)
            confidence: medium

Subscription  workspace_id, plan, period, approved_orders_count
            evidence: fonte 3
            confidence: high
```

Relationships: User 1-n Workspace; Workspace 1-n AdAccount, Webhook, Order, Pixel;
AdAccount 1-n Campaign 1-n AdSet 1-n Ad 1-n AdInsightDaily; Order n-1 Ad (atribuição, pode ser nula).

**A peça central é a atribuição:** a venda chega com UTMs. Os anúncios usam
parâmetros dinâmicos do Meta (ex.: `utm_campaign={{campaign.name}}|{{campaign.id}}`,
`utm_content={{ad.name}}|{{ad.id}}`), então o ID vem na própria venda e o
match é exato, não por nome. Hipótese nossa, a confirmar no build.

## Feature matrix

See `features.csv`. Must: 16, should: 9, could: 6, skip: 3.

## Out of scope (cannot or should not be cloned)

- A marca, o nome, o logo e os textos da UTMify. O nosso app recebe outra
  identidade em /replica-brand.
- Os depoimentos e a base de clientes ("+20M faturados") são deles.
- Parcerias com checkouts e o programa de parceiros. O que podemos fazer:
  integrar pelas APIs ou webhooks públicos de cada checkout.
- As ~170 integrações de uma vez. Começamos com o Shopify mais um webhook
  genérico (JSON com UTMs), e cada checkout novo é um adaptador.
- Suporte VIP com especialistas: é serviço, não software.

## Size

Screens 14, flows 5, entities 10. Hard parts:
1. **Meta Marketing API**: revisão do app no Meta (Advanced Access para
   `ads_read` e `ads_management`), que leva semanas se for vender para
   terceiros. Para uso próprio, o modo dev com a sua conta basta.
2. **Atribuição e normalização de webhooks**: cada checkout manda um formato,
   status muda depois (pendente → aprovado → reembolsado), duplicatas.
3. **Sync de gasto quase em tempo real** + fusos + lucro com impostos e taxas.

Size: **M** para uso próprio (Meta + Shopify + webhook genérico, telas S01 a
S10 e S14). Vira **L** com CAPI, multi-dashboard, planos e cobrança para
vender como SaaS.
