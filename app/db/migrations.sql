-- Roda a cada início do servidor, depois do schema.sql. Tudo aqui precisa ser idempotente
-- (if not exists), porque o banco de produção já existe e não pode ser recriado.

-- 2026-11-01: funil de conversão (vem das "actions" do Meta, por anúncio e por dia).
alter table ad_insights_daily add column if not exists link_clicks bigint not null default 0;
alter table ad_insights_daily add column if not exists landing_page_views bigint not null default 0;
alter table ad_insights_daily add column if not exists add_to_cart bigint not null default 0;
alter table ad_insights_daily add column if not exists initiate_checkout bigint not null default 0;

-- 2026-11-01: checkouts brasileiros e modo "capturar" (guarda o evento para escrever o adaptador depois).
alter table webhooks drop constraint if exists webhooks_platform_check;
alter table webhooks add constraint webhooks_platform_check
  check (platform in ('shopify','generic','kiwify','hotmart','yampi','eduzz','capture'));

-- 2026-11-01: forma de pagamento, para "vendas por forma de pagamento" e taxa de aprovação.
alter table orders add column if not exists payment_method text;
alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check
  check (payment_method is null or payment_method in ('pix','card','boleto','other'));

-- 2026-11-01: lucro real (pacote 1). Imposto sobre o anúncio, custo por produto e despesas fixas.
alter table workspaces add column if not exists ad_tax_bps integer not null default 0;
alter table workspaces add column if not exists default_product_cost_cents bigint not null default 0;
alter table workspaces add column if not exists default_shipping_cents bigint not null default 0;

create table if not exists product_costs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  product_name text not null,                 -- casa com orders.product_name, sem diferenciar maiúsculas
  cost_cents bigint not null default 0 check (cost_cents >= 0),
  shipping_cents bigint not null default 0 check (shipping_cents >= 0),
  updated_at timestamptz not null default now()
);
create unique index if not exists product_costs_ws_name on product_costs (workspace_id, lower(product_name));

create table if not exists fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  monthly_cents bigint not null check (monthly_cents >= 0),
  created_at timestamptz not null default now()
);
create index if not exists fixed_expenses_ws on fixed_expenses (workspace_id);
create index if not exists orders_ws_product on orders (workspace_id, lower(product_name));

-- 2026-11-01: recuperar senha. Só o hash do token fica no banco; vale 1 hora e uma vez só.
create table if not exists password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists password_resets_user on password_resets (user_id);

-- 2026-11-01: pixel pelo servidor (API de Conversões do Meta).
-- Dados de correspondência do comprador, já com hash (ver src/lib/capi.ts). Apagados 8 dias
-- depois do pedido: o Meta não aceita compra com mais de 7 dias, então não servem para mais nada.
alter table orders add column if not exists capi_match jsonb;

create table if not exists pixels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  pixel_id text not null,                      -- ID do conjunto de dados no Gerenciador de Eventos
  access_token_enc text not null,              -- token da API de Conversões, AES-256-GCM
  test_event_code text,                        -- opcional: manda para a aba "Eventos de teste"
  webhook_id uuid references webhooks(id) on delete cascade, -- null = vendas de todos os checkouts
  enabled boolean not null default true,
  last_event_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (workspace_id, pixel_id, webhook_id)
);
create index if not exists pixels_ws on pixels (workspace_id);

create table if not exists capi_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  pixel_id uuid not null references pixels(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade, -- null = evento de teste
  event_name text not null default 'Purchase',
  status text not null default 'sending' check (status in ('sending','sent','failed','skipped')),
  fields text[] not null default '{}',         -- o que foi junto, em português (e-mail, telefone...)
  attempts integer not null default 0,
  response text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
-- Uma compra por pixel: o webhook pode chegar repetido, o envio não.
create unique index if not exists capi_events_once on capi_events (pixel_id, order_id, event_name) where order_id is not null;
create index if not exists capi_events_ws on capi_events (workspace_id, created_at desc);
