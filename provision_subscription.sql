-- Migration to add subscription fields to schools if not already present
DO $$ 
BEGIN
    -- Add subscription_expiry if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'subscription_expiry') THEN
        ALTER TABLE public.schools ADD COLUMN subscription_expiry TIMESTAMPTZ;
    END IF;

    -- Ensure subscription_status exists and has correct type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'subscription_status') THEN
        ALTER TABLE public.schools ADD COLUMN subscription_status TEXT DEFAULT 'active';
    END IF;

    -- Update existing status values to match lowercase if needed, but the current code uses both.
    -- We will standardize to 'active' or 'expired' for the logic, 
    -- but keep support for 'Active' (Title case) if that was the previous standard.
END $$;

-- Update RLS if needed (Allow authenticated users to read school status)
-- This was already partly done in fix_schools_rls.sql, but we ensure it here too.
DROP POLICY IF EXISTS "Anyone can view school status" ON public.schools;
CREATE POLICY "Anyone can view school status" ON public.schools
FOR SELECT TO authenticated USING (true);
