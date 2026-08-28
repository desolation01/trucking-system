-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS v3: Profile role lock (C2 fix — SECURITY-AUDIT.md 2026-08-28)
-- v3.1 — fixed 42883: profiles.id is TEXT, auth.uid() returns UUID.
--        All comparisons cast: auth.uid()::text. Wrapped in (select ...) for
--        per-statement initplan evaluation (Supabase RLS perf guidance).
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- WHY: v2 policies let "the owner" update profiles — but get_my_role() reads the
-- role FROM the profiles table itself, and any staff-writable path combined with
-- client-trusted roles could convert into a self-service role change. Once a user
-- flips their own profiles.role to 'owner', every owner-only policy passes.
--
-- WHAT CHANGES:
--   1. profiles.role becomes IMMUTABLE through the API. Users may update their
--      own profile (name/status) but the role column must not change.
--   2. No INSERT/DELETE policy on profiles for anyone — account provisioning
--      happens in the Supabase Dashboard (service role bypasses RLS).
--      ⚠️ NOTE: with this migration, the owner's Users page can no longer create,
--      delete, or edit OTHER users' profiles through the anon key. Provisioning
--      and role changes move to Dashboard → Authentication → Users (+ a matching
--      profiles row via SQL editor). This is the intended trade-off for a
--      single-tenant internal tool.
--   3. get_my_role() is hardened: execute revoked from anon.
--
-- Idempotent: safe to run multiple times.
--
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Drop the v2 profiles policies (and any partial v3 run) ────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Owner can insert profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Owner can update profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Owner can delete profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Users update own profile, role immutable" ON public.profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 2. Recreate: read all (names needed across app), self-update with role lock ──
CREATE POLICY "Authenticated users can read profiles" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- A user may update ONLY their own row, and the new row must keep the SAME role
-- it had before. get_my_role() is STABLE and reads the pre-UPDATE row, so
-- WITH CHECK (role = get_my_role()) fails any attempt to alter role.
CREATE POLICY "Users update own profile, role immutable" ON public.profiles
  FOR UPDATE
  USING (id = (select auth.uid())::text)
  WITH CHECK (id = (select auth.uid())::text AND role = public.get_my_role());

-- Deliberately NO INSERT / DELETE / ALL policy on profiles through the API.

-- ── 3. Database-level backstop: role can never change via ANY statement ───────
CREATE OR REPLACE FUNCTION public.enforce_role_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'profiles.role is immutable (RLS v3). Provision roles via the Supabase Dashboard.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_role_immutable ON public.profiles;
CREATE TRIGGER trg_profiles_role_immutable
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_role_immutable();

-- ── 4. Harden get_my_role() ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = (select auth.uid())::text LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- ── 5. Housekeeping: remove placeholder junk rows from the live DB ──────────
-- (Audit finding L4: 'YOUR_AUT...' placeholder never cleaned)
DELETE FROM public.profiles WHERE id = 'YOUR_AUTH_USER_ID';

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFY (run in SQL Editor after applying):
--   SELECT policy_name, cmd FROM pg_policies WHERE tablename = 'profiles';
--   -- expect exactly 2 policies: read + self-update-with-role-lock
--
--   -- as any authenticated user, this must FAIL:
--   UPDATE public.profiles SET role = 'owner' WHERE id = auth.uid()::text;
-- ═══════════════════════════════════════════════════════════════════════════════
