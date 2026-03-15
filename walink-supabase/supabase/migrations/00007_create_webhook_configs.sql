-- ============================================================
-- Migration 00007: Create webhook_configs table
-- Stores user-defined webhook endpoints for receiving events.
-- Auto-disabled after 10 consecutive delivery failures.
-- Payload is signed using HMAC-SHA256 with the stored secret.
-- ============================================================

create table public.webhook_configs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  url        text not null,
  secret     text not null,
  -- used to sign webhook payload (HMAC-SHA256)
  events     text[] not null default array['message.received'],
  -- e.g. ['message.received','session.connected','session.disconnected']
  is_active  boolean not null default true,
  fail_count integer not null default 0,
  -- auto-disable after 10 consecutive failures
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
