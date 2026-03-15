-- ============================================================
-- Migration 00001: Create plans table
-- Plans define the subscription tiers available to users.
-- price_usd is stored in cents (0=free, 900=$9, 2500=$25, 6000=$60)
-- ============================================================

create table public.plans (
  id                  text primary key,
  -- values: 'free' | 'starter' | 'pro' | 'business'
  name                text not null,
  price_usd           integer not null default 0,
  -- stored in cents: 0=free, 900=starter, 2500=pro, 6000=business
  monthly_credits     integer not null,
  max_sessions        integer not null,
  can_send_files      boolean not null default false,
  can_use_webhook     boolean not null default false,
  rate_limit_per_min  integer not null default 10,
  support_level       text not null default 'community',
  -- values: 'community' | 'email' | 'priority' | 'dedicated'
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);
-- ============================================================
-- Seeding: Default Plans
-- Required for foreign key constraints in profiles table
-- ============================================================
insert into public.plans (id, name, price_usd, monthly_credits, max_sessions, can_send_files, can_use_webhook, rate_limit_per_min, support_level)
values
  ('free', 'Free', 0, 100, 1, false, false, 10, 'community'),
  ('starter', 'Starter', 2900, 5000, 1, true, true, 60, 'email'),
  ('pro', 'Pro', 9900, 50000, 3, true, true, 300, 'priority'),
  ('business', 'Business', 49900, 500000, 10, true, true, 1000, 'dedicated')
on conflict (id) do nothing;
