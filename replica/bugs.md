# Bugs

No git in this environment, so "fixed in" points at the file instead of a commit.

## BUG-1 · S4 · fixed
Webhook aceitava JSON válido que não é objeto.
Steps: POST `"texto"`, `null`, `[1,2]` ou `42` na URL do webhook.
Expected: 400. Actual: 200 com `ok:false` (e `null` derrubava a normalização com TypeError).
Evidence: F01-N1 falhou com `Expected: 400, Received: 200` para `"texto"`.
Fixed in: `app/src/lib/orders.ts` (checa se é objeto antes de normalizar). Test: F01-N1.

## BUG-2 · S3 · fixed
Caixa com a URL do webhook, as UTMs e o exemplo de JSON rolava na horizontal mas não recebia foco pelo teclado.
Steps: abrir /utms ou a página de um webhook e navegar com Tab.
Expected: dá para focar e rolar pelo teclado. Actual: axe `scrollable-region-focusable` no `<code>`.
Fixed in: `app/src/components/client.tsx` (CopyField) e `integracoes/[id]/page.tsx` (`<pre>`). Test: F01-A11Y.

## BUG-3 · S3 · fixed
No celular (390px), /utms rolava 823px para o lado: o texto longo das UTMs alargava o grid.
Expected: a caixa rola por dentro e a página não. Actual: a página inteira ficava mais larga que a tela.
Evidence: MOB-1 `/utms rola 823px na horizontal`.
Fixed in: `grid-cols-[minmax(0,1fr)]` em /utms, na página do webhook e em /integracoes. Test: MOB-1 (agora cobre a página do webhook também).

## BUG-4 · S1 · fixed
Conectar o Meta real falhava com `(#100) Tried accessing nonexisting field (access_token)`.
Steps: `.env.local` com `META_GRAPH_VERSION=` vazio (como vem no modelo) → Conectar com o Meta → autorizar.
Expected: contas listadas. Actual: erro, nenhuma conta conectada.
Cause: `process.env.META_GRAPH_VERSION ?? "v25.0"` não cai no padrão com string vazia, então a URL virava `graph.facebook.com//oauth/access_token`.
Fixed in: `app/src/lib/meta.ts` (`||` em vez de `??`; mesmo ajuste preventivo em `PGLITE_DIR` e `META_MOCK_FILE`). Agora os erros do Meta também dizem qual chamada falhou.
Verified: reconectado com a conta real; 9 contas de anúncio listadas, a primeira sincronizada sem erro.
Not caught by tests: os e2e rodam em modo mock, que não monta URL da Graph API.

## BUG-5 · S2 · fixed
Conjuntos e anúncios sumiam da tabela de campanhas com o Meta real.
Steps: conta VittaConfort, aba Conjuntos, 30 dias.
Expected: os 3 conjuntos das 3 campanhas. Actual: só 1.
Cause: o sync lia `effective_status`, que vem como CAMPAIGN_PAUSED, ADSET_PAUSED, WITH_ISSUES…; tudo isso virava OTHER e a tabela só mostra ACTIVE e PAUSED.
Fixed in: `app/src/lib/meta.ts` (lê `status`, o liga/desliga configurado). Verified: os 3 conjuntos aparecem, com orçamento.

## BUG-6 · S4 · fixed
Aviso falso de fuso diferente na conta VittaConfort: o Meta devolve "Brazil/East", que é o mesmo fuso de "America/Sao_Paulo".
Fixed in: `sameTimeZone()` em `app/src/lib/period.ts`, que compara o nome canônico. Test: `tests/period.test.ts`. Verified: o aviso sumiu.

## Open

Nenhum S1 ou S2 aberto.

## To check (não reproduzido)

- Rate limit em memória não vale entre várias instâncias na Vercel (anotado em backend.md).
- Pausar no mock vale para todos os usuários locais, porque o estado do mock é por ID do Meta. Com o Meta real isso não acontece.
- Os testes de ponta a ponta podem estourar o tempo na primeira execução com o cache do Next frio. Na 2ª passam: 14/14 duas vezes seguidas.
