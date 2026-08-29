-- ═══════════════════════════════════════════════════════════════════════════════
-- 012_add_two_helper_percentage.sql
-- Adds the two_helper_percentage column to commission_rules.
--
-- This column exists in the client-side CommissionRule type and is used in
-- commission calculation logic (commission.ts) but was never added to the
-- database schema, causing 400 errors on any INSERT to commission_rules that
-- includes it (e.g. resetData seed inserts).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.commission_rules
  ADD COLUMN IF NOT EXISTS two_helper_percentage NUMERIC;

-- Backfill: set sensible defaults for existing rows
-- driver rule: 22% total when 2 helpers present
-- helper rule: 24% total when 2 helpers present
UPDATE public.commission_rules
SET two_helper_percentage = CASE
  WHEN role = 'driver' THEN 22
  WHEN role = 'helper' THEN 24
  ELSE NULL
END
WHERE two_helper_percentage IS NULL;
