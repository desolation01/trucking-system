-- ═══════════════════════════════════════════════════════════════════════════════
-- PART B — Create the profile for your auth user
-- ═══════════════════════════════════════════════════════════════════════════════
-- Run this AFTER Part A succeeds.
--
-- 1. First, run this to get your auth user's UUID:
--    SELECT id, email FROM auth.users;
--
-- 2. Copy the UUID, then replace 'YOUR_UUID_HERE' below and run:
-- ═══════════════════════════════════════════════════════════════════════════════

-- Run this first to find your UUID:
SELECT id, email, created_at FROM auth.users;

-- Then copy the id and paste it here:
-- INSERT INTO public.profiles (id, name, role, status) VALUES
--   ('YOUR_UUID_HERE', 'Owner / Admin', 'owner', 'active')
-- ON CONFLICT (id) DO NOTHING;