-- ═══════════════════════════════════════════════════════════════════════════════
-- Open public self-signup for FastHaul Ops.
--
-- Without this migration, the public "Create account" form on the login screen
-- creates a Supabase auth user but the matching `profiles` row is denied by
-- RLS (007 + 008 ship no INSERT policy for self-service). The new owner can
-- never log in because fetchProfile() finds nothing and treats the user as
-- unprovisioned.
--
-- This migration adds the narrowest possible INSERT policy that lets a brand
-- new auth user create their OWN owner profile exactly once. It does not
-- weaken tenant isolation on any other table.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Self-signup INSERT policy ────────────────────────────────────────────
--   Allowed shape:
--     id = auth.uid()::text   (row keys to the caller)
--     role = 'owner'          (cannot self-promote to staff/accountant)
--     owner_id IS NULL        (top-level tenant, no parent)
--     status = 'active'
DO $$ BEGIN
  DROP POLICY IF EXISTS "Self-signup provisions owner profile" ON public.profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Self-signup provisions owner profile" ON public.profiles
  FOR INSERT WITH CHECK (
    id = (select auth.uid())::text
    AND role = 'owner'
    AND owner_id IS NULL
    AND status = 'active'
  );

-- ── 2. Role-immutable trigger must be a no-op on INSERT ─────────────────────
--   Migration 008 defined enforce_role_immutable() as a row-level BEFORE
--   trigger. It only inspects NEW vs OLD on UPDATE, but we still want it to
--   skip INSERTs cleanly. Recreate it as an UPDATE-only trigger so the
--   v4 behaviour (only the tenant owner can re-role their staff) is preserved.
DO $$ BEGIN
  DROP TRIGGER IF EXISTS enforce_role_immutable ON public.profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE TRIGGER enforce_role_immutable
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_role_immutable();

-- ── 3. Backstop: nobody can sneak in another tenant's owner row ─────────────
--   The INSERT policy above already enforces this, but if a future policy
--   change loosens things, this trigger guarantees an owner row only ever
--   exists for the user who created it.
CREATE OR REPLACE FUNCTION public.enforce_self_owner_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'owner' AND NEW.id IS DISTINCT FROM (select auth.uid())::text THEN
    RAISE EXCEPTION 'profiles.owner rows must key to the creating auth user.';
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS enforce_self_owner_only ON public.profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE TRIGGER enforce_self_owner_only
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_self_owner_only();

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFY (SQL Editor):
--   -- as a freshly-signed-up auth user, profiles INSERT should succeed:
--   INSERT INTO public.profiles (id, name, role, status)
--     VALUES (auth.uid()::text, 'Test Owner', 'owner', 'active');
--
--   -- as the same user, attempting role='staff' should be denied:
--   INSERT INTO public.profiles (id, name, role, status)
--     VALUES (auth.uid()::text, 'Bad', 'staff', 'active'); -- expect RLS error
-- ═══════════════════════════════════════════════════════════════════════════════
