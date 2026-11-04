# Architecture: Clickify, uma reconstrução das funções principais da UTMify

## Stack

| layer | choice | why |
| --- | --- | --- |
| web | Next.js 15 (App Router) + TypeScript | server actions e rotas de API no mesmo projeto; deploy simples na Vercel |
| styling | Tailwind 4 com os tokens do /replica-design | sem CSS solto; o rebrand troca só os valores |
| database | Postgres. **Dev: PGlite** (Postgres embutido, sem conta, sem Docker). **Produção: Neon** | mesmo SQL nos dois; você não precisa criar nada para rodar local |
| ORM | SQL direto num data layer pequeno (`lib/db`) | 9 tabelas não justificam ORM; as queries de relatório são SQL agregado de qualquer jeito |
| auth | Sessão própria: senha com scrypt (crypto do Node), token aleatório num cookie httpOnly, hash do token no banco | sem dependência externa, sem conta; dá para trocar por Auth.js depois |
| anúncios | Meta Marketing API (Graph v21) com o **seu** app do Meta. **Modo mock** (`META_MODE=mock`) gera contas, campanhas e gasto falsos | o fluxo inteiro roda local antes de você criar o app no Meta |
| checkout | Webhooks de entrada: Shopify (`orders/*`, HMAC) e JSON genérico | o genérico cobre qualquer checkout que mande UTMs |
| payments | nenhum por enquanto | planos e cobrança são "could"; só se for virar SaaS |
| email | nenhum no v1 | sem fluxo que precise de e-mail (reset de senha entra junto com Resend depois) |
| jobs | Vercel Cron → `GET /api/cron/sync-meta` a cada 15 min; em dev, botão "Sincronizar agora" | gasto quase em tempo real sem worker separado |
| hosting | Vercel + Neon | ambos têm plano grátis que aguenta a sua operação |

## Schema

Tables: 9 (users, sessions, workspaces, ad_accounts, ad_objects,
ad_insights_daily, webhooks, webhook_events, orders). Veja `replica/schema.sql`.

Access rules: **checagem no data layer.** Toda função de leitura e escrita
recebe o `workspaceId` já validado pela sessão (`requireWorkspace()`), e toda
query tem `where workspace_id = $1`. A exceção é o endpoint público de webhook,
que acha o workspace pelo token da URL. Teste obrigatório: um segundo usuário
não vê nada do primeiro.

Restrições que importam:
- `orders unique (workspace_id, platform, external_id)`: o mesmo pedido chega
  como pendente e depois como aprovado ou reembolsado. É upsert, nunca linha nova.
- `webhook_events unique (webhook_id, dedupe_key)`: a plataforma reenvia, e o
  reenvio é ignorado.
- `ad_insights_daily unique (ad_account_id, ad_external_id, date)`: o sync
  reescreve o dia, não soma.

## Atribuição (a peça central)

UTMs que o app manda colar no anúncio (S10), com os parâmetros dinâmicos do
próprio Meta:

```
utm_source=FB&utm_medium={{adset.name}}|{{adset.id}}&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}
```

Regra: pega o que vem depois do último `|` em `utm_content`, `utm_medium` e
`utm_campaign` como `ad_external_id`, `adset_external_id` e `campaign_external_id`.
É match exato por ID: renomear a campanha não quebra nada. Venda sem UTM,
ou com UTM sem ID, fica como **não atribuída** e aparece separada.

Métricas (no período e fuso do workspace):
- faturamento = soma de `amount_cents` das vendas `approved` (por `approved_at`)
- gasto = soma de `spend_cents`
- lucro = faturamento − gasto − imposto (tax_rate_bps × faturamento) − taxa do gateway (gateway_fee_bps × faturamento)
- ROAS = faturamento ÷ gasto; CPA = gasto ÷ nº de vendas aprovadas; ROI = lucro ÷ gasto

## API

