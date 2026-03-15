-- ============================================================
-- Migration 00005: Create message_logs table
-- Records every outbound WhatsApp message sent through the API.
-- Indexed for fast per-user and per-session queries.
-- ============================================================

create table public.message_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  session_id   uuid references public.wa_sessions(id) on delete set null,
  to_number    text not null,
  msg_type     text not null default 'text',
  -- values: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'bulk'
  content      text,
  -- truncated preview of message body
  media_url    text,
  credits_cost integer not null default 1,
  status       text not null default 'pending',
  -- values: 'pending' | 'sent' | 'failed' | 'queued'
  error_msg    text,
  waha_msg_id  text,
  -- message ID returned from WAHA
  sent_at      timestamptz not null default now()
);

-- Indexes for fast user log queries
create index idx_message_logs_user_id    on public.message_logs(user_id);
create index idx_message_logs_sent_at    on public.message_logs(sent_at desc);
create index idx_message_logs_session_id on public.message_logs(session_id);
