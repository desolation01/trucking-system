-- ============================================
-- Trucking System Database Schema for Supabase
-- ============================================
-- This schema is designed for a trucking operations management system
-- that handles trips, employees, vehicles, commissions, and payroll.
-- ============================================

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUM TYPES
-- ============================================

-- User roles for authentication and authorization
CREATE TYPE user_role AS ENUM ('owner', 'staff', 'accountant');

-- Employee roles distinguishing job functions
CREATE TYPE employee_role AS ENUM ('driver', 'helper', 'staff');

-- Trip status tracking lifecycle
CREATE TYPE trip_status AS ENUM ('scheduled', 'ongoing', 'completed', 'cancelled');

-- Commission calculation basis
CREATE TYPE commission_basis AS ENUM ('gross', 'profit');

-- Helper commission split mode
CREATE TYPE split_mode AS ENUM ('equal', 'custom');

-- Employee/User status
CREATE TYPE record_status AS ENUM ('active', 'inactive');

-- ============================================
-- TABLES
-- ============================================

-- --------------------------------------------
-- Users Table
-- Stores authentication users with role-based access
-- --------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,  -- Store hashed passwords, not plain text
    role user_role NOT NULL,
    status record_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for email lookups during login
CREATE INDEX idx_users_email ON users(email);
-- Index for role-based queries
CREATE INDEX idx_users_role ON users(role);
-- Index for status filtering
CREATE INDEX idx_users_status ON users(status);

-- --------------------------------------------
-- Employees Table
-- Stores employee records (drivers, helpers, staff)
-- Links to users table if employee has system access
-- --------------------------------------------
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    role employee_role NOT NULL,
    contact VARCHAR(50) NOT NULL,
    license_no VARCHAR(100),  -- Only for drivers
    hire_date DATE NOT NULL,
    status record_status NOT NULL DEFAULT 'active',
    commission_override DECIMAL(5,2),  -- Optional override percentage
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user_id linkage
CREATE INDEX idx_employees_user_id ON employees(user_id);
-- Index for role filtering
CREATE INDEX idx_employees_role ON employees(role);
-- Index for status filtering
CREATE INDEX idx_employees_status ON employees(status);
-- Index for active drivers/helpers (common query pattern)
CREATE INDEX idx_employees_active_by_role ON employees(role, status) WHERE status = 'active';

-- --------------------------------------------
-- Vehicle Types Table
-- Reference table for standardized vehicle types
-- --------------------------------------------
CREATE TABLE vehicle_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for name lookups
CREATE INDEX idx_vehicle_types_name ON vehicle_types(name);

-- --------------------------------------------
-- Vehicles Table
-- Fleet management - trucks and other vehicles
-- --------------------------------------------
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate_number VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(100) NOT NULL,  -- Can reference vehicle_types.name or be free-form
    capacity_kg INTEGER NOT NULL CHECK (capacity_kg > 0),
    status record_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for plate number lookups
CREATE INDEX idx_vehicles_plate ON vehicles(plate_number);
-- Index for type filtering
CREATE INDEX idx_vehicles_type ON vehicles(type);
-- Index for status filtering
CREATE INDEX idx_vehicles_status ON vehicles(status);
-- Composite index for active vehicles by type (common query)
CREATE INDEX idx_vehicles_active_by_type ON vehicles(type, status) WHERE status = 'active';

-- --------------------------------------------
-- Customers Table
-- Customer/client information
-- --------------------------------------------
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255),
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for phone lookups (primary search method)
CREATE INDEX idx_customers_phone ON customers(phone_number);
-- Index for name searches
CREATE INDEX idx_customers_name ON customers(name);

-- --------------------------------------------
-- Commission Rules Table
-- Configuration for commission calculations
-- --------------------------------------------
CREATE TABLE commission_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role employee_role NOT NULL,
    basis commission_basis NOT NULL,
    default_percentage DECIMAL(5,2) NOT NULL CHECK (default_percentage >= 0 AND default_percentage <= 100),
    vehicle_type_overrides JSONB NOT NULL DEFAULT '{}',  -- { "vehicle_type": percentage }
    employee_overrides JSONB NOT NULL DEFAULT '{}',      -- { "employee_id": percentage }
    min_guaranteed_pay DECIMAL(10,2) NOT NULL DEFAULT 0,
    split_mode split_mode NOT NULL DEFAULT 'equal',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure one rule per role (can be adjusted if multiple rules needed)
    CONSTRAINT unique_role_rule UNIQUE (role)
);

-- Index for role lookups
CREATE INDEX idx_commission_rules_role ON commission_rules(role);

