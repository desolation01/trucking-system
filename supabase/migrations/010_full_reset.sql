-- ═══════════════════════════════════════════════════════════════════════════════
-- 010_full_reset.sql
-- Destructive full reset for FastHaul Ops.
--
-- What this does:
--   1. Truncates every public table (profiles, employees, vehicles,
--      vehicle_types, trips, commission_rules, payroll_ledger, customers,
--      company_profile, calc_logs) — wipes ALL data including user accounts.
--   2. Re-seeds the demo owner profile, demo employees, vehicle types,
--      vehicles, commission rules, and company profile so the project still
--      boots cleanly after the reset.
--   3. Does NOT delete Supabase auth users. Those must be removed manually
--      from Authentication → Users in the Supabase Dashboard if you want a
--      truly empty auth.users table.
--
-- When to use:
--   - You want to start the project from scratch with a known seed dataset.
--   - You have a fresh dev/staging project and the demo data is in the way.
--
-- DO NOT run this on a production database that contains real customer data.
-- This migration is irreversible.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Truncate everything in dependency order ────────────────────────────────
-- TRUNCATE ... RESTART IDENTITY CASCADE resets sequences and follows FKs.
-- We disable RLS temporarily because TRUNCATE bypasses row policies anyway,
-- but triggers that block role changes can still fire on the re-seed.
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicle_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trips DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.commission_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payroll_ledger DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.company_profile DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.calc_logs DISABLE ROW LEVEL SECURITY;

TRUNCATE TABLE
  public.calc_logs,
  public.payroll_ledger,
  public.trips,
  public.commission_rules,
  public.customers,
  public.employees,
  public.vehicles,
  public.vehicle_types,
  public.company_profile,
  public.profiles
RESTART IDENTITY CASCADE;

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicle_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payroll_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.company_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.calc_logs ENABLE ROW LEVEL SECURITY;

-- ── 2. Re-seed demo data ──────────────────────────────────────────────────────
-- Migration 009 added a BEFORE INSERT trigger enforce_self_owner_only() that
-- raises when an owner row's id is not auth.uid()::text. The SQL editor runs
-- as the postgres role (no auth.uid()), so re-seeding the demo owner with a
-- fixed uid would trip that trigger. Disable it for the seed block and
-- re-enable immediately after.
ALTER TABLE public.profiles DISABLE TRIGGER enforce_self_owner_only;

-- Profiles (matches the hard-coded demo auth uid used by src/lib/store.ts)
INSERT INTO public.profiles (id, name, role, status) VALUES
  ('96517e60-3d98-4921-ba84-5bc8d0de4998', 'Owner / Admin', 'owner', 'active')
ON CONFLICT (id) DO NOTHING;

-- Employees (owner_id is NOT NULL with DEFAULT my_tenant_id() since 008 —
-- that default resolves to NULL when run as postgres, so stamp it explicitly)
INSERT INTO public.employees (id, owner_id, user_id, name, role, contact, license_no, hire_date, status, commission_override, base_salary) VALUES
  ('emp-driver-1', '96517e60-3d98-4921-ba84-5bc8d0de4998', NULL, 'Ramon Bautista', 'driver', '0917 555 0101', 'D01-2345-67890', NOW() - INTERVAL '400 days', 'active', 14, 15000),
  ('emp-driver-2', '96517e60-3d98-4921-ba84-5bc8d0de4998', NULL, 'Josef Mercado', 'driver', '0918 555 0102', 'D01-2345-67891', NOW() - INTERVAL '360 days', 'active', NULL, 12000),
  ('emp-driver-3', '96517e60-3d98-4921-ba84-5bc8d0de4998', NULL, 'Arnel Santos',  'driver', '0919 555 0103', 'D01-2345-67892', NOW() - INTERVAL '300 days', 'active', NULL, 12000),
  ('emp-driver-4', '96517e60-3d98-4921-ba84-5bc8d0de4998', NULL, 'Edwin Cruz',    'driver', '0920 555 0104', 'D01-2345-67893', NOW() - INTERVAL '250 days', 'inactive', NULL, 10000),
  ('emp-helper-1', '96517e60-3d98-4921-ba84-5bc8d0de4998', NULL, 'Mark Villanueva', 'helper', '0917 555 0201', NULL, NOW() - INTERVAL '300 days', 'active', NULL, 8000),
  ('emp-helper-2', '96517e60-3d98-4921-ba84-5bc8d0de4998', NULL, 'Paolo Dizon',     'helper', '0917 555 0202', NULL, NOW() - INTERVAL '280 days', 'active', NULL, 8000),
  ('emp-helper-3', '96517e60-3d98-4921-ba84-5bc8d0de4998', NULL, 'Jun Reyes',       'helper', '0917 555 0203', NULL, NOW() - INTERVAL '220 days', 'active', NULL, 8000)
