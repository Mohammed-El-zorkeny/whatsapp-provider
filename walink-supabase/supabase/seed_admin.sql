-- ============================================================
-- Seed: Set admin role for existing user
-- 1. Create the user normally through the walink-web Sign Up page
-- 2. Run this query in Supabase SQL Editor to elevate them to admin
-- ============================================================

update public.profiles
set role = 'admin'
where email = 'mohamedalzorkeny@gmail.com';
