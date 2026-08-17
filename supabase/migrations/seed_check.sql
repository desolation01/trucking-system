-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Check what's in the database
-- ═══════════════════════════════════════════════════════════════════════════════

-- How many rows in each table?
SELECT 'employees' AS tbl, count(*) FROM public.employees
UNION ALL SELECT 'vehicles', count(*) FROM public.vehicles
UNION ALL SELECT 'profiles', count(*) FROM public.profiles
UNION ALL SELECT 'trips', count(*) FROM public.trips
UNION ALL SELECT 'vehicle_types', count(*) FROM public.vehicle_types
UNION ALL SELECT 'customers', count(*) FROM public.customers;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: IF counts are all 0, run this seed data
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 2a. Get your actual auth user ID ─────────────────────────────────────────
-- Run this separately to see your auth user's UUID:
--   SELECT id, email FROM auth.users;

-- Then paste the UUID below (replace 'YOUR_UUID_HERE') and uncomment:
-- INSERT INTO public.profiles (id, name, role, status) VALUES
--   ('YOUR_UUID_HERE', 'Owner / Admin', 'owner', 'active')
-- ON CONFLICT (id) DO NOTHING;

-- ── 2b. Seed employees ───────────────────────────────────────────────────────
INSERT INTO public.employees (id, user_id, name, role, contact, license_no, hire_date, status, commission_override, base_salary) VALUES
  ('emp-driver-1', NULL, 'Ramon Bautista', 'driver', '0917 555 0101', 'D01-2345-67890', NOW() - INTERVAL '400 days', 'active', 14, 15000),
  ('emp-driver-2', NULL, 'Josef Mercado', 'driver', '0918 555 0102', 'D01-2345-67891', NOW() - INTERVAL '360 days', 'active', NULL, 12000),
  ('emp-driver-3', NULL, 'Arnel Santos', 'driver', '0919 555 0103', 'D01-2345-67892', NOW() - INTERVAL '300 days', 'active', NULL, 12000),
  ('emp-helper-1', NULL, 'Mark Villanueva', 'helper', '0917 555 0201', NULL, NOW() - INTERVAL '300 days', 'active', NULL, 8000),
  ('emp-helper-2', NULL, 'Paolo Dizon', 'helper', '0917 555 0202', NULL, NOW() - INTERVAL '280 days', 'active', NULL, 8000),
  ('emp-helper-3', NULL, 'Jun Reyes', 'helper', '0917 555 0203', NULL, NOW() - INTERVAL '220 days', 'active', NULL, 8000)
ON CONFLICT (id) DO NOTHING;

-- ── 2c. Seed vehicle types ───────────────────────────────────────────────────
INSERT INTO public.vehicle_types (name) VALUES
  ('L300'), ('4-Wheeler'), ('6-Wheeler Fwd'), ('10-Wheeler Wingvan')
ON CONFLICT (name) DO NOTHING;

-- ── 2d. Seed vehicles ────────────────────────────────────────────────────────
INSERT INTO public.vehicles (id, plate_number, type, capacity_kg, status) VALUES
  ('veh-1', 'NAJ 4821', 'L300', 1200, 'active'),
  ('veh-2', 'NBD 7330', 'L300', 1200, 'active'),
  ('veh-3', 'NCK 1045', '4-Wheeler', 2500, 'active'),
  ('veh-4', 'NDL 8802', '6-Wheeler Fwd', 6000, 'active'),
  ('veh-5', 'NEV 2210', '10-Wheeler Wingvan', 16000, 'active'),
  ('veh-6', 'NFZ 5516', '10-Wheeler Wingvan', 16000, 'inactive')
ON CONFLICT (id) DO NOTHING;

-- ── 2e. Seed customers ───────────────────────────────────────────────────────
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

-- ── 2f. Seed commission rules ────────────────────────────────────────────────
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

-- ── 2g. Seed company profile ─────────────────────────────────────────────────
INSERT INTO public.company_profile (name, address, phone, email) VALUES
  ('FastHaul Transport Services', 'Unit 12, Marilao Industrial Park, Bulacan', '(02) 8123 4567', 'ops@fasthaul.ph')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 3: Verify the seed worked
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT 'employees' AS tbl, count(*) FROM public.employees
UNION ALL SELECT 'vehicles', count(*) FROM public.vehicles
UNION ALL SELECT 'vehicle_types', count(*) FROM public.vehicle_types
UNION ALL SELECT 'customers', count(*) FROM public.customers
UNION ALL SELECT 'commission_rules', count(*) FROM public.commission_rules;