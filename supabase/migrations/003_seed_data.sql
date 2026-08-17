-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed Data for FastHaul Trucking Operations
-- Run this in the Supabase Dashboard SQL Editor AFTER creating the tables
-- (via 002_fix_recreate_tables.sql)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Create Auth user first (via Supabase Auth UI) ─────────────────────────
-- Go to Authentication > Users > Add User and create:
--   owner@trucking.ph / admin123   (auto-confirm email)

-- ── 2. Profiles ──────────────────────────────────────────────────────────────
INSERT INTO public.profiles (id, name, role, status) VALUES
  ('96517e60-3d98-4921-ba84-5bc8d0de4998', 'Owner / Admin', 'owner', 'active')
ON CONFLICT (id) DO NOTHING;

-- ── 3. Employees ─────────────────────────────────────────────────────────────
INSERT INTO public.employees (id, user_id, name, role, contact, license_no, hire_date, status, commission_override, base_salary) VALUES
  ('emp-driver-1', NULL, 'Ramon Bautista', 'driver', '0917 555 0101', 'D01-2345-67890', NOW() - INTERVAL '400 days', 'active', 14, 15000),
  ('emp-driver-2', NULL, 'Josef Mercado', 'driver', '0918 555 0102', 'D01-2345-67891', NOW() - INTERVAL '360 days', 'active', NULL, 12000),
  ('emp-driver-3', NULL, 'Arnel Santos', 'driver', '0919 555 0103', 'D01-2345-67892', NOW() - INTERVAL '300 days', 'active', NULL, 12000),
  ('emp-driver-4', NULL, 'Edwin Cruz', 'driver', '0920 555 0104', 'D01-2345-67893', NOW() - INTERVAL '250 days', 'inactive', NULL, 10000),
  ('emp-helper-1', NULL, 'Mark Villanueva', 'helper', '0917 555 0201', NULL, NOW() - INTERVAL '300 days', 'active', NULL, 8000),
  ('emp-helper-2', NULL, 'Paolo Dizon', 'helper', '0917 555 0202', NULL, NOW() - INTERVAL '280 days', 'active', NULL, 8000),
  ('emp-helper-3', NULL, 'Jun Reyes', 'helper', '0917 555 0203', NULL, NOW() - INTERVAL '220 days', 'active', NULL, 8000)
ON CONFLICT (id) DO NOTHING;

-- ── 4. Vehicle Types ─────────────────────────────────────────────────────────
INSERT INTO public.vehicle_types (id, name) VALUES
  ('vt-l300', 'L300'),
  ('vt-4w', '4-Wheeler'),
  ('vt-6w', '6-Wheeler Fwd'),
  ('vt-10w', '10-Wheeler Wingvan')
ON CONFLICT (name) DO NOTHING;

-- ── 5. Vehicles ──────────────────────────────────────────────────────────────
INSERT INTO public.vehicles (id, plate_number, type, capacity_kg, status) VALUES
  ('veh-1', 'NAJ 4821', 'L300', 1200, 'active'),
  ('veh-2', 'NBD 7330', 'L300', 1200, 'active'),
  ('veh-3', 'NCK 1045', '4-Wheeler', 2500, 'active'),
  ('veh-4', 'NDL 8802', '6-Wheeler Fwd', 6000, 'active'),
  ('veh-5', 'NEV 2210', '10-Wheeler Wingvan', 16000, 'active'),
  ('veh-6', 'NFZ 5516', '10-Wheeler Wingvan', 16000, 'inactive')
ON CONFLICT (id) DO NOTHING;

-- ── 6. Commission Rules ──────────────────────────────────────────────────────
INSERT INTO public.commission_rules (id, role, basis, default_percentage, vehicle_type_overrides, employee_overrides, min_guaranteed_pay, split_mode) VALUES
  ('rule-driver', 'driver', 'profit', 12,
    '{"10-Wheeler Wingvan": 15}'::jsonb,
    '{"emp-driver-1": 14}'::jsonb,
    350, 'equal'),
  ('rule-helper', 'helper', 'profit', 4,
    '{}'::jsonb,
    '{}'::jsonb,
    100, 'equal')
ON CONFLICT (id) DO NOTHING;

-- ── 7. Company Profile ───────────────────────────────────────────────────────
INSERT INTO public.company_profile (id, name, address, phone, email) VALUES
  ('company-1', 'FastHaul Transport Services', 'Unit 12, Marilao Industrial Park, Bulacan', '(02) 8123 4567', 'ops@fasthaul.ph')
ON CONFLICT (id) DO NOTHING;

-- ── 8. Customers ─────────────────────────────────────────────────────────────
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