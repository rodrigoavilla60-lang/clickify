# Ligar o Clickify ao seu Meta Ads de verdade

Tempo: uns 15 minutos. Você faz tudo no site do Meta; nenhuma senha ou chave passa por mim.
Para uso próprio não precisa de revisão do Meta: o app fica em **modo de desenvolvimento**
e só você (administrador do app) consegue conectar.

Os nomes dos menus podem estar um pouco diferentes: o Meta muda essa interface com frequência.

## 1. Criar o app

1. Entre em https://developers.facebook.com com o mesmo Facebook que acessa suas contas de anúncio.
   Se for o primeiro acesso, ele pede para virar desenvolvedor (aceitar os termos e confirmar o telefone).
2. **Meus apps → Criar app**.
3. Nome: algo como "Clickify - uso interno". E-mail de contato: o seu.
4. Em **Casos de uso**, escolha **Criar e gerenciar anúncios com a API de Marketing**.
   Isso já adiciona a **API de Marketing** e o **Login do Facebook para Empresas**.
5. Em **Empresa**, escolha o seu portfólio empresarial (o Business Manager onde estão as contas).
6. Conclua. O app nasce em modo de desenvolvimento, e é assim que ele deve ficar.

## 2. Criar a configuração de login

1. No menu do app: **Login do Facebook para Empresas → Configurações** → **Criar configuração**.
2. Nome: "Clickify".
3. Tipo de token: **Token de acesso do usuário** (User access token).
4. Permissões: marque **ads_read** e **ads_management**. Não precisa de mais nada.
5. Salve e copie o **ID da configuração** (um número).

## 3. Liberar o endereço de retorno

Em desenvolvimento, **não precisa fazer nada**: o Meta aceita `http://localhost` sozinho e
recusa se você tentar cadastrar (confirmado no teste de 2026-11-01).

Em produção: **Login do Facebook para Empresas → Configurações** → **URIs de redirecionamento
do OAuth válidos** → adicione `https://SEU_DOMINIO/api/meta/callback` e salve.

## 4. Copiar as chaves

1. **Configurações do app → Básico**.
2. Copie o **ID do aplicativo** e a **Chave secreta do aplicativo** (clique em "Mostrar"; ele pede sua senha do Facebook).

## 5. Colar no projeto

Abra o arquivo `app/.env.local` (já criei, com os campos vazios) e preencha:

```
META_MODE=live
META_APP_ID=<ID do aplicativo>
META_APP_SECRET=<chave secreta>
META_CONFIG_ID=<ID da configuração do passo 2>
```

A chave secreta fica só nesse arquivo, que não vai para o git. Não cole a chave no chat.

## 6. Testar

1. Reinicie o servidor (`npm run dev` dentro de `app/`).
2. Crie uma **conta nova** no Clickify. A conta de teste antiga tem as contas simuladas,
   que dariam erro de sincronização no modo real.
3. **Contas de anúncio → Conectar com o Meta**. O Meta mostra a tela de permissão; escolha as contas de anúncio.
4. Na volta, a primeira conta já vem ativa e o app puxa 30 dias de gasto. Ative as outras se quiser.
5. Abra **Campanhas** e compare o gasto de hoje com o do Gerenciador de Anúncios.
   Diferença de alguns centavos é normal (o Meta atualiza o gasto em lotes).

Se der erro, a mensagem do Meta aparece em vermelho na tela de Contas. Me mande o texto dela.

## Depois, para vender para outras pessoas

Aí o app precisa sair do modo de desenvolvimento, e o Meta exige:
- **Acesso Avançado** a ads_read e ads_management, pedido em **Revisão do app** (com vídeo do fluxo e política de privacidade);
- **Verificação da empresa** no Business Manager.

Leva semanas. Só vale começar quando o produto estiver decidido.
