# Test plan

Date: 2026-11-01. Automated: `app/e2e/` (Playwright, Chromium) and `app/tests/` (node:test).
Every e2e test fails on a console error or any 5xx response.

## F01 Primeira configuração até a 1ª venda atribuída

| case | what | how | result |
| --- | --- | --- | --- |
| F01-H1 | cadastro → conectar Meta → webhook → venda via HTTP → aparece em Vendas e na campanha certa → copiar UTMs → onboarding completo | e2e | pass |
| F01-E1 | pendente → aprovado → reenvio (dedupe) → pendente atrasado (ignorado) → reembolso; faturamento volta a zero | e2e | pass |
| F01-E2 | venda sem UTM fica "não atribuída", no filtro certo e no aviso do Resumo | e2e | pass |
| F01-E3 | sem sessão, todas as telas logadas mandam para o login | e2e | pass |
| F01-N1 | JSON inválido 400, JSON que não é objeto 400, token inexistente 404, status desconhecido ok:false, corpo > 256 KB 413 | e2e | pass (após BUG-1) |
| F01-N2 | cadastro vazio mostra 3 erros com aria-invalid; e-mail duplicado; senha errada; login certo | e2e | pass |
| F01-U* | ID da UTM com `\|` no nome, URL-encoded, placeholders `{{...}}` recusados; Shopify landing_site e note_attributes; regras de status | unit (7) | pass |

## F02 Otimizar campanhas

| case | what | how | result |
| --- | --- | --- | --- |
| F02-H1 | pausar pela tabela, sincronizar, recarregar: continua pausada; reativar | e2e | pass |
| F02-H2 | editar orçamento: < R$ 1 recusado com mensagem; 200 salva e persiste | e2e | pass |
| F02-H3 | drill-down campanha > conjunto > anúncio; ordenar por gasto com aria-sort | e2e | pass |

## Segurança, acessibilidade, mobile

| case | what | how | result |
| --- | --- | --- | --- |
| SEC-1 | 2º usuário não vê vendas, webhooks, campanhas nem abre a página do webhook do 1º (404) | e2e | pass |
| SEC-2 | "sair de todos os dispositivos" derruba a outra sessão | e2e | pass |
| SEC-3 | excluir conta exige o e-mail; depois o login falha | e2e | pass |
| A11Y | axe WCAG 2 A/AA em login, cadastro, onboarding, contas, webhook, integrações, resumo, campanhas, vendas, UTMs, configurações | e2e | pass (após BUG-2) |
| MOB-1 | nenhuma tela rola na horizontal em 390px, com nome de produto longo | e2e | pass (após BUG-3) |

## Não automatizado (passo manual)

- OAuth com o Meta de verdade (`META_MODE=live`): precisa do seu app do Meta.
- Webhook real do Shopify com HMAC: precisa de uma loja. O HMAC é verificado no código, mas não por um teste com a assinatura de verdade.
- Navegação só por teclado no fluxo inteiro: o axe cobre os rótulos e o foco, não a ordem de tabulação.
- Fuso da conta de anúncio diferente do fuso da operação: só o aviso foi verificado.
- Duas abas mandando o mesmo formulário ao mesmo tempo.

Totais: 21 casos automatizados (14 e2e + 7 unit), 21 passando.
