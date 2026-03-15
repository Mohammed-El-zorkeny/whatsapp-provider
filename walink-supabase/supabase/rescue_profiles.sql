-- ============================================================
-- SQL Helper: Fix missing profiles and broken triggers
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Fix the generate_api_key trigger to NOT depend on pgcrypto
CREATE OR REPLACE FUNCTION public.generate_api_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.api_key IS NULL OR new.api_key = '' THEN
    new.api_key := 'wl_live_' || md5(random()::text || clock_timestamp()::text);
  END IF;
  RETURN new;
END;
$$;

-- 2. Fix the handle_new_user trigger perfectly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, api_key)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'wl_live_' || md5(random()::text || clock_timestamp()::text)
  );

  INSERT INTO public.credit_transactions (user_id, amount, type, description, balance_after)
  VALUES (
    new.id,
    50,
    'bonus',
    'Welcome bonus — Free plan credits',
    50
  );

  RETURN new;
END;
$$;

-- 3. Rescue any forgotten users in auth.users by inserting them into profiles
INSERT INTO public.profiles (id, email, full_name, api_key, credits_balance)
SELECT 
    au.id, 
    au.email, 
    coalesce(au.raw_user_meta_data->>'full_name', ''), 
    'wl_live_' || md5(random()::text || clock_timestamp()::text),
    50
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL; -- Only insert those who are missing

-- 4. Give any forgotten users their 50 rescue credits
INSERT INTO public.credit_transactions (user_id, amount, type, description, balance_after)
SELECT 
    au.id, 
    50, 
    'bonus', 
    'System fix: Missing Welcome bonus',
    50
FROM auth.users au
LEFT JOIN public.credit_transactions ct ON ct.user_id = au.id AND ct.type = 'bonus'
WHERE ct.id IS NULL;

-- 5. Finally, make SURE mohamedalzorkeny@gmail.com is an admin
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'mohamedalzorkeny@gmail.com';
