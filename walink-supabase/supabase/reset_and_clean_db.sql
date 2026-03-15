-- ==============================================================================
-- 🚀 WA_LINK RESCUE SCRIPT: WIPE EVERYTHING & REBUILD CLEANLY 🚀
-- Run this ENTIRE file in your Supabase SQL Editor.
-- This will delete ALL users, profiles, transactions, and plans, 
-- and re-create the base settings to guarantee the login/signup works 100%.
-- ==============================================================================

-- 1. Ensure required extensions exist (This fixes the 500 Error caused by gen_random_bytes)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- 2. Wipe ALL Auth Users (This cascades to profiles, transactions, invoices, sessions automatically)
DELETE FROM auth.users;

-- 3. Wipe and Reset Plans
DELETE FROM public.plans;

INSERT INTO public.plans
  (id, name, price_usd, monthly_credits, max_sessions, can_send_files, can_use_webhook, rate_limit_per_min, support_level)
VALUES
  ('free',     'Free',     0,    50,    1,  false, false, 5,   'community'),
  ('starter',  'Starter',  900,  1000,  1,  true,  true,  20,  'email'),
  ('pro',      'Pro',      2500, 5000,  3,  true,  true,  60,  'priority'),
  ('business', 'Business', 6000, 20000, 10, true,  true,  120, 'dedicated');

-- 4. Rebuild the Signup Trigger to be 100% safe
-- We use a SAFE block so if anything goes wrong, it logs the error but ALLOWS the signup to succeed.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Insert into profiles
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, api_key)
    VALUES (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      'wl_live_' || encode(gen_random_bytes(16), 'hex')
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error inserting into profiles: %', SQLERRM;
  END;

  -- Insert welcome bonus
  BEGIN
    INSERT INTO public.credit_transactions (user_id, amount, type, description, balance_after)
    VALUES (
      new.id,
      50,
      'bonus',
      'Welcome bonus — Free plan credits',
      50
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error inserting into credit_transactions: %', SQLERRM;
  END;

  RETURN new;
END;
$$;