ON CONFLICT (id) DO NOTHING;

-- Vehicle types (unique constraint is (owner_id, name) since 008)
INSERT INTO public.vehicle_types (id, owner_id, name) VALUES
  ('vt-l300', '96517e60-3d98-4921-ba84-5bc8d0de4998', 'L300'),
  ('vt-4w',  '96517e60-3d98-4921-ba84-5bc8d0de4998', '4-Wheeler'),
  ('vt-6w',  '96517e60-3d98-4921-ba84-5bc8d0de4998', '6-Wheeler Fwd'),
  ('vt-10w', '96517e60-3d98-4921-ba84-5bc8d0de4998', '10-Wheeler Wingvan')
ON CONFLICT (owner_id, name) DO NOTHING;

-- Vehicles
INSERT INTO public.vehicles (id, owner_id, plate_number, type, capacity_kg, status) VALUES
  ('veh-1', '96517e60-3d98-4921-ba84-5bc8d0de4998', 'NAJ 4821', 'L300',                1200,  'active'),
  ('veh-2', '96517e60-3d98-4921-ba84-5bc8d0de4998', 'NBD 7330', 'L300',                1200,  'active'),
  ('veh-3', '96517e60-3d98-4921-ba84-5bc8d0de4998', 'NCK 1045', '4-Wheeler',           2500,  'active'),
  ('veh-4', '96517e60-3d98-4921-ba84-5bc8d0de4998', 'NDL 8802', '6-Wheeler Fwd',       6000,  'active'),
  ('veh-5', '96517e60-3d98-4921-ba84-5bc8d0de4998', 'NEV 2210', '10-Wheeler Wingvan',  16000, 'active'),
  ('veh-6', '96517e60-3d98-4921-ba84-5bc8d0de4998', 'NFZ 5516', '10-Wheeler Wingvan',  16000, 'inactive')
ON CONFLICT (id) DO NOTHING;

-- Commission rules
INSERT INTO public.commission_rules (id, owner_id, role, basis, default_percentage, vehicle_type_overrides, employee_overrides, min_guaranteed_pay, split_mode) VALUES
  ('rule-driver', '96517e60-3d98-4921-ba84-5bc8d0de4998', 'driver', 'profit', 12,
    '{"10-Wheeler Wingvan": 15}'::jsonb,
    '{"emp-driver-1": 14}'::jsonb,
    350, 'equal'),
  ('rule-helper', '96517e60-3d98-4921-ba84-5bc8d0de4998', 'helper', 'profit', 4,
    '{}'::jsonb,
    '{}'::jsonb,
    100, 'equal')
ON CONFLICT (id) DO NOTHING;

-- Company profile
INSERT INTO public.company_profile (id, owner_id, name, address, phone, email) VALUES
  ('company-1', '96517e60-3d98-4921-ba84-5bc8d0de4998', 'FastHaul Transport Services', 'Unit 12, Marilao Industrial Park, Bulacan', '(02) 8123 4567', 'ops@fasthaul.ph')
ON CONFLICT (id) DO NOTHING;

-- Re-enable the self-owner trigger now that seeding is done.
ALTER TABLE public.profiles ENABLE TRIGGER enforce_self_owner_only;

-- ── 3. Reminders ──────────────────────────────────────────────────────────────
-- After running this migration you still need to:
--   1. Open Authentication → Users in the Supabase Dashboard.
--   2. Delete every existing auth user, OR add a brand-new auth user whose
--      uid matches '96517e60-3d98-4921-ba84-5bc8d0de4998' so the demo owner
--      profile row links to a real login.
--   3. If you want to start fresh, register a new owner via the public
--      Register form (this works because of migration 009) and the new
--      profile row will appear alongside the demo seed row.
-- ═══════════════════════════════════════════════════════════════════════════════
