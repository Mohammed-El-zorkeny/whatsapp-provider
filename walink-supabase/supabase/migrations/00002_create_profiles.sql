-- ============================================================
-- Migration 00002: Create profiles table
-- Extends Supabase auth.users with app-specific user data.
-- API key is auto-generated via trigger on insert.
-- ============================================================

create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text,
  email               text not null,
  api_key             text unique not null,
  plan_id             text not null default 'free' references public.plans(id),
  credits_balance     integer not null default 50,
  credits_used_month  integer not null default 0,
  plan_expires_at     timestamptz,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Index for fast API key lookups — Express calls this on every request
create index idx_profiles_api_key on public.profiles(api_key);

-- ============================================================
-- Trigger: auto-generate API key before insert
-- Format: wl_live_ + 32 random hex chars (16 bytes → 32 hex)
-- ============================================================
create or replace function public.generate_api_key()
returns trigger language plpgsql as $$
begin
  if new.api_key is null or new.api_key = '' then
    new.api_key := 'wl_live_' || md5(random()::text || clock_timestamp()::text);
  end if;
  return new;
end;
$$;

create trigger trg_generate_api_key
  before insert on public.profiles
  for each row execute function public.generate_api_key();

-- ============================================================
-- Trigger: auto-create profile row when a new auth user signs up
-- Uses security definer so it can insert into profiles from auth context
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  -- 1. Create the profile row (credits_balance defaults to 50)
  insert into public.profiles (id, email, full_name, api_key)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'wl_live_' || md5(random()::text || clock_timestamp()::text)
  );

  -- 2. Record the welcome bonus as a credit transaction
  insert into public.credit_transactions (user_id, amount, type, description, balance_after)
  values (
    new.id,
    50,
    'bonus',
    'Welcome bonus — Free plan credits',
    50
  );

  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
