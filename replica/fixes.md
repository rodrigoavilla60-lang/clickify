# O que quem usa a UTMify reclama, e o que o Clickify faz diferente

Pesquisa de 01/11/2026. Só fontes públicas, lidas como usuário.

**Amostra:** 53 textos (52 sem contar uma repetição) em 3 fontes.
- **App Store Brasil:** 31 avaliações, ou seja, todas as do feed público.
- **Google Play:** 18 avaliações (a página mostra nota 4,8 com 1,36 mil notas; só uma parte delas tem texto).
- **Reclame Aqui:** 4 títulos de reclamação e o resumo da página. São 59 reclamações no total e 32 nos últimos 12 meses, separadas por categoria: cobrança indevida (16), estorno do valor pago (16), problemas gerais (12) e demora na execução (4).

Também li 2 análises escritas por **concorrentes** (MyMetric e Escalafy). Elas aparecem marcadas como tal e não contam como opinião de usuário.

Não achei nada sobre a UTMify no Reddit nem no Trustpilot.

**Cuidado ao ler:** a maioria das avaliações nas lojas é nota 5 e curta ("Top", "10"). A UTMify é bem avaliada; as reclamações abaixo são a minoria, mas é nelas que está a oportunidade.

Os textos completos estão em `replica/reviews.csv`. A ordenação automática do `reviews.py` usa palavras-chave em inglês, por isso a separação por temas abaixo foi feita lendo à mão.

## 1. O que eles odeiam

| # | problema | textos | fontes | força |
|---|---|---|---|---|
| 1 | Cobrança depois de cancelar, estorno e conta que não dá para excluir | 4 títulos + 16 + 16 nas categorias do Reclame Aqui; 2 nas lojas | 3 | **forte** |
| 2 | O app desloga todo dia, o Face ID falha, não consegue entrar | 7 | 2 | **forte** |
| 3 | App lento e travando: tabela não rola, colunas bagunçadas, fecha sozinho | 7 | 2 | forte |
| 4 | Números que não batem (com o Gerenciador, venda não rastreada, custo de produto) | 4 | 2 | médio |
| 5 | Erro ao mudar orçamento ou pausar pelo app | 3 | 1 | fraco (só Google Play) |
| 6 | O app não tem cadastro, só login | 3 | 2 | fraco |
| 7 | Suporte é robô e os tutoriais são incompletos | 2 | 2 | fraco |

Exemplos (texto copiado como está):
- Reclame Aqui: "Fui cobrado indevidamente após cancelar meu plano"
- Reclame Aqui: "Não consigo excluir minha conta e o suporte não responde"
- App Store (1★): "Praticamente todos os dias eu preciso logar no app de novo porque ele fica deslogando. Nada prático"
- Google Play (1★): "depois da última atualização as colunas ficaram bugadas, sem se reorganizar. E não estou conseguindo matar as campanhas."
- App Store (1★): "Acontecendo divergências entre os dados do gerenciador e o app da utmfy. Fica difícil trabalhar assim"
- Google Play (sem nota): "custo de produtos não batem, poderiam corrigir em definitivo"

## 2. O que pedem pelo nome

Todos são **fracos**: 1 pedido cada.

- Exportar a planilha dos criativos (Google Play, 3★).
- Contar conversas e custo de campanhas de WhatsApp (Google Play, 5★).
- Widget na tela de bloqueio do iPhone (App Store, 4★).
- Tela que gira na horizontal (App Store, 4★).
- Segundo concorrentes, sem confirmação de usuário: envio pela API de Conversões do Meta não documentado; sem marketplaces (Mercado Livre, Shopee); custo de parcelamento sem juros fora do lucro.

## 3. O que eles amam (o Clickify precisa ter também)

- **Regras automáticas**, 3 textos: "Agora nem preciso ficar acordando cedo ou ficar me preocupando em matar conj kkkkk as regra é muito bom filho" (App Store, 5★). **O Clickify ainda não tem.**
- **Notificações de venda e de resumo**, 2 textos: "As notificações de resumo são um show a parte!" (Google Play). **O Clickify ainda não tem.**
- Pausar e escalar direto do relatório, sem abrir o Gerenciador. O Clickify já tem.

## 4. Grupos que eles atendem mal

- **Loja física com produto próprio, que vende parcelado ou em marketplace.** Fonte: análises de concorrentes; não confirmado por usuários.
- **Quem está começando**: "era otimo, agora não tem mais o plano gratuito" (Google Play, 1★) e "não sei usar" (Google Play, 1★). Fraco.

## Plano de melhorias do Clickify

| # | o quê | tamanho | evidência | situação no Clickify |
|---|---|---|---|---|
| 1 | Cancelar em 1 clique, sem cobrança depois do cancelamento, e excluir a conta sozinho | P | tema 1 (forte) | Excluir conta **já existe**. Cancelamento entra quando houver cobrança. |
| 2 | Sessão que não cai: 30 dias logado, com "sair de todos os dispositivos" | — | tema 2 (forte) | **Já é assim.** Vale virar argumento de venda. |
| 3 | Tela "por que não bate?": compras que o Meta contou × vendas que o checkout mandou, por campanha | M | tema 4 | Novo. O pixel pelo servidor ajuda a reduzir a diferença. |
| 4 | Telas leves no celular, com tabela que rola | P | tema 3 | Teste MOB-1 já cobre 390px. Falta virar app instalável (PWA). |
| 5 | Pausar e orçamento confiáveis, com erro claro | P | tema 5 | Já tem confirmação e mensagem de erro do Meta. |
| 6 | Regras automáticas, ligadas por quem usa, em cima das sugestões da tela Hoje | M/G | o que amam (3 textos) | Novo. A tela Hoje já tem as regras; falta aplicar sozinho, com registro do que foi feito. |
| 7 | Avisos de venda e resumo do dia (e-mail, celular ou Telegram) | M | o que amam (2 textos) | Novo. |
| 8 | Pixel pelo servidor (API de Conversões) | M | pedido via concorrente | **Em construção agora.** |

## Posicionamento: 3 opções

**A. Sem sustos na cobrança** *(recomendada)*
> Para quem roda tráfego e já levou cobrança depois de cancelar, o Clickify cancela em 1 clique e apaga a sua conta quando você pedir.
> Evidência: tema 1. Foram 32 reclamações em 12 meses no Reclame Aqui, metade sobre cobrança indevida, mais textos nas 2 lojas.

**B. Logado e com números que batem**
> Para quem perde tempo logando todo dia e conferindo número que não bate, o Clickify fica logado 30 dias e mostra de onde vem cada número.
> Evidência: temas 2 e 4, com 11 textos em 2 fontes.

**C. Diz o que fazer, não só mostra**
> Para quem abre o painel e ainda precisa decidir sozinho, o Clickify diz o que pausar e o que escalar hoje, com o motivo.
> Evidência: o que mais elogiam (regras automáticas). Quem não sabe usar sofre (fraco).

Recomendo a **A** como promessa e a **C** como diferencial do produto. Não usar o nome UTMify em anúncio, nome ou loja; um comparativo direto é assunto para advogado.
