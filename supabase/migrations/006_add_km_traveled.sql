-- Add missing columns to trips table
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS km_traveled NUMERIC;

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'trips' AND table_schema = 'public'
ORDER BY ordinal_position;