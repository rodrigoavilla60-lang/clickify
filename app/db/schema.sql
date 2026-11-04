-- Schema v1: o loop principal (Meta + Shopify + webhook genérico).
-- Postgres 15+. Roda igual no PGlite (dev local) e no Neon/Supabase (produção).
-- Dinheiro em centavos (bigint) + moeda. Datas em timestamptz (UTC).
-- Acesso: checagem no data layer. Toda query filtra por workspace_id do dono da sessão.

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sessions (
  id text primary key,                      -- sha256 do token do cookie, nunca o token
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on sessions (user_id);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  name text not null,
  timezone text not null default 'America/Sao_Paulo',
  currency text not null default 'BRL',
  tax_rate_bps integer not null default 0 check (tax_rate_bps between 0 and 10000),
  gateway_fee_bps integer not null default 0 check (gateway_fee_bps between 0 and 10000),
  onboarding_utms_copied boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on workspaces (owner_id);

create table ad_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider text not null default 'meta' check (provider in ('meta')),
  external_id text not null,                -- act_123...
  name text not null,
  currency text not null default 'BRL',
  timezone text not null default 'America/Sao_Paulo',
  access_token_enc text,                    -- AES-256-GCM com APP_ENCRYPTION_KEY
  token_expires_at timestamptz,
  enabled boolean not null default true,
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, external_id)
);
create index on ad_accounts (workspace_id);

-- Campanha, conjunto e anúncio numa tabela só: é a mesma árvore do Meta.
create table ad_objects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  ad_account_id uuid not null references ad_accounts(id) on delete cascade,
  level text not null check (level in ('campaign','adset','ad')),
  external_id text not null,
  parent_external_id text,                  -- adset -> campaign, ad -> adset
  campaign_external_id text,                -- atalho para agrupar sem recursão
  name text not null,
  status text not null check (status in ('ACTIVE','PAUSED','DELETED','ARCHIVED','OTHER')),
  daily_budget_cents bigint,                -- nulo quando o orçamento está no outro nível
  updated_at timestamptz not null default now(),
  unique (ad_account_id, level, external_id)
);
create index on ad_objects (workspace_id, level);
create index on ad_objects (ad_account_id);

-- Gasto por anúncio por dia (no fuso da conta de anúncio, como o Meta reporta).
create table ad_insights_daily (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  ad_account_id uuid not null references ad_accounts(id) on delete cascade,
  campaign_external_id text not null,
  adset_external_id text not null,
  ad_external_id text not null,
  date date not null,
  spend_cents bigint not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (ad_account_id, ad_external_id, date)
);
create index on ad_insights_daily (workspace_id, date);

create table webhooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  platform text not null check (platform in ('shopify','generic')),
  name text not null,
  token text not null unique,               -- vai na URL: /api/webhooks/{token}
  signing_secret text,                      -- Shopify: segredo do app para checar o HMAC
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on webhooks (workspace_id);

-- Tudo que chega fica guardado: dá para reprocessar e depurar.
create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  webhook_id uuid not null references webhooks(id) on delete cascade,
  dedupe_key text not null,                 -- id do evento da plataforma, ou hash do corpo
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (webhook_id, dedupe_key)
);
create index on webhook_events (workspace_id, received_at desc);

create table orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  webhook_id uuid references webhooks(id) on delete set null,
  platform text not null,
  external_id text not null,
  status text not null check (status in ('approved','pending','refused','refunded','chargeback')),
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'BRL',
  product_name text,
  customer_email_hash text,                 -- sha256, nunca o e-mail em claro
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  campaign_external_id text,                -- preenchidos pela atribuição
  adset_external_id text,
  ad_external_id text,
  ordered_at timestamptz not null,
  approved_at timestamptz,
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, platform, external_id)  -- o mesmo pedido chega várias vezes: upsert
);
create index on orders (workspace_id, ordered_at desc);
create index on orders (workspace_id, status);
create index on orders (workspace_id, campaign_external_id);
create index on orders (workspace_id, ad_external_id);
