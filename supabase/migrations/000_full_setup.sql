-- ═══════════════════════════════════════════════════════════════════════════════
-- FastHaul Ops — Full Database Setup
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- HOW TO USE:
--   1. Go to your Supabase Dashboard → SQL Editor
--   2. Create your auth user first:
--        Authentication → Users → Add User
--        Email: owner@trucking.ph   Password: admin123   (auto-confirm)
--   3. Copy the new user's UUID from the Users table
--   4. Paste it at the top of the "Profiles" section below (replace YOUR_AUTH_USER_ID)
--   5. Run this entire script
--
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. CREATE TABLES (idempotent — safe to run multiple times)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Profiles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'staff', 'accountant')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ── Employees ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employees (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('driver', 'helper', 'staff')),
  contact TEXT NOT NULL,
  license_no TEXT,
  hire_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  commission_override NUMERIC,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- ── Vehicles ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicles (
  id TEXT PRIMARY KEY,
  plate_number TEXT NOT NULL,
  type TEXT NOT NULL,
  capacity_kg NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  driver_id TEXT REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- ── Vehicle Types ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicle_types (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE
);
ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;

-- ── Trips ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trips (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  helper_ids TEXT[] NOT NULL DEFAULT '{}',
  vehicle_id TEXT NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  transportify_id TEXT NOT NULL,
  cargo_weight NUMERIC,
  cargo_dimensions TEXT,
  km_traveled NUMERIC,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  pickup_address TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  items TEXT,
  description TEXT,
  images TEXT[] NOT NULL DEFAULT '{}',
  gross NUMERIC NOT NULL DEFAULT 0,
  expense_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_expense NUMERIC NOT NULL DEFAULT 0,
  profit NUMERIC NOT NULL DEFAULT 0,
  driver_commission NUMERIC NOT NULL DEFAULT 0,
  helper_commission NUMERIC NOT NULL DEFAULT 0,
  helper_split TEXT NOT NULL DEFAULT 'equal' CHECK (helper_split IN ('equal', 'custom')),
  helper_split_custom JSONB NOT NULL DEFAULT '{}'::jsonb,
  date_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
  created_by TEXT NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trips_date_time ON public.trips (date_time DESC);
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON public.trips (driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips (status);
CREATE INDEX IF NOT EXISTS idx_trips_transportify_id ON public.trips (transportify_id);
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- ── Commission Rules ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('driver', 'helper')),
  basis TEXT NOT NULL DEFAULT 'profit' CHECK (basis IN ('gross', 'profit')),
  default_percentage NUMERIC NOT NULL DEFAULT 0,
  two_helper_percentage NUMERIC,
  vehicle_type_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  employee_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  min_guaranteed_pay NUMERIC NOT NULL DEFAULT 0,
  split_mode TEXT NOT NULL DEFAULT 'equal' CHECK (split_mode IN ('equal', 'custom')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

-- ── Payroll Ledger ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payroll_ledger (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  trip_id TEXT NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  basis_used TEXT NOT NULL CHECK (basis_used IN ('gross', 'profit')),
  basis_amount NUMERIC NOT NULL DEFAULT 0,
  percentage NUMERIC NOT NULL DEFAULT 0,
  date TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payroll_ledger_employee ON public.payroll_ledger (employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_ledger_date ON public.payroll_ledger (date);
ALTER TABLE public.payroll_ledger ENABLE ROW LEVEL SECURITY;

-- ── Customers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  name TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (phone_number);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- ── Company Profile ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_profile (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL
);
ALTER TABLE public.company_profile ENABLE ROW LEVEL SECURITY;

-- ── Calc Logs (for Diesel Calculator) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.calc_logs (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  label TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  driver_salary NUMERIC NOT NULL DEFAULT 0,
  helpers JSONB NOT NULL DEFAULT '[]'::jsonb,
  diesel_cost NUMERIC NOT NULL DEFAULT 0,
  trips JSONB NOT NULL DEFAULT '[]'::jsonb,
  results JSONB NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE public.calc_logs ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. RLS POLICIES (allow authenticated users full access)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop existing policies first to avoid conflicts on re-run
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
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

CREATE POLICY "Authenticated users can read profiles" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can read all employees" ON public.employees
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Staff can insert employees" ON public.employees
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Staff can update employees" ON public.employees
  FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Staff can delete employees" ON public.employees
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read vehicles" ON public.vehicles
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Staff can insert vehicles" ON public.vehicles
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Staff can update vehicles" ON public.vehicles
  FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Staff can delete vehicles" ON public.vehicles
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read vehicle_types" ON public.vehicle_types
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Staff can manage vehicle_types" ON public.vehicle_types
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read trips" ON public.trips
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Staff can insert trips" ON public.trips
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Staff can update trips" ON public.trips
  FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Staff can delete trips" ON public.trips
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read commission_rules" ON public.commission_rules
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Owner can update commission_rules" ON public.commission_rules
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read payroll_ledger" ON public.payroll_ledger
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read customers" ON public.customers
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Staff can manage customers" ON public.customers
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read company_profile" ON public.company_profile
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Owner can update company_profile" ON public.company_profile
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read calc_logs" ON public.calc_logs
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert calc_logs" ON public.calc_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can delete calc_logs" ON public.calc_logs
  FOR DELETE USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. SEED DATA
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 3a. Owner Profile ──────────────────────────────────────────────────────
-- ⚠️  IMPORTANT: Replace 'YOUR_AUTH_USER_ID' with the actual UUID of the
--     auth user you created in Supabase Authentication → Users
--     (e.g. '96517e60-3d98-4921-ba84-5bc8d0de4998')
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.profiles (id, name, role, status) VALUES
  ('96517e60-3d98-4921-ba84-5bc8d0de4998', 'Owner / Admin', 'owner', 'active')
ON CONFLICT (id) DO NOTHING;

-- ── 3b. Employees ──────────────────────────────────────────────────────────
INSERT INTO public.employees (id, user_id, name, role, contact, license_no, hire_date, status, commission_override, base_salary) VALUES
  ('emp-driver-1', NULL, 'Ramon Bautista', 'driver', '0917 555 0101', 'D01-2345-67890', NOW() - INTERVAL '400 days', 'active', 14, 15000),
  ('emp-driver-2', NULL, 'Josef Mercado', 'driver', '0918 555 0102', 'D01-2345-67891', NOW() - INTERVAL '360 days', 'active', NULL, 12000),
  ('emp-driver-3', NULL, 'Arnel Santos', 'driver', '0919 555 0103', 'D01-2345-67892', NOW() - INTERVAL '300 days', 'active', NULL, 12000),
  ('emp-driver-4', NULL, 'Edwin Cruz', 'driver', '0920 555 0104', 'D01-2345-67893', NOW() - INTERVAL '250 days', 'inactive', NULL, 10000),
  ('emp-helper-1', NULL, 'Mark Villanueva', 'helper', '0917 555 0201', NULL, NOW() - INTERVAL '300 days', 'active', NULL, 8000),
  ('emp-helper-2', NULL, 'Paolo Dizon', 'helper', '0917 555 0202', NULL, NOW() - INTERVAL '280 days', 'active', NULL, 8000),
  ('emp-helper-3', NULL, 'Jun Reyes', 'helper', '0917 555 0203', NULL, NOW() - INTERVAL '220 days', 'active', NULL, 8000)
ON CONFLICT (id) DO NOTHING;

-- ── 3c. Vehicle Types ──────────────────────────────────────────────────────
INSERT INTO public.vehicle_types (id, name) VALUES
  ('vt-l300', 'L300'),
  ('vt-4w', '4-Wheeler'),
  ('vt-6w', '6-Wheeler Fwd'),
  ('vt-10w', '10-Wheeler Wingvan')
ON CONFLICT (name) DO NOTHING;

-- ── 3d. Vehicles ───────────────────────────────────────────────────────────
INSERT INTO public.vehicles (id, plate_number, type, capacity_kg, status, driver_id) VALUES
  ('veh-1', 'NAJ 4821', 'L300', 1200, 'active', 'emp-driver-1'),
  ('veh-2', 'NBD 7330', 'L300', 1200, 'active', 'emp-driver-2'),
  ('veh-3', 'NCK 1045', '4-Wheeler', 2500, 'active', 'emp-driver-3'),
  ('veh-4', 'NDL 8802', '6-Wheeler Fwd', 6000, 'active', NULL),
  ('veh-5', 'NEV 2210', '10-Wheeler Wingvan', 16000, 'active', NULL),
  ('veh-6', 'NFZ 5516', '10-Wheeler Wingvan', 16000, 'inactive', NULL)
ON CONFLICT (id) DO NOTHING;

-- ── 3e. Commission Rules ───────────────────────────────────────────────────
INSERT INTO public.commission_rules (id, role, basis, default_percentage, two_helper_percentage, vehicle_type_overrides, employee_overrides, min_guaranteed_pay, split_mode) VALUES
  ('rule-driver', 'driver', 'gross', 25, 22,
    '{"10-Wheeler Wingvan": 22}'::jsonb,
    '{}'::jsonb,
    0, 'equal'),
  ('rule-helper', 'helper', 'gross', 20, 24,
    '{}'::jsonb,
    '{}'::jsonb,
    0, 'equal')
ON CONFLICT (id) DO NOTHING;

-- ── 3f. Customers ──────────────────────────────────────────────────────────
INSERT INTO public.customers (id, phone_number, name) VALUES
  ('cust-0', '0917 888 2201', 'Lopez Trading'),
  ('cust-1', '0917 888 2202', 'Santos Distribution'),
  ('cust-2', '0918 888 2203', 'MC Logistics'),
  ('cust-3', '0919 888 2204', 'JR Enterprises'),
  ('cust-4', '0920 888 2205', 'Natividad Retail'),
  ('cust-5', '0916 888 2206', 'Victory Supply'),
  ('cust-6', '0915 888 2207', 'Prime Movers Inc.'),
  ('cust-7', '0914 888 2208', 'Katipunan Trading'),
  ('cust-8', '0913 888 2209', 'Isla Foods'),
  ('cust-9', '0912 888 2210', 'Metro Builders')
ON CONFLICT (id) DO NOTHING;

-- ── 3g. Company Profile ────────────────────────────────────────────────────
INSERT INTO public.company_profile (id, name, address, phone, email) VALUES
  ('company-1', 'FastHaul Transport Services', 'Unit 12, Marilao Industrial Park, Bulacan', '(02) 8123 4567', 'ops@fasthaul.ph')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. VERIFICATION QUERIES (run these to confirm everything is set up)
-- ═══════════════════════════════════════════════════════════════════════════════

-- SELECT 'profiles' AS tbl, count(*) FROM public.profiles
-- UNION ALL SELECT 'employees', count(*) FROM public.employees
-- UNION ALL SELECT 'vehicles', count(*) FROM public.vehicles
-- UNION ALL SELECT 'vehicle_types', count(*) FROM public.vehicle_types
-- UNION ALL SELECT 'customers', count(*) FROM public.customers
-- UNION ALL SELECT 'commission_rules', count(*) FROM public.commission_rules;