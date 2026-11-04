# Components

Base: componentes próprios em `app/src/components/ui.tsx`, HTML semântico, sem
lib de UI. Ícones: Lucide (ISC). Fonte: Inter (OFL). Números sempre com
`tabular-nums` para as colunas alinharem.

```
Button
  variants  primary, secondary, ghost, danger
  sizes     sm 32px, md 40px
  states    default, hover, active, focus-visible (2px ring accent), disabled, loading
  tokens    primary: bg accent / text on-accent; secondary: bg surface-2 / border; radius md; font sm/600
  a11y      <button> real; loading mantém o texto e usa aria-busy
  used on   todas

Input / Select / Label / FieldError
  states    default, focus-visible, invalid (border danger + mensagem ligada por aria-describedby), disabled
  tokens    bg surface, border border-input, radius md, height 40
  a11y      <label for>, erro anunciado
  used on   S01, S02, S08, S14

Card
  tokens    bg surface, border, radius lg, padding 16/24
  used on   S03, S04, S07, S08, S09, S10

KPI card
  variants  money, percent, ratio, count
  states    loading (skeleton), vazio ("—"), positivo (success), negativo (danger, só para lucro e ROI)
  tokens    label xs/muted, valor xl tabular-nums
  used on   S04

DataTable
  variants  com linhas clicáveis (drill-down de nível), compacta
  states    loading (skeleton de 5 linhas), vazio (mensagem + ação), filled, erro
  details   cabeçalho fixo; colunas numéricas alinhadas à direita; ordenação por clique no
            cabeçalho com aria-sort; rolagem horizontal no celular com a 1ª coluna fixa
  used on   S05, S06, S07

StatusToggle (ativo/pausado)
  states    on, off, confirmando, saving (desabilitado), erro (volta ao estado anterior + mensagem)
  confirm   clique abre um <dialog> modal: "Pausar/Ativar "nome" no Meta?" + o efeito em uma frase.
            Confirmar (danger ao pausar, primary ao ativar) recebe o foco; Cancelar e Esc fecham sem mudar nada.
            Motivo: no teste real, um clique solto pausou uma campanha de verdade.
  a11y      <button role="switch" aria-checked aria-haspopup="dialog">, label com o nome do objeto;
            o dialog só existe enquanto aberto e é rotulado pelo título
  used on   S05, S09

StatusBadge
  variants  approved (success), pending (warning), refused (muted), refunded (muted), chargeback (danger),
            ACTIVE (success), PAUSED (muted)
  a11y      texto sempre presente, cor nunca sozinha
  used on   S05, S06

PeriodPicker
  presets   hoje, ontem, 7 dias, 30 dias, este mês
  details   vai na URL (?p=7d) para o link ser compartilhável
  used on   S04, S05, S06

CopyField
  states    default, copiado (2s, ícone de check + aria-live "Copiado")
  tokens    bg bg, font mono xs, border
  used on   S08, S10

Stepper (checklist do onboarding)
  states    pendente, feito, atual
  used on   S03

Sidebar nav
  details   240px no desktop; no celular vira barra de topo com menu
  states    item atual com bg surface-2 e aria-current="page"
  used on   todas as telas logadas

EmptyState
  details   ícone, uma frase, uma ação
  used on   S04, S05, S06, S07, S09

Flash/Toast
  details   aria-live="polite"; erro em danger
```
