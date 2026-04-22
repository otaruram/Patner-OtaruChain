create extension if not exists pgcrypto;

create table if not exists public.partner_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null,
  status text not null default 'pending',
  started_at timestamptz,
  expires_at timestamptz,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_subscriptions_user_id
  on public.partner_subscriptions(user_id);

create table if not exists public.partner_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null,
  amount numeric not null default 0,
  currency text not null default 'IDR',
  provider text not null default 'louvin',
  provider_transaction_id text,
  payment_url text,
  status text not null default 'pending',
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_payments_user_id
  on public.partner_payments(user_id);

create index if not exists idx_partner_payments_provider_transaction_id
  on public.partner_payments(provider_transaction_id);
