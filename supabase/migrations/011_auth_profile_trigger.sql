-- ═══════════════════════════════════════════════════════════════════════════════
-- 011_auth_profile_trigger.sql
-- Guarantees every new auth user gets a `profiles` row the moment the auth
-- user is created, regardless of email-confirmation timing.
--
-- Root cause fixed here: with "Confirm email" enabled, signUp() returns NO
-- session, so the client-side profiles insert in Login.tsx ran as anon, was
-- denied by RLS, and was never retried after confirmation. Login then found
-- no profile row and silently dropped the user back to the login screen.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Relax the 009 backstop for server-side contexts ──────────────────────
--   auth.uid() is NULL inside auth-flow triggers and for the postgres role,
--   and those callers are trusted (migration seeds, auth trigger). Browser
--   callers still cannot create an owner row for anyone but themselves.
CREATE OR REPLACE FUNCTION public.enforce_self_owner_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'owner'
     AND (select auth.uid()) IS NOT NULL
     AND NEW.id IS DISTINCT FROM (select auth.uid())::text THEN
    RAISE EXCEPTION 'profiles.owner rows must key to the creating auth user.';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 2. Auto-create the profile row when an auth user is created ─────────────
--   SECURITY DEFINER so the insert bypasses RLS (the request is unauthenticated
--   at this point). The 009 self-signup policy stays in force for browser
--   inserts; this trigger only fills the gap email confirmation creates.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, status)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'name', ''), 'Owner'),
    'owner',
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFY (SQL Editor):
--   -- trigger exists:
--   SELECT tgname FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass;
--
--   -- accounts in auth.users missing a profiles row (should be empty once
--   -- each user logs in once — the app self-heals those on login):
--   SELECT u.id, u.email FROM auth.users u
--   LEFT JOIN public.profiles p ON p.id = u.id::text
--   WHERE p.id IS NULL;
-- ═══════════════════════════════════════════════════════════════════════════════
