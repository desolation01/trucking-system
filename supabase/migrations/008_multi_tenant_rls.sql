-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS v4: Multi-tenant isolation (one database, many independent owner workspaces)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- PROBLEM (user-reported 2026-08-28): all accounts shared one dataset — deleting
-- a trip from a newly created owner account also removed it from the demo owner.
-- Root cause: v2/v3 policies were tenant-blind (any authenticated user could see
-- every row of every table).
--
-- MODEL:
--   Tenant id = the OWNER's auth user id.
--     - Owner profile:  owner_id IS NULL  → tenant = own id (my_tenant_id())
--     - Staff/acct:     owner_id = <owner's profile id> → tenant = that owner
--   Every data table gets owner_id, DEFAULTed server-side to the inserting
--   user's tenant — no client changes needed for tagging.
--   Every policy filters rows: row.owner_id = my_tenant_id().
--
-- BACKFILL: all existing rows → the OLDEST owner profile (the demo owner,
-- owner@trucking.ph), per user decision: demo owner keeps current data.
--
-- Idempotent: safe to run multiple times.
-- Requires: 007_rls_v3_profile_lock.sql already applied.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Tenant helper ─────────────────────────────────────────────────────────
-- Returns the tenant (owner profile id) the caller belongs to.
--   Owner (owner_id NULL) → own id.  Staff → their owner's id.
--   Unprovisioned user → own auth uid (matches nothing → sees an empty workspace).
CREATE OR REPLACE FUNCTION public.my_tenant_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT owner_id FROM public.profiles WHERE id = (select auth.uid())::text),
    (select auth.uid())::text
  );
$$;

REVOKE ALL ON FUNCTION public.my_tenant_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.my_tenant_id() TO authenticated;

-- ── 2. Add tenant columns (nullable first → backfill → then NOT NULL) ────────
-- auth.uid() is NULL during DDL execution, so DEFAULT my_tenant_id() stamps NULL
-- on existing rows, which then violates NOT NULL. Solution: add nullable, backfill
-- to the oldest owner, then tighten the constraint.
ALTER TABLE public.employees        ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE public.vehicles         ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE public.trips            ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE public.customers        ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE public.commission_rules ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE public.payroll_ledger   ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE public.calc_logs        ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE public.company_profile  ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE public.vehicle_types    ADD COLUMN IF NOT EXISTS owner_id TEXT;

-- ── 3. Backfill: existing rows belong to the oldest owner (demo owner) ───────
DO $$
DECLARE demo_owner TEXT;
BEGIN
  SELECT id INTO demo_owner FROM public.profiles
  WHERE role = 'owner' ORDER BY created_at ASC, id ASC LIMIT 1;

  IF demo_owner IS NOT NULL THEN
    UPDATE public.employees        SET owner_id = demo_owner WHERE owner_id IS NULL;
    UPDATE public.vehicles         SET owner_id = demo_owner WHERE owner_id IS NULL;
    UPDATE public.trips            SET owner_id = demo_owner WHERE owner_id IS NULL;
    UPDATE public.customers        SET owner_id = demo_owner WHERE owner_id IS NULL;
    UPDATE public.commission_rules SET owner_id = demo_owner WHERE owner_id IS NULL;
    UPDATE public.payroll_ledger   SET owner_id = demo_owner WHERE owner_id IS NULL;
    UPDATE public.calc_logs        SET owner_id = demo_owner WHERE owner_id IS NULL;
    UPDATE public.company_profile  SET owner_id = demo_owner WHERE owner_id IS NULL;
    UPDATE public.vehicle_types    SET owner_id = demo_owner WHERE owner_id IS NULL;
  END IF;
END $$;

-- ── 2b. Tighten to NOT NULL + set server-side default for future inserts ──────
ALTER TABLE public.employees        ALTER COLUMN owner_id SET NOT NULL,
                                    ALTER COLUMN owner_id SET DEFAULT public.my_tenant_id();
ALTER TABLE public.vehicles         ALTER COLUMN owner_id SET NOT NULL,
                                    ALTER COLUMN owner_id SET DEFAULT public.my_tenant_id();
ALTER TABLE public.trips            ALTER COLUMN owner_id SET NOT NULL,
                                    ALTER COLUMN owner_id SET DEFAULT public.my_tenant_id();
ALTER TABLE public.customers        ALTER COLUMN owner_id SET NOT NULL,
                                    ALTER COLUMN owner_id SET DEFAULT public.my_tenant_id();
ALTER TABLE public.commission_rules ALTER COLUMN owner_id SET NOT NULL,
                                    ALTER COLUMN owner_id SET DEFAULT public.my_tenant_id();
ALTER TABLE public.payroll_ledger   ALTER COLUMN owner_id SET NOT NULL,
                                    ALTER COLUMN owner_id SET DEFAULT public.my_tenant_id();
ALTER TABLE public.calc_logs        ALTER COLUMN owner_id SET NOT NULL,
                                    ALTER COLUMN owner_id SET DEFAULT public.my_tenant_id();
ALTER TABLE public.company_profile  ALTER COLUMN owner_id SET NOT NULL,
                                    ALTER COLUMN owner_id SET DEFAULT public.my_tenant_id();
ALTER TABLE public.vehicle_types    ALTER COLUMN owner_id SET NOT NULL,
                                    ALTER COLUMN owner_id SET DEFAULT public.my_tenant_id();

