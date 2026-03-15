-- ============================================================
-- Migration 00004: Create credit_transactions table
-- Immutable ledger of all credit movements per user.
-- Positive amount = credits added, negative = credits deducted.
-- ============================================================

create table public.credit_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  amount      integer not null,
  -- positive = credit added, negative = credit deducted
  type        text not null,
  -- values: 'purchase' | 'usage' | 'refund' | 'bonus' | 'plan_renewal'
  description text,
  ref_id      uuid,
  -- optional: references payment id or message_log id
  balance_after integer not null,
  created_at  timestamptz not null default now()
);
