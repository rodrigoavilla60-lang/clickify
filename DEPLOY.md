# Colocar o Clickify no ar em clickify.acaoeduca.com

O site em `acaoeduca.com` não é afetado: o Clickify fica num **subdomínio**.
Para trocar depois pelo domínio definitivo, é só adicionar o novo na Vercel (passo 4) e no Meta (passo 5).

## 1. Banco de dados: Neon (feito)

Projeto `Clickify` em **AWS South America East 1 (São Paulo)**, com Connection pooling ligado.
A string de conexão é o `DATABASE_URL`. Ao colar, **apague o final `&channel_binding=require`**.

As tabelas são criadas sozinhas no primeiro acesso; não precisa rodar nada.

## 2. Hospedagem: Vercel (você, depois eu)

1. Conta criada em https://vercel.com.
2. No terminal, dentro de `D:\Clickify\app`, rode `npx vercel login` e confirme no navegador.
3. Me avise quando estiver logado: eu crio o projeto e faço o primeiro deploy (`npx vercel`).

> O plano grátis da Vercel (Hobby) é para uso **não comercial**. Usar para acompanhar as vendas
> da sua loja pode contar como comercial; para ficar dentro das regras, o plano Pro custa US$ 20/mês.

## 3. Variáveis de ambiente (você)

Na Vercel: projeto **clickify** → **Settings → Environment Variables** → adicione, para **Production**:

| nome | valor |
| --- | --- |
| `DATABASE_URL` | a string do Neon (passo 1), sem o `&channel_binding=require` |
| `APP_ENCRYPTION_KEY` | do arquivo `segredos-producao.txt` em `D:\Clickify` |
| `CRON_SECRET` | do mesmo arquivo |
| `META_MODE` | `live` |
| `META_APP_ID` | `1092962970397458` |
| `META_CONFIG_ID` | `1438201861101832` |
| `META_APP_SECRET` | a mesma chave secreta do Meta que você pôs no `.env.local` |

Depois de salvar, eu publico de novo (`npx vercel --prod`) para os valores valerem.

## 4. Domínio (você, na Hostinger)

1. Na Vercel: **Settings → Domains → Add** → `clickify.acaoeduca.com`.
2. A Vercel mostra um registro **CNAME**. Copie o valor exato que ela mostrar (algo como `xxxx.vercel-dns-017.com`).
3. Na Hostinger (hPanel): **Domínios → acaoeduca.com → DNS / Nameservers → Gerenciar registros DNS**:
   - Tipo: **CNAME**
   - Nome: **clickify**
   - Aponta para: o valor que a Vercel mostrou
   - TTL: deixe o padrão
4. Espere o ✓ "Valid Configuration" na Vercel (de minutos a algumas horas). O HTTPS é automático.

## 5. Meta (fazemos juntos)

No app Clickify do Meta for Developers: **Login do Facebook para Empresas → Configurações →
URIs de redirecionamento do OAuth válidos** → adicione `https://clickify.acaoeduca.com/api/meta/callback` → salve.

## 6. Primeiro acesso

1. Abra https://clickify.acaoeduca.com e crie sua conta (uma nova: o banco é novo).
2. **Contas de anúncio → Conectar com o Meta** → ative a VittaConfort e as outras que quiser.
3. Webhooks: as URLs passam a começar com `https://clickify.acaoeduca.com/api/webhooks/...`.

## Quando o domínio definitivo chegar

1. Vercel → Domains → adicione o novo, e crie o CNAME dele no registrador.
2. Meta → adicione o novo endereço nas URIs de redirecionamento.
3. Atualize a URL do webhook em cada checkout.
4. Quando tudo estiver funcionando no novo, remova o antigo da Vercel e do Meta.

## Sincronização dos dados

O cron da Vercel roda uma vez por dia, às 6h de Brasília (limite do plano grátis). Além disso,
as telas de Resumo e Campanhas sincronizam sozinhas se a última sincronização tiver mais de 10 minutos.