-- --------------------------------------------
-- Trips Table
-- Core table storing all trip/shipment records
-- --------------------------------------------
CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES employees(id),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    transportify_id VARCHAR(100) UNIQUE NOT NULL,  -- External system ID
    
    -- Cargo details
    cargo_weight INTEGER,  -- in kg
    cargo_dimensions VARCHAR(100),  -- e.g., "4x4x4m"
    
    -- Customer information (denormalized for historical accuracy)
    customer_phone VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    
    -- Route information
    pickup_address TEXT NOT NULL,
    dropoff_address TEXT NOT NULL,
    
    -- Item details
    items TEXT,  -- Description of items
    description TEXT,
    images JSONB NOT NULL DEFAULT '[]',  -- Array of image URLs
    
    -- Financial details
    gross DECIMAL(12,2) NOT NULL CHECK (gross >= 0),
    total_expense DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total_expense >= 0),
    profit DECIMAL(12,2) NOT NULL GENERATED ALWAYS AS (gross - total_expense) STORED,
    
    -- Commission details (calculated and stored for historical accuracy)
    driver_commission DECIMAL(12,2) NOT NULL DEFAULT 0,
    helper_commission DECIMAL(12,2) NOT NULL DEFAULT 0,
    helper_split split_mode NOT NULL DEFAULT 'equal',
    helper_split_custom JSONB NOT NULL DEFAULT '{}',  -- { "helper_id": amount }
    
    -- Trip metadata
    date_time TIMESTAMPTZ NOT NULL,
    status trip_status NOT NULL DEFAULT 'scheduled',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_trips_driver ON trips(driver_id);
CREATE INDEX idx_trips_vehicle ON trips(vehicle_id);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_date ON trips(date_time);
CREATE INDEX idx_trips_transportify ON trips(transportify_id);
CREATE INDEX idx_trips_customer_phone ON trips(customer_phone);
-- Composite index for date range queries by status
CREATE INDEX idx_trips_status_date ON trips(status, date_time);
-- Composite index for driver's trips by date
CREATE INDEX idx_trips_driver_date ON trips(driver_id, date_time DESC);

-- --------------------------------------------
-- Expense Items Table
-- Normalized expense breakdown for trips
-- --------------------------------------------
CREATE TABLE expense_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for trip lookups
CREATE INDEX idx_expense_items_trip ON expense_items(trip_id);
-- Index for category analysis
CREATE INDEX idx_expense_items_category ON expense_items(category);

-- --------------------------------------------
-- Helper Assignments Table
-- Junction table for trips with multiple helpers
-- --------------------------------------------
CREATE TABLE trip_helpers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    helper_id UUID NOT NULL REFERENCES employees(id),
    commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure no duplicate helpers per trip
    CONSTRAINT unique_trip_helper UNIQUE (trip_id, helper_id)
);

-- Index for trip lookups
CREATE INDEX idx_trip_helpers_trip ON trip_helpers(trip_id);
-- Index for helper lookups
CREATE INDEX idx_trip_helpers_helper ON trip_helpers(helper_id);

-- --------------------------------------------
-- Payroll Ledger Table
-- Tracks commission payments to employees
-- --------------------------------------------
CREATE TABLE payroll_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    trip_id UUID NOT NULL REFERENCES trips(id),
    amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
    basis_used commission_basis NOT NULL,
    basis_amount DECIMAL(12,2) NOT NULL,  -- The gross or profit amount used
    percentage DECIMAL(5,2) NOT NULL,     -- The percentage applied
    payment_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_payroll_employee ON payroll_ledger(employee_id);
CREATE INDEX idx_payroll_trip ON payroll_ledger(trip_id);
CREATE INDEX idx_payroll_date ON payroll_ledger(payment_date);
-- Composite index for employee's payroll by date
CREATE INDEX idx_payroll_employee_date ON payroll_ledger(employee_id, payment_date DESC);

-- --------------------------------------------
-- Company Profile Table
-- Single-row table for company information
-- --------------------------------------------
CREATE TABLE company_profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    logo_url TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure only one row exists
    CONSTRAINT single_row_check CHECK (id = (SELECT MIN(id) FROM company_profile))
);

