-- ============================================================
-- Migration 00008: Row Level Security (RLS) Policies
-- Enforces that users can only access their own data.
-- Plans are publicly readable (needed for pricing pages).
-- All write operations from the backend use service_role_key
-- which bypasses RLS — these policies protect frontend access.
-- ============================================================

-- Enable RLS on all tables
alter table public.plans               enable row level security;
alter table public.profiles            enable row level security;
alter table public.wa_sessions         enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.message_logs        enable row level security;
alter table public.payments            enable row level security;
alter table public.webhook_configs     enable row level security;

-- ============================================================
-- plans: anyone can read (public — needed for pricing UI)
-- ============================================================
create policy "plans_public_read" on public.plans
  for select using (true);

-- ============================================================
-- profiles: users can only see and update their own row
-- ============================================================
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- ============================================================
-- wa_sessions: full CRUD for session owner only
-- ============================================================
create policy "sessions_select_own" on public.wa_sessions
  for select using (auth.uid() = user_id);

create policy "sessions_insert_own" on public.wa_sessions
  for insert with check (auth.uid() = user_id);

create policy "sessions_update_own" on public.wa_sessions
  for update using (auth.uid() = user_id);

create policy "sessions_delete_own" on public.wa_sessions
  for delete using (auth.uid() = user_id);

-- ============================================================
-- credit_transactions: read-only for user (ledger is immutable)
-- ============================================================
create policy "transactions_select_own" on public.credit_transactions
  for select using (auth.uid() = user_id);

-- ============================================================
-- message_logs: read-only for user (logs written by backend)
-- ============================================================
create policy "logs_select_own" on public.message_logs
  for select using (auth.uid() = user_id);

-- ============================================================
-- payments: read-only for user (written by payment webhook handler)
-- ============================================================
create policy "payments_select_own" on public.payments
  for select using (auth.uid() = user_id);

-- ============================================================
-- webhook_configs: full CRUD for webhook owner only
-- ============================================================
create policy "webhooks_select_own" on public.webhook_configs
  for select using (auth.uid() = user_id);

create policy "webhooks_insert_own" on public.webhook_configs
  for insert with check (auth.uid() = user_id);

create policy "webhooks_update_own" on public.webhook_configs
  for update using (auth.uid() = user_id);

create policy "webhooks_delete_own" on public.webhook_configs
  for delete using (auth.uid() = user_id);
