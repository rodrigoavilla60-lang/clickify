# Backend

Updated: 2026-11-01

## O que está pronto

| área | estado | onde |
| --- | --- | --- |
| Auth | cadastro e login com e-mail e senha (scrypt), sessão em cookie httpOnly com hash no banco, sair, sair de todos os dispositivos, excluir conta (apaga tudo em cascata) | `src/lib/auth.ts`, `src/app/(auth)/actions.ts` |
| Banco | schema em `db/schema.sql`, aplicado sozinho no 1º boot. PGlite em dev, Postgres (Neon) com `DATABASE_URL` | `src/lib/db.ts` |
| Acesso | checagem no data layer: toda página e action chama `requireWorkspace()`, e toda query filtra por `workspace_id` | todas as actions |
| Meta | OAuth com o app do próprio usuário, token de longa duração cifrado (AES-256-GCM), sync de árvore + gasto, pausar/ativar, mudar orçamento. Mock completo para dev | `src/lib/meta.ts`, `src/lib/sync.ts` |
| Webhooks de entrada | Shopify (HMAC opcional) e JSON genérico; evento guardado com dedupe; status só avança; limite de 256 KB | `src/lib/orders.ts`, `src/lib/normalize.ts` |
| Jobs | `GET /api/cron/sync-meta` protegido por `CRON_SECRET` (Vercel Cron, a cada 15 min) | `src/app/api/cron/sync-meta` |
| Pagamentos | fora do escopo (planos são "could") | — |
| E-mail | fora do v1. Reset de senha depende disso: entra com Resend | — |

## Meta: o que você precisa fazer (não dá para eu fazer por você)

1. Criar um app em developers.facebook.com, do tipo **Empresa**.
2. Adicionar **Login do Facebook para Empresas** e **API de Marketing**.
3. Cadastrar `https://SEU_DOMINIO/api/meta/callback` (e `http://localhost:3000/api/meta/callback` em dev) como URI de redirecionamento.
4. Pôr `META_MODE=live`, `META_APP_ID` e `META_APP_SECRET` em `.env.local`.

Escopos pedidos: `ads_read` (gasto e estrutura) e `ads_management` (pausar e orçamento).
Para **uso próprio**, o app em modo de desenvolvimento funciona com a sua conta, sem revisão.
Para **vender para terceiros**, o Meta exige Acesso Avançado aos dois escopos, com revisão do app e
verificação da empresa. Leva semanas: comece antes do lançamento.
Rate limit: o sync faz 4 chamadas paginadas por conta a cada 15 min, bem abaixo do limite padrão.

## Security checklist

- [x] segredos só em env vars; `.env*` no `.gitignore`; tokens do Meta cifrados no banco; nada de segredo no cliente
- [x] entrada validada no servidor em toda action e rota (validação manual, sem zod: poucos campos)
- [x] autorização em toda leitura e escrita (`workspace_id` da sessão). **Teste com 2º usuário: em `/replica-test`**
- [x] rate limit em login (20/IP e 8/e-mail a cada 15 min) e cadastro (5/IP por hora). Em memória: com várias instâncias, trocar por Redis
- [x] webhooks: Shopify verifica HMAC quando a chave é informada; o genérico depende do token secreto de 32 caracteres na URL
- [x] uploads: não há
- [x] sem dados do usuário em URLs ou logs (e-mail do cliente final só como sha256)
- [~] `npm audit`: next atualizado de 15.5.4 para 15.5.28 (corrigiu o crítico). Sobra 1 alta no PostCSS embutido no Next, que só processa o nosso próprio CSS no build. A correção exige Next 16: fazer antes do deploy
- [ ] política de privacidade listando os processadores (Vercel, Neon, Meta): fica para `/replica-launch`

## Falta (registrado, não esquecido)

- Reset de senha e verificação de e-mail (precisa de Resend e domínio)
- Seed script dedicado. Hoje o modo mock do Meta + "Simular uma venda" fazem esse papel
- Backups: ligar no Neon quando criar o projeto de produção (point-in-time recovery vem no plano grátis)
