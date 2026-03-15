-- ============================================================
-- Migration 00003: Create wa_sessions table
-- Tracks WhatsApp sessions connected via WAHA (NOWEB engine).
-- Each session maps to a WAHA session identifier unique per user.
-- ============================================================

create table public.wa_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  session_name    text not null,
  -- must be unique per user, used as WAHA session identifier
  phone_number    text,
  status          text not null default 'STOPPED',
  -- values: 'STOPPED' | 'STARTING' | 'SCAN_QR_CODE' | 'CONNECTED' | 'FAILED'
  engine          text not null default 'NOWEB',
  qr_code         text,
  -- base64 QR image, cleared once connected
  waha_session_id text unique,
  -- the actual session name sent to WAHA API
  last_active     timestamptz,
  connected_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(user_id, session_name)
);
