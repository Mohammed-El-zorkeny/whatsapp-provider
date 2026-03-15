-- ============================================================
-- Migration 00006: Create payments table
-- Tracks all payment transactions (plan subscriptions & credit top-ups).
-- provider_ref is unique to prevent duplicate webhook processing.
-- ============================================================

create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  plan_id       text references public.plans(id),
  -- null if it's a credit top-up without plan change
  amount_cents  integer not null,
  currency      text not null default 'USD',
  provider      text not null,
  -- values: 'paymob' | 'stripe'
  provider_ref  text unique,
  -- payment ID from provider
  credits_added integer not null default 0,
  status        text not null default 'pending',
  -- values: 'pending' | 'paid' | 'failed' | 'refunded'
  paid_at       timestamptz,
  created_at    timestamptz not null default now()
);
