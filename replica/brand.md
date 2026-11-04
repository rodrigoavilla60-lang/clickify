# Marca: Clickify

Data: 2026-11-01. Nome e logo enviados pelo usuário.

## Logo

- Original: `brand/clickify-logo.webp` (fundo transparente, nome em petróleo escuro).
- No app: ícone redesenhado em SVG (`app/src/components/logo.tsx`) + "Clickify" como texto,
  porque o nome escuro some no tema escuro. Favicon: `app/src/app/icon.svg`
  (ícone sobre um quadrado petróleo).
- Falta para o lançamento: o nome numa versão clara (para fundo escuro) e um ícone de app em 1024×1024.

## Paleta

| papel | cor | origem |
| --- | --- | --- |
| verde da marca / destaque | #1ab796 | logo |
| menta / sucesso | #a4e7d6 | logo |
| petróleo | #0e3533 | logo (nome) |
| fundo / cartão / cartão 2 | #071413 / #0c1f1d / #122a27 | derivados do petróleo |
| texto / texto secundário | #e6f4f0 / #94b4ae | derivados |

Contraste: 14 combinações, 0 falhas no padrão AA (`contrast.py design/tokens.json`).

## Varredura

`sweep.py app/src --config brand.json`: limpo, nada de "UTMify" ou do domínio dela no código.

## Checagens a fazer (não feitas)

| checagem | situação |
| --- | --- |
| INPI (Brasil), classes 9 e 42 | a fazer |
| USPTO / EUIPO, se for vender fora | a fazer |
| domínios clickify.com / .com.br | a fazer |
| Instagram / X / lojas de apps | a fazer |

Observação: "Clickify" e "UTMify" terminam igual ("-ify"), um sufixo comum em software
(Shopify, Spotify), mas as duas são ferramentas de rastreamento. Vale um advogado de marcas
avaliar o risco de confusão antes de investir na marca.
