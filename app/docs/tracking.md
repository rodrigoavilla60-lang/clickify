# Clickify Tracking — script first-party (t.js)

O `t.js` é o equivalente ao `utms/latest.js` da UTMify: um snippet leve (<7 KB, sem
dependências) que captura UTMs + click IDs no navegador do visitante e persiste por
30 dias. Quando a venda chega pelo webhook com o `ck_vid`, o Clickify liga o pedido
ao clique original — mesmo que o checkout não repasse as UTMs.

## Instalação

1. No Clickify: **Conexões → Tracking → Novo site**. Copie o snippet:
   ```html
   <script src="https://SEU-DOMINIO/t.js" data-site="ck_SUA_CHAVE" async></script>
   ```
2. Cole no `<head>` de todas as páginas (site, páginas de venda, checkout — onde
   você controlar o HTML).

### Via CNAME (recomendado)

Sem CNAME o script roda no domínio do app (third-party): funciona, mas bloqueadores
de anúncio podem barrar. Com CNAME vira first-party de verdade:

1. Crie o registro DNS: `t.seudominio.com` → CNAME → `SEU-DOMINIO`
2. Use o snippet com o seu subdomínio:
   ```html
   <script src="https://t.seudominio.com/t.js" data-site="ck_SUA_CHAVE" async></script>
   ```
   O endpoint de coleta (`/api/t/e`) é derivado da origem do script, então não há
   mais nada para configurar no Clickify.

### LGPD / consentimento

Por padrão o script rastreia direto. Se o seu banner de cookies exige opt-in:

```html
<script src="https://SEU-DOMINIO/t.js" data-site="ck_SUA_CHAVE" data-consent="1" async></script>
<script>
  // chame após o aceite:
  window.Clickify.consent(true);
</script>
```

Sem o aceite, nada é capturado nem enviado. O script nunca coleta nome, e-mail ou
qualquer dado pessoal — só UTMs, click IDs e um ID anônimo de visitante.

## Como funciona

1. **Clique no anúncio** → URL com `utm_*` / `fbclid` / `gclid` / `ttclid`…
2. **t.js** lê os parâmetros, gera o `ck_vid` (cookie first-party `SameSite=Lax`,
   30 dias + backup em `localStorage`) e manda um beacon para `/api/t/e`.
3. **Visita direta não apaga atribuição paga**: o cookie só é sobrescrito quando a
   nova visita traz parâmetro pago.
4. **No checkout**, o script injeta `ck_vid` + UTMs como campos ocultos em todo
   `<form>`. No Shopify eles chegam como `note_attributes` e o Clickify usa
   automaticamente. Em checkout próprio, leia `window.Clickify.attribution()` e
   `window.Clickify.visitorId()` e envie junto ao pedido (o webhook genérico aceita
   o campo `ck_vid`).
5. **Na venda**, `findClickAttribution()` busca o último clique do visitante nos
   últimos 30 dias e preenche campanha/conjunto/anúncio do pedido. O clique
   persistido tem prioridade sobre as UTMs do webhook.

O script também propaga as UTMs nos links internos do site, para a atribuição
sobreviver à navegação entre páginas.

## Testando

1. Abra a página com o snippet e `?utm_source=teste&utm_campaign=minha|123456789` na URL.
2. Em **Conexões → Tracking**, o site deve mostrar 1 visitante e 1 clique.
3. No console: `Clickify.attribution()` deve devolver os parâmetros.
4. Faça um pedido de teste: a venda deve chegar com a campanha atribuída.

## Limites do MVP

- Pageviews sem parâmetro pago só atualizam o visitante (não geram linha de clique):
  o volume do coletor fica sob controle.
- Rate limit: 180 requisições/min por IP no coletor.
- O CNAME exige que o DNS do cliente aponte para o app; em dev local, use o
  snippet direto (sem CNAME).
