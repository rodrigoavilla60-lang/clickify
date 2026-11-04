# Build log

| ID | screen | date | state | missing / notes |
| --- | --- | --- | --- | --- |
| S01 | Cadastro | 2026-11-01 | done | sem verificação de e-mail (precisa de Resend) |
| S02 | Login | 2026-11-01 | done | sem "esqueci a senha" (precisa de e-mail) |
| S03 | Onboarding | 2026-11-01 | done | 4 passos com progresso; o passo das UTMs conta quando você clica em copiar |
| S04 | Resumo | 2026-11-01 | done | KPIs, pendentes, reembolsos, aviso de não atribuídas, gráfico diário em SVG |
| S05 | Campanhas | 2026-11-01 | done | 3 níveis, drill-down, ordenação, pausar/ativar, orçamento inline, totais. Sem seletor de colunas |
| S06 | Vendas | 2026-11-01 | done | filtros de status e "não atribuídas", busca, período. Limite de 200 linhas, sem paginação |
| S07 | Integrações | 2026-11-01 | done | Shopify + JSON genérico |
| S08 | Webhook | 2026-11-01 | done | URL, passo a passo, exemplo, últimos 10 eventos com erro, simular venda, excluir |
| S09 | Contas de anúncio | 2026-11-01 | done | OAuth (real ou mock), ativar/desativar, erro de sync, aviso de token vencendo e de fuso |
| S10 | UTMs | 2026-11-01 | done | |
| S11 | Pixels (CAPI) | — | not started | should |
| S12 | Múltiplos dashboards | — | not started | should; o schema já está pronto |
| S13 | Plano e cobrança | — | not started | could |
| S14 | Configurações | 2026-11-01 | done | imposto, taxa, fuso, sair de todos, excluir conta |

Harder than expected:
- **Fuso:** o Meta reporta o gasto no fuso da conta. Resolvido somando o gasto pela data do Meta e as vendas pela data no fuso da operação, com um aviso quando os dois fusos são diferentes.
- **Windows:** caminho com mais de 260 caracteres quebrava o download do zip e os relatórios do Playwright, e um package-lock.json solto na pasta do usuário confundia a raiz do Next.

Screenshots for replica-diff (`replica/clone-screens/`) were not taken: there are no
reference screenshots of the original's logged-in screens to compare against.

## Pacote 1 (jeito Clickify), 01/11/2026
- Custos e lucro real (tela Custos + "De onde veio isso?" no Resumo): feito.
- Resumo com filtros (conta, produto, checkout, fonte) e quebras por produto, fonte e pagamento: feito.
- Campanhas com busca, filtro de status e escolha de colunas: feito.
- Exportar planilha (vendas, UTM, campanhas) e relatório por UTM: feito.
- Tela Hoje: sugere pausar (anúncio gastou mais que o lucro de uma venda sem vender, ou dá prejuízo) e escalar (+20% no orçamento com margem >= 20% e 2+ vendas), alerta de rastreio; cada ação com confirmação. Login cai em Hoje.
- Menu enxuto: Hoje, Resumo, Campanhas, Vendas, Custos, Conexões (abas Checkouts, Contas de anúncio, UTMs); Primeiros passos só enquanto falta configurar; Configurações no rodapé.
- ROAS, CPA e margem com explicação em português no Resumo.
- Testes: 44 unitários, 25 e2e, build ok. Não publicado ainda.
## Pixel pelo servidor (API de Conversões), 01/11/2026
- Conexões > Pixel: cadastra ID do pixel + token (guardado com criptografia), código de teste opcional, por checkout ou todos.
- Cada venda aprovada vira um evento Purchase enviado depois de responder ao webhook (after()). Uma vez por pixel (índice único).
- Dados do comprador (e-mail, telefone, nome, cidade, estado, CEP, CPF) saem com hash SHA-256; IP, navegador, fbc/fbp sem hash. Guardados em orders.capi_match e apagados após 8 dias (cron).
- Venda sem e-mail, telefone ou clique do anúncio: registrada como "Não enviado" com o motivo. Compra com mais de 7 dias: não envia.
- Falhas: botão "Tentar de novo" e o cron diário (até 5 tentativas). Pedido de teste do botão de integração não vai ao pixel.
- Modo de teste (META_MODE diferente de live): nada sai, aparece como simulado.
- Testes: 51 unitários (7 novos em capi.test.ts), 26 e2e (PX-1 novo), build ok. Não publicado.
- Validar com o pixel real usando o código de teste antes de deixar ligado sem ele.
## Senha: recuperar e trocar, 01/11/2026
- /esqueci-senha: resposta igual exista a conta ou não; limite de 3 pedidos por e-mail por hora.
- Link por e-mail com token aleatório (só o hash no banco, tabela password_resets), vale 1 hora e uma vez; ao usar, derruba todas as sessões e invalida outros links.
- Link montado com APP_URL ou VERCEL_PROJECT_PRODUCTION_URL, nunca com o cabeçalho Host em produção.
- Configurações > Trocar senha: pede a atual, desconecta os outros aparelhos.
- E-mail pelo Resend (RESEND_API_KEY, EMAIL_FROM). Sem chave: dev/testes gravam em EMAIL_OUTBOX; produção mostra erro e não envia.
- Testes: SENHA-1 e SENHA-2; 28 e2e, 51 unitários, build ok. Não publicado.