# Clickify

Rastreamento de vendas por anúncio: conecta o Meta Ads, recebe as vendas do checkout
por webhook e mostra gasto x faturamento x lucro por campanha, conjunto e anúncio.
Daí dá para pausar e mudar orçamento direto na tabela.

Os planos estão em `../replica/` (recon, arquitetura, design, backend, testes).

## Rodar local (sem conta nenhuma)

```bash
npm install
npm run dev
```

Abra http://localhost:3000. O banco é um Postgres embutido (PGlite) em `.data/`, e o
Meta roda em modo simulado: contas, campanhas e gasto falsos, mas o fluxo é o real.

Contas de teste criadas durante o desenvolvimento (só existem no seu `.data/` local; o
e-mail ficou com o nome provisório antigo), as duas com a senha `rastro-dev-2026`:
- `dev@rastro.test`: Meta simulado
- `meta@rastro.test`: ligada ao seu Meta real (app "Clickify" no Meta for Developers)

Marca: logo original em `../replica/brand/clickify-logo.webp`; o ícone do app é um SVG
redesenhado a partir dela (`src/components/logo.tsx` e `src/app/icon.svg`).

## Testes

```bash
npm test            # unitários: normalização dos webhooks e atribuição
npm run test:e2e    # Playwright: 14 cenários dos fluxos principais, acessibilidade e mobile
npm run typecheck
```

Os e2e sobem um servidor próprio na porta 3100, com banco e mock novos a cada execução.
Na primeira execução com o cache do Next frio, os testes podem estourar o tempo
enquanto as páginas compilam: rode de novo.

## Usar as suas contas do Meta

Veja `.env.example` e o passo a passo em `../replica/meta-setup.md`.

## Produção

Vercel + Neon. Variáveis: `DATABASE_URL`, `APP_ENCRYPTION_KEY`, `META_MODE=live`,
`META_APP_ID`, `META_APP_SECRET`, `CRON_SECRET`. O `vercel.json` já agenda o sync a cada 15 min.