F01 Primeira configuração

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| POST action `register` | cria usuário + workspace + sessão | público | nome, e-mail, senha | redirect /onboarding | F01 |
| POST action `login` / `logout` | sessão | público / logado | e-mail, senha | redirect | F01 |
| GET /api/meta/connect | redireciona para o OAuth do Meta (ou mock) | logado | — | 302 | F01 |
| GET /api/meta/callback | troca o code por token de longa duração, lista as contas | logado | code, state | redirect /contas | F01 |
| POST action `toggleAdAccount` | liga/desliga a conta | dono | id, enabled | ok | F01 |
| POST action `createWebhook` | cria webhook com token aleatório | dono | nome, plataforma, segredo? | URL | F01 |
| POST /api/webhooks/{token} | recebe venda, guarda evento, normaliza, faz upsert, atribui | público (token + HMAC no Shopify) | JSON | 200 sempre que guardou | F01, F03 |

F02 Otimizar

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| GET page /campanhas | tabela por nível com métricas | dono | nível, período, contas | — | F02 |
| POST action `setStatus` | pausa/ativa no Meta e atualiza local | dono | ad_object id, status | ok/erro | F02 |
| POST action `setBudget` | muda orçamento diário no Meta | dono | ad_object id, centavos | ok/erro | F02 |
| POST action `syncNow` | roda o sync do workspace | dono | — | ok | F02 |

F03 Vendas, configurações

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| GET page /vendas | lista com filtro de status, atribuída ou não, busca | dono | filtros | — | F03 |
| POST action `updateSettings` | fuso, imposto, taxa do gateway | dono | form | ok | — |

Webhooks in: Shopify `orders/create`, `orders/paid`, `orders/updated`,
`refunds/create`; JSON genérico (formato documentado na tela S08).
Webhooks out: nenhum no v1 (Conversions API do Meta vem no "should").

Jobs: `sync-meta`, a cada 15 min. Para cada conta ativa, busca campanhas,
conjuntos e anúncios (status, orçamento) e os insights de hoje e de ontem
por anúncio. Ontem entra porque o Meta ainda ajusta o gasto do dia anterior.

## The parts that bite

- **Fusos:** o Meta reporta o gasto no fuso da conta de anúncio. As vendas
  chegam em UTC. O relatório usa o fuso do workspace, e se a conta tiver
  outro fuso aparece um aviso. Horário de verão: o Brasil não tem desde
  2019, mas usamos o tz database e não offsets fixos.
- **Idempotência:** reenvios de webhook são ignorados pelo dedupe; a mudança
  de status do mesmo pedido é upsert. Uma venda reembolsada depois de aprovada
  sai do faturamento no dia em que foi aprovada.
- **Ordem dos eventos:** o "aprovado" pode chegar antes do "pendente". Só
  aceitamos transições que avançam (pendente → aprovado → reembolsado ou
  chargeback), nunca voltam.
- **Rate limits do Meta:** o sync pede insights no nível de anúncio numa chamada
  por conta (`level=ad`, paginado) e respeita o header `x-business-use-case-usage`.
- **Token do Meta:** dura cerca de 60 dias. Fica guardado cifrado e mostramos
  "reconectar" antes de expirar.
- **Segurança do webhook:** o token da URL tem 32 bytes aleatórios. No Shopify,
  o HMAC do corpo é verificado. O corpo é limitado a 256 KB.
- **Multi-tenancy:** um workspace por usuário no v1; a coluna já existe em
  tudo para virar vários (S12) sem migração de dados.
- **LGPD:** e-mail do cliente só como hash; excluir a conta apaga tudo em cascata.

## Build order

1. **Vertical slice (este ciclo):** S01 cadastro, S02 login, S03 onboarding,
   S09 contas (mock do Meta), S07/S08 webhook, S10 UTMs, S06 vendas, S05
   campanhas, S04 dashboard. Tabelas: todas. Rotas: todas acima. O teste do
   slice: mandar uma venda pelo webhook com UTMs do mock e vê-la no lucro da
   campanha certa.
2. **Must-haves restantes:** pausar/ativar e sync real com o seu app do Meta;
   adaptador Shopify com HMAC; S14 configurações.
3. **Should-haves:** editar orçamento, Conversions API (S11), vendas não
   atribuídas com sugestão, script de UTM na landing, seletor de colunas,
   gráfico diário, mais checkouts (Yampi, Cartpanda), múltiplos dashboards (S12).
4. **Fixes do /replica-entrepreneur:** quando rodar.
