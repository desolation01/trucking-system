-- Migration: 002_create_app_tables
-- Creates all tables for the trucking ops management system
-- Uses TEXT PKs because the frontend generates string IDs (not UUIDs)

-- ── Profiles (extends auth.users — stores auth.users UUID as TEXT) ─────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'staff', 'accountant')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ── Employees ──────────────────────────────────────────────────────────────
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

-- ── Vehicles ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicles (
  id TEXT PRIMARY KEY,
  plate_number TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  capacity_kg NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- ── Vehicle Types (configurable list) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicle_types (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE
);

ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;

-- ── Trips ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trips (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  helper_ids TEXT[] NOT NULL DEFAULT '{}',
  vehicle_id TEXT NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  transportify_id TEXT NOT NULL,
  cargo_weight NUMERIC,
  cargo_dimensions TEXT,
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

-- ── Commission Rules ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('driver', 'helper')),
  basis TEXT NOT NULL DEFAULT 'profit' CHECK (basis IN ('gross', 'profit')),
  default_percentage NUMERIC NOT NULL DEFAULT 0,
  vehicle_type_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  employee_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  min_guaranteed_pay NUMERIC NOT NULL DEFAULT 0,
  split_mode TEXT NOT NULL DEFAULT 'equal' CHECK (split_mode IN ('equal', 'custom')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

-- ── Payroll Ledger ─────────────────────────────────────────────────────────
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

-- ── Customers ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  name TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (phone_number);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- ── Company Profile ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_profile (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL
);

ALTER TABLE public.company_profile ENABLE ROW LEVEL SECURITY;

-- ── Row Level Security Policies ────────────────────────────────────────────

-- Allow all authenticated users to read/write
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