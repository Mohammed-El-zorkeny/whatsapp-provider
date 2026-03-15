-- ============================================================
-- Seed: WaLink Plans
-- Run after migrations to populate subscription tiers.
-- price_usd is stored in cents (e.g. 900 = $9.00/month).
-- Uses ON CONFLICT DO NOTHING so re-seeding is idempotent.
-- ============================================================

insert into public.plans
  (id, name, price_usd, monthly_credits, max_sessions, can_send_files, can_use_webhook, rate_limit_per_min, support_level)
values
  ('free',     'Free',     0,    50,    1,  false, false, 5,   'community'),
  ('starter',  'Starter',  900,  1000,  1,  true,  true,  20,  'email'),
  ('pro',      'Pro',      2500, 5000,  3,  true,  true,  60,  'priority'),
  ('business', 'Business', 6000, 20000, 10, true,  true,  120, 'dedicated')
on conflict (id) do nothing;
