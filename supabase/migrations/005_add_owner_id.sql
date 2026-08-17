-- Add owner_id to profiles for multi-tenant isolation
-- Owners have owner_id = NULL (they own their data)
-- Staff/accountant have owner_id = the owner's profile ID who created them
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL;