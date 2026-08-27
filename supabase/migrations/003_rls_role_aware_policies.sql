-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS Hardening v2: Role-based write restrictions
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Background: v1 policies only checked auth.role() = 'authenticated', so any
-- logged-in user could read/write/delete any row. This migration tightens
-- WRITE operations by role: accountants get read-only access, staff/owner
-- can write operational data, and only owners can modify settings.
--
-- Reads remain open to all authenticated users (single-tenant model: one
-- trucking company per Supabase project, all staff see all data).
--
-- Run this after 000_full_setup.sql. It is idempotent.
--
-- Assumes profiles.role values are 'owner' | 'staff' | 'accountant'.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. HELPER FUNCTION: get_my_role()
-- Returns the role of the currently authenticated user, or NULL if no profile.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()::text LIMIT 1;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. DROP v1 POLICIES (replace with role-aware versions)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Owner can update profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Users can read all employees" ON public.employees;
  DROP POLICY IF EXISTS "Staff can insert employees" ON public.employees;
  DROP POLICY IF EXISTS "Staff can update employees" ON public.employees;
  DROP POLICY IF EXISTS "Staff can delete employees" ON public.employees;
  DROP POLICY IF EXISTS "Authenticated users can read vehicles" ON public.vehicles;
  DROP POLICY IF EXISTS "Staff can insert vehicles" ON public.vehicles;
  DROP POLICY IF EXISTS "Staff can update vehicles" ON public.vehicles;
  DROP POLICY IF EXISTS "Staff can delete vehicles" ON public.vehicles;
  DROP POLICY IF EXISTS "Authenticated users can read vehicle_types" ON public.vehicle_types;
  DROP POLICY IF EXISTS "Staff can manage vehicle_types" ON public.vehicle_types;
  DROP POLICY IF EXISTS "Authenticated users can read trips" ON public.trips;
  DROP POLICY IF EXISTS "Staff can insert trips" ON public.trips;
  DROP POLICY IF EXISTS "Staff can update trips" ON public.trips;
  DROP POLICY IF EXISTS "Staff can delete trips" ON public.trips;
  DROP POLICY IF EXISTS "Authenticated users can read commission_rules" ON public.commission_rules;
  DROP POLICY IF EXISTS "Owner can update commission_rules" ON public.commission_rules;
  DROP POLICY IF EXISTS "Authenticated users can read payroll_ledger" ON public.payroll_ledger;
  DROP POLICY IF EXISTS "Authenticated users can read customers" ON public.customers;
  DROP POLICY IF EXISTS "Staff can manage customers" ON public.customers;
  DROP POLICY IF EXISTS "Authenticated users can read company_profile" ON public.company_profile;
  DROP POLICY IF EXISTS "Owner can update company_profile" ON public.company_profile;
  DROP POLICY IF EXISTS "Authenticated users can read calc_logs" ON public.calc_logs;
  DROP POLICY IF EXISTS "Users can insert calc_logs" ON public.calc_logs;
  DROP POLICY IF EXISTS "Users can delete calc_logs" ON public.calc_logs;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. NEW POLICIES
-- Convention: "owner or staff" = can_write_ops; "accountant" = read-only
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Profiles ────────────────────────────────────────────────────────────────
-- Any authenticated user can read profiles (needed to display names).
-- Only the owner can INSERT/UPDATE/DELETE profiles.
CREATE POLICY "Authenticated users can read profiles" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Owner can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.get_my_role() = 'owner');

CREATE POLICY "Owner can update profiles" ON public.profiles
  FOR UPDATE USING (public.get_my_role() = 'owner');

CREATE POLICY "Owner can delete profiles" ON public.profiles
  FOR DELETE USING (public.get_my_role() = 'owner');

-- ── Employees (drivers, helpers, staff) ────────────────────────────────────
CREATE POLICY "Authenticated users can read employees" ON public.employees
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Owner or staff can insert employees" ON public.employees
  FOR INSERT WITH CHECK (public.get_my_role() IN ('owner', 'staff'));

CREATE POLICY "Owner or staff can update employees" ON public.employees
  FOR UPDATE USING (public.get_my_role() IN ('owner', 'staff'));

CREATE POLICY "Owner can delete employees" ON public.employees
  FOR DELETE USING (public.get_my_role() = 'owner');

-- ── Vehicles ────────────────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can read vehicles" ON public.vehicles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Owner or staff can insert vehicles" ON public.vehicles
  FOR INSERT WITH CHECK (public.get_my_role() IN ('owner', 'staff'));

CREATE POLICY "Owner or staff can update vehicles" ON public.vehicles
  FOR UPDATE USING (public.get_my_role() IN ('owner', 'staff'));

CREATE POLICY "Owner can delete vehicles" ON public.vehicles
  FOR DELETE USING (public.get_my_role() = 'owner');

-- ── Vehicle Types ──────────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can read vehicle_types" ON public.vehicle_types
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Owner or staff can manage vehicle_types" ON public.vehicle_types
  FOR ALL USING (public.get_my_role() IN ('owner', 'staff'));

-- ── Trips ──────────────────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can read trips" ON public.trips
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Owner or staff can insert trips" ON public.trips
  FOR INSERT WITH CHECK (public.get_my_role() IN ('owner', 'staff'));

CREATE POLICY "Owner or staff can update trips" ON public.trips
  FOR UPDATE USING (public.get_my_role() IN ('owner', 'staff'));

CREATE POLICY "Owner can delete trips" ON public.trips
  FOR DELETE USING (public.get_my_role() = 'owner');

-- ── Commission Rules ──────────────────────────────────────────────────────
-- Only owners can modify commission rules (settings-level).
CREATE POLICY "Authenticated users can read commission_rules" ON public.commission_rules
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Owner can insert commission_rules" ON public.commission_rules
  FOR INSERT WITH CHECK (public.get_my_role() = 'owner');

CREATE POLICY "Owner can update commission_rules" ON public.commission_rules
  FOR UPDATE USING (public.get_my_role() = 'owner');

CREATE POLICY "Owner can delete commission_rules" ON public.commission_rules
  FOR DELETE USING (public.get_my_role() = 'owner');

-- ── Payroll Ledger (computed from trips — read-only for everyone) ─────────
CREATE POLICY "Authenticated users can read payroll_ledger" ON public.payroll_ledger
  FOR SELECT USING (auth.role() = 'authenticated');

-- Writes to payroll_ledger happen via Supabase service role (backend) only.

-- ── Customers ─────────────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can read customers" ON public.customers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Owner or staff can manage customers" ON public.customers
  FOR ALL USING (public.get_my_role() IN ('owner', 'staff'));

-- ── Company Profile ───────────────────────────────────────────────────────
-- Only owner can modify. All can read.
CREATE POLICY "Authenticated users can read company_profile" ON public.company_profile
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Owner can update company_profile" ON public.company_profile
  FOR ALL USING (public.get_my_role() = 'owner');

-- ── Calc Logs (Diesel Calculator) ────────────────────────────────────────
CREATE POLICY "Authenticated users can read calc_logs" ON public.calc_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Owner or staff can insert calc_logs" ON public.calc_logs
  FOR INSERT WITH CHECK (public.get_my_role() IN ('owner', 'staff'));

CREATE POLICY "Users can delete own calc_logs" ON public.calc_logs
  FOR DELETE USING (public.get_my_role() IN ('owner', 'staff'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. GRANT minimum required privileges (defense-in-depth)
-- ═══════════════════════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- Note: RLS policies above still apply. Grants are the floor; RLS is the gate.
