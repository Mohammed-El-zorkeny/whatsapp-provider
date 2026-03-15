-- ============================================================
-- Migration 00009: RPC Functions (all use security definer)
-- These run as the DB owner and bypass RLS intentionally.
-- Only called by the Express backend using service_role_key.
-- ============================================================


-- ============================================================
-- Function 1: deduct_credits
-- Atomically deducts credits from a user's balance.
-- Uses FOR UPDATE row lock to prevent race conditions when two
-- concurrent API requests both pass the balance check.
-- Returns JSON: { success, balance } or { success, error }
-- ============================================================
create or replace function public.deduct_credits(
  p_user_id    uuid,
  p_amount     integer,
  p_description text,
  p_ref_id     uuid default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_balance     integer;
  v_new_balance integer;
begin
  -- Lock the row to prevent race conditions
  select credits_balance into v_balance
  from public.profiles
  where id = p_user_id
  for update;

  if v_balance is null then
    return json_build_object('success', false, 'error', 'user_not_found');
  end if;

  if v_balance < p_amount then
    return json_build_object(
      'success', false,
      'error',   'insufficient_credits',
      'balance', v_balance
    );
  end if;

  v_new_balance := v_balance - p_amount;

  -- Deduct from profile and increment monthly usage counter
  update public.profiles
  set
    credits_balance    = v_new_balance,
    credits_used_month = credits_used_month + p_amount,
    updated_at         = now()
  where id = p_user_id;

  -- Write immutable ledger entry
  insert into public.credit_transactions
    (user_id, amount, type, description, ref_id, balance_after)
  values
    (p_user_id, -p_amount, 'usage', p_description, p_ref_id, v_new_balance);

  return json_build_object('success', true, 'balance', v_new_balance);
end;
$$;


-- ============================================================
-- Function 2: add_credits
-- Credits a user's balance (after payment confirmed, bonus, refund, etc.)
-- Returns JSON: { success, balance } or { success, error }
-- ============================================================
create or replace function public.add_credits(
  p_user_id     uuid,
  p_amount      integer,
  p_type        text,
  p_description text,
  p_ref_id      uuid default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_new_balance integer;
begin
  update public.profiles
  set
    credits_balance = credits_balance + p_amount,
    updated_at      = now()
  where id = p_user_id
  returning credits_balance into v_new_balance;

  if v_new_balance is null then
    return json_build_object('success', false, 'error', 'user_not_found');
  end if;

  -- Write immutable ledger entry
  insert into public.credit_transactions
    (user_id, amount, type, description, ref_id, balance_after)
  values
    (p_user_id, p_amount, p_type, p_description, p_ref_id, v_new_balance);

  return json_build_object('success', true, 'balance', v_new_balance);
end;
$$;


-- ============================================================
-- Function 3: get_user_by_api_key
-- Called by Express middleware on EVERY incoming API request.
-- Must be fast — relies on idx_profiles_api_key index created in 00002.
-- Returns user info joined with plan limits in a single DB round-trip.
-- ============================================================
create or replace function public.get_user_by_api_key(p_api_key text)
returns table (
  id                 uuid,
  plan_id            text,
  credits_balance    integer,
  is_active          boolean,
  max_sessions       integer,
  can_send_files     boolean,
  can_use_webhook    boolean,
  rate_limit_per_min integer
)
language sql
security definer
stable
as $$
  select
    p.id,
    p.plan_id,
    p.credits_balance,
    p.is_active,
    pl.max_sessions,
    pl.can_send_files,
    pl.can_use_webhook,
    pl.rate_limit_per_min
  from public.profiles p
  join public.plans pl on pl.id = p.plan_id
  where p.api_key  = p_api_key
    and p.is_active = true
  limit 1;
$$;


-- ============================================================
-- Function 4: reset_monthly_credits
-- Called by a cron job on the 1st of every month.
-- Resets credits_used_month counter back to 0 for all users.
-- Monthly credit allowance itself is managed by the payment flow.
-- ============================================================
create or replace function public.reset_monthly_credits()
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles
  set
    credits_used_month = 0,
    updated_at         = now();
end;
$$;
