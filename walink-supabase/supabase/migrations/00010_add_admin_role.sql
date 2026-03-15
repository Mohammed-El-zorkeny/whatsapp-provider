-- ============================================================
-- Migration 00010: Admin role, invoices, notifications
-- Adds admin role to profiles, creates invoices table with
-- auto-generated invoice numbers, and notifications table.
-- ============================================================

-- Add role column to profiles
alter table public.profiles
add column if not exists role text not null default 'user';
-- values: 'user' | 'admin'

-- Add notification_prefs column (needed for settings page)
alter table public.profiles
add column if not exists notification_prefs jsonb default '{}';

-- ============================================================
-- Invoices table
-- Invoices are created by admin when adding credits to a user.
-- ============================================================
create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  invoice_number  text unique not null,
  amount_cents    integer not null,
  currency        text not null default 'USD',
  credits_added   integer not null,
  plan_id         text references public.plans(id),
  status          text not null default 'paid',
  -- values: 'paid' | 'pending' | 'cancelled'
  notes           text,
  issued_by       uuid references public.profiles(id),
  issued_at       timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- ============================================================
-- Auto-generate invoice number: INV-YYYYMM-XXXX
-- Sequential within each calendar month.
-- ============================================================
create or replace function public.generate_invoice_number()
returns trigger language plpgsql as $$
declare
  v_count integer;
  v_number text;
begin
  select count(*) into v_count from public.invoices
  where date_trunc('month', created_at) = date_trunc('month', now());
  v_number := 'INV-' || to_char(now(), 'YYYYMM') || '-' || lpad((v_count + 1)::text, 4, '0');
  new.invoice_number := v_number;
  return new;
end;
$$;

create trigger trg_generate_invoice_number
  before insert on public.invoices
  for each row execute function public.generate_invoice_number();

-- ============================================================
-- Notifications table
-- In-app notifications. user_id = null means broadcast to all.
-- ============================================================
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade,
  -- null = broadcast to all users
  title       text not null,
  message     text not null,
  type        text not null default 'info',
  -- values: 'info' | 'warning' | 'success'
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);