-- vehicle_types: UNIQUE(name) must become UNIQUE(owner_id, name) so two owners
-- can both have e.g. "L300" without conflicting.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.vehicle_types'::regclass AND contype = 'u'
      AND conname <> 'vehicle_types_owner_name_unique'
  LOOP
    EXECUTE format('ALTER TABLE public.vehicle_types DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.vehicle_types
  ADD CONSTRAINT vehicle_types_owner_name_unique UNIQUE (owner_id, name);

-- ── 4. Tenant-scoped policies (replace v2/v3 on data tables) ─────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can read employees" ON public.employees;
  DROP POLICY IF EXISTS "Owner or staff can insert employees" ON public.employees;
  DROP POLICY IF EXISTS "Owner or staff can update employees" ON public.employees;
  DROP POLICY IF EXISTS "Owner can delete employees" ON public.employees;
  DROP POLICY IF EXISTS "Authenticated users can read vehicles" ON public.vehicles;
  DROP POLICY IF EXISTS "Owner or staff can insert vehicles" ON public.vehicles;
  DROP POLICY IF EXISTS "Owner or staff can update vehicles" ON public.vehicles;
  DROP POLICY IF EXISTS "Owner can delete vehicles" ON public.vehicles;
  DROP POLICY IF EXISTS "Authenticated users can read vehicle_types" ON public.vehicle_types;
  DROP POLICY IF EXISTS "Owner or staff can manage vehicle_types" ON public.vehicle_types;
  DROP POLICY IF EXISTS "Authenticated users can read trips" ON public.trips;
  DROP POLICY IF EXISTS "Owner or staff can insert trips" ON public.trips;
  DROP POLICY IF EXISTS "Owner or staff can update trips" ON public.trips;
  DROP POLICY IF EXISTS "Owner can delete trips" ON public.trips;
  DROP POLICY IF EXISTS "Authenticated users can read commission_rules" ON public.commission_rules;
  DROP POLICY IF EXISTS "Owner can insert commission_rules" ON public.commission_rules;
  DROP POLICY IF EXISTS "Owner can update commission_rules" ON public.commission_rules;
  DROP POLICY IF EXISTS "Owner can delete commission_rules" ON public.commission_rules;
  DROP POLICY IF EXISTS "Authenticated users can read payroll_ledger" ON public.payroll_ledger;
  DROP POLICY IF EXISTS "Authenticated users can read customers" ON public.customers;
  DROP POLICY IF EXISTS "Owner or staff can manage customers" ON public.customers;
  DROP POLICY IF EXISTS "Authenticated users can read company_profile" ON public.company_profile;
  DROP POLICY IF EXISTS "Owner can update company_profile" ON public.company_profile;
  DROP POLICY IF EXISTS "Authenticated users can read calc_logs" ON public.calc_logs;
  DROP POLICY IF EXISTS "Owner or staff can insert calc_logs" ON public.calc_logs;
  DROP POLICY IF EXISTS "Users can delete own calc_logs" ON public.calc_logs;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- The role in ('owner','staff') guards below reuse get_my_role() (007):
-- accountants stay read-only. Rows are tenant-scoped in every clause.

-- ── Employees ──
CREATE POLICY "Tenant can read employees" ON public.employees
  FOR SELECT USING (owner_id = public.my_tenant_id());
CREATE POLICY "Tenant owner/staff can insert employees" ON public.employees
  FOR INSERT WITH CHECK (owner_id = public.my_tenant_id() AND public.get_my_role() IN ('owner','staff'));
CREATE POLICY "Tenant owner/staff can update employees" ON public.employees
  FOR UPDATE USING (owner_id = public.my_tenant_id() AND public.get_my_role() IN ('owner','staff'));
CREATE POLICY "Tenant owner can delete employees" ON public.employees
  FOR DELETE USING (owner_id = public.my_tenant_id() AND public.get_my_role() = 'owner');

-- ── Vehicles ──
CREATE POLICY "Tenant can read vehicles" ON public.vehicles
  FOR SELECT USING (owner_id = public.my_tenant_id());
CREATE POLICY "Tenant owner/staff can insert vehicles" ON public.vehicles
  FOR INSERT WITH CHECK (owner_id = public.my_tenant_id() AND public.get_my_role() IN ('owner','staff'));
CREATE POLICY "Tenant owner/staff can update vehicles" ON public.vehicles
  FOR UPDATE USING (owner_id = public.my_tenant_id() AND public.get_my_role() IN ('owner','staff'));
CREATE POLICY "Tenant owner can delete vehicles" ON public.vehicles
  FOR DELETE USING (owner_id = public.my_tenant_id() AND public.get_my_role() = 'owner');

-- ── Vehicle types ──
CREATE POLICY "Tenant can read vehicle_types" ON public.vehicle_types
  FOR SELECT USING (owner_id = public.my_tenant_id());
CREATE POLICY "Tenant owner/staff can manage vehicle_types" ON public.vehicle_types
  FOR ALL USING (owner_id = public.my_tenant_id() AND public.get_my_role() IN ('owner','staff'))
  WITH CHECK (owner_id = public.my_tenant_id() AND public.get_my_role() IN ('owner','staff'));

-- ── Trips ──
CREATE POLICY "Tenant can read trips" ON public.trips
  FOR SELECT USING (owner_id = public.my_tenant_id());
CREATE POLICY "Tenant owner/staff can insert trips" ON public.trips
  FOR INSERT WITH CHECK (owner_id = public.my_tenant_id() AND public.get_my_role() IN ('owner','staff'));
CREATE POLICY "Tenant owner/staff can update trips" ON public.trips
  FOR UPDATE USING (owner_id = public.my_tenant_id() AND public.get_my_role() IN ('owner','staff'));
CREATE POLICY "Tenant owner can delete trips" ON public.trips
  FOR DELETE USING (owner_id = public.my_tenant_id() AND public.get_my_role() = 'owner');

-- ── Commission rules ──
CREATE POLICY "Tenant can read commission_rules" ON public.commission_rules
  FOR SELECT USING (owner_id = public.my_tenant_id());
CREATE POLICY "Tenant owner manages commission_rules" ON public.commission_rules
  FOR ALL USING (owner_id = public.my_tenant_id() AND public.get_my_role() = 'owner')
  WITH CHECK (owner_id = public.my_tenant_id() AND public.get_my_role() = 'owner');

-- ── Payroll ledger (read-only; computed client-side) ──
CREATE POLICY "Tenant can read payroll_ledger" ON public.payroll_ledger
  FOR SELECT USING (owner_id = public.my_tenant_id());

-- ── Customers ──
CREATE POLICY "Tenant can read customers" ON public.customers
  FOR SELECT USING (owner_id = public.my_tenant_id());
CREATE POLICY "Tenant owner/staff can manage customers" ON public.customers
  FOR ALL USING (owner_id = public.my_tenant_id() AND public.get_my_role() IN ('owner','staff'))
  WITH CHECK (owner_id = public.my_tenant_id() AND public.get_my_role() IN ('owner','staff'));

-- ── Company profile ──
CREATE POLICY "Tenant can read company_profile" ON public.company_profile
  FOR SELECT USING (owner_id = public.my_tenant_id());
CREATE POLICY "Tenant owner manages company_profile" ON public.company_profile
  FOR ALL USING (owner_id = public.my_tenant_id() AND public.get_my_role() = 'owner')
  WITH CHECK (owner_id = public.my_tenant_id() AND public.get_my_role() = 'owner');

-- ── Calc logs ──
CREATE POLICY "Tenant can read calc_logs" ON public.calc_logs
  FOR SELECT USING (owner_id = public.my_tenant_id());
CREATE POLICY "Tenant owner/staff can insert calc_logs" ON public.calc_logs
  FOR INSERT WITH CHECK (owner_id = public.my_tenant_id() AND public.get_my_role() IN ('owner','staff'));
CREATE POLICY "Tenant owner/staff can delete calc_logs" ON public.calc_logs
  FOR DELETE USING (owner_id = public.my_tenant_id() AND public.get_my_role() IN ('owner','staff'));

-- ── 5. Profiles: tenant-scoped read + owner staff-provisioning (v3 blocked all) ──
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Users update own profile, role immutable" ON public.profiles;
  DROP POLICY IF EXISTS "Tenant owner manages staff profiles" ON public.profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- See your own row + your staff's rows + your owner's row. Nothing else.
CREATE POLICY "Tenant can read profiles" ON public.profiles
  FOR SELECT USING (
    id = (select auth.uid())::text
    OR owner_id = public.my_tenant_id()
    OR id = public.my_tenant_id()
  );

-- Self-service: edit own name/status, role locked (v3 behavior preserved).
CREATE POLICY "Users update own profile, role immutable" ON public.profiles
  FOR UPDATE
  USING (id = (select auth.uid())::text)
  WITH CHECK (id = (select auth.uid())::text AND role = public.get_my_role());

-- Owner provisions/edits/deletes ONLY their own staff, roles limited to staff/accountant.
CREATE POLICY "Tenant owner manages staff profiles" ON public.profiles
  FOR UPDATE
  USING (owner_id = (select auth.uid())::text AND public.get_my_role() = 'owner')
  WITH CHECK (owner_id = (select auth.uid())::text AND role IN ('staff','accountant'));

CREATE POLICY "Tenant owner provisions staff profiles" ON public.profiles
  FOR INSERT WITH CHECK (
    public.get_my_role() = 'owner'
    AND id <> (select auth.uid())::text
    AND owner_id = (select auth.uid())::text
    AND role IN ('staff','accountant')
  );

CREATE POLICY "Tenant owner deletes staff profiles" ON public.profiles
  FOR DELETE USING (owner_id = (select auth.uid())::text AND public.get_my_role() = 'owner');

-- ── 6. Update the role-immutable trigger: tenant owner MAY re-role their staff ──
-- (C2 backstop preserved: staff still can't touch their own role — their uid
--  never equals their owner_id.)
CREATE OR REPLACE FUNCTION public.enforce_role_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth.uid()::text IS DISTINCT FROM OLD.owner_id THEN
      RAISE EXCEPTION 'profiles.role is immutable (RLS v4). Only the tenant owner can change staff roles.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFY (SQL Editor):
--   -- every data table now carries owner_id:
--   SELECT table_name, column_name FROM information_schema.columns
--   WHERE column_name = 'owner_id' AND table_schema = 'public';
--
--   -- as the NEW owner (empty tenant): trips/customers must return []
--   -- as the DEMO owner: trips/customers must return the backfilled rows
-- ═══════════════════════════════════════════════════════════════════════════════