-- ============================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at
    BEFORE UPDATE ON vehicles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commission_rules_updated_at
    BEFORE UPDATE ON commission_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at
    BEFORE UPDATE ON trips
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_profile_updated_at
    BEFORE UPDATE ON company_profile
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get active employees by role
CREATE OR REPLACE FUNCTION get_active_employees(p_role employee_role)
RETURNS TABLE (
    emp_id UUID,
    emp_name VARCHAR,
    emp_contact VARCHAR,
    emp_license_no VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT e.id, e.name, e.contact, e.license_no
    FROM employees e
    WHERE e.role = p_role AND e.status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Function to calculate trip commission for a driver
CREATE OR REPLACE FUNCTION calculate_driver_commission(
    p_trip_id UUID,
    p_driver_id UUID
) RETURNS DECIMAL(12,2) AS $$
DECLARE
    v_profit DECIMAL(12,2);
    v_gross DECIMAL(12,2);
    v_vehicle_type VARCHAR;
    v_default_pct DECIMAL(5,2);
    v_override_pct DECIMAL(5,2);
    v_basis commission_basis;
    v_min_pay DECIMAL(12,2);
    v_commission DECIMAL(12,2);
BEGIN
    -- Get trip financials and vehicle type
    SELECT t.profit, t.gross, v.type
    INTO v_profit, v_gross, v_vehicle_type
    FROM trips t
    JOIN vehicles v ON t.vehicle_id = v.id
    WHERE t.id = p_trip_id;
    
    -- Get commission rule for driver
    SELECT cr.basis, cr.default_percentage, cr.min_guaranteed_pay
    INTO v_basis, v_default_pct, v_min_pay
    FROM commission_rules cr
    WHERE cr.role = 'driver';
    
    -- Check for employee override
    SELECT (employee_overrides->>p_driver_id::text)::numeric
    INTO v_override_pct
    FROM commission_rules
    WHERE role = 'driver';
    
    -- Use override if exists, otherwise check vehicle type override, else default
    IF v_override_pct IS NOT NULL THEN
        v_commission := (CASE WHEN v_basis = 'gross' THEN v_gross ELSE v_profit END) * v_override_pct / 100;
    ELSE
        v_commission := (CASE WHEN v_basis = 'gross' THEN v_gross ELSE v_profit END) * v_default_pct / 100;
    END IF;
    
    -- Apply minimum guaranteed pay
    IF v_commission < v_min_pay THEN
        v_commission := v_min_pay;
    END IF;
    
    RETURN v_commission;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Active vehicles with type details
CREATE VIEW active_vehicles_view AS
SELECT 
    v.id,
    v.plate_number,
    v.type,
    v.capacity_kg,
    vt.description as type_description
FROM vehicles v
LEFT JOIN vehicle_types vt ON v.type = vt.name
WHERE v.status = 'active';

-- View: Trip summary with employee names
CREATE VIEW trip_summary_view AS
SELECT 
    t.id,
    t.transportify_id,
    t.date_time,
    t.status,
    d.name as driver_name,
    v.plate_number,
    v.type as vehicle_type,
    t.customer_name,
    t.gross,
    t.total_expense,
    t.profit,
    t.driver_commission
FROM trips t
JOIN employees d ON t.driver_id = d.id
JOIN vehicles v ON t.vehicle_id = v.id;

-- View: Employee earnings summary
CREATE VIEW employee_earnings_view AS
SELECT 
    e.id as employee_id,
    e.name,
    e.role,
    COUNT(pl.id) as payment_count,
    COALESCE(SUM(pl.amount), 0) as total_earnings,
    MAX(pl.payment_date) as last_payment_date
FROM employees e
LEFT JOIN payroll_ledger pl ON e.id = pl.employee_id
GROUP BY e.id, e.name, e.role;

-- ============================================
-- INITIAL DATA SEEDING (Optional)
-- ============================================

-- Insert default vehicle types
INSERT INTO vehicle_types (name, description) VALUES
    ('L300', 'Mitsubishi L300 - Light utility vehicle'),
    ('4-Wheeler', '4-Wheeler truck - Medium capacity'),
    ('6-Wheeler Fwd', '6-Wheeler Forward - Heavy duty'),
    ('10-Wheeler Wingvan', '10-Wheeler Wingvan - Maximum capacity')
ON CONFLICT (name) DO NOTHING;

-- Insert default commission rules
INSERT INTO commission_rules (role, basis, default_percentage, vehicle_type_overrides, employee_overrides, min_guaranteed_pay, split_mode) VALUES
    ('driver', 'profit', 12.00, '{"10-Wheeler Wingvan": 15.00}'::jsonb, '{}'::jsonb, 350.00, 'equal'),
    ('helper', 'profit', 4.00, '{}'::jsonb, '{}'::jsonb, 100.00, 'equal')
ON CONFLICT (role) DO UPDATE SET
    basis = EXCLUDED.basis,
    default_percentage = EXCLUDED.default_percentage,
    vehicle_type_overrides = EXCLUDED.vehicle_type_overrides,
    employee_overrides = EXCLUDED.employee_overrides,
    min_guaranteed_pay = EXCLUDED.min_guaranteed_pay,
    split_mode = EXCLUDED.split_mode,
    updated_at = NOW();

-- Insert placeholder company profile
INSERT INTO company_profile (id, name, address, phone, email) VALUES
    (uuid_generate_v4(), 'FastHaul Transport Services', 'Unit 12, Marilao Industrial Park, Bulacan', '(02) 8123 4567', 'ops@fasthaul.ph')
ON CONFLICT DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
-- Note: Enable RLS based on your security requirements
-- Example policies (uncomment and customize as needed):

-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view their own profile" ON users
--     FOR SELECT USING (auth.uid() = id);

-- ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Staff can view all trips" ON trips
--     FOR SELECT USING (
--         EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'staff', 'accountant'))
--     );

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE users IS 'System users with authentication and role-based access';
COMMENT ON TABLE employees IS 'Employee records including drivers, helpers, and administrative staff';
COMMENT ON TABLE vehicles IS 'Fleet vehicles with capacity and status tracking';
COMMENT ON TABLE trips IS 'Core trip/shipment records with financial and operational details';
COMMENT ON TABLE expense_items IS 'Normalized expense breakdown per trip';
COMMENT ON TABLE commission_rules IS 'Commission calculation rules by employee role';
COMMENT ON TABLE payroll_ledger IS 'Payment ledger tracking commission disbursements';
COMMENT ON TABLE customers IS 'Customer/client contact information';
COMMENT ON TABLE company_profile IS 'Single-row company profile and settings';
