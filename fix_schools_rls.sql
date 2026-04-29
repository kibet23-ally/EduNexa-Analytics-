-- 1. Fix RLS for schools table to allow status checks and management
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view schools" ON public.schools;
CREATE POLICY "Authenticated users can view schools" ON public.schools 
FOR SELECT TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Super admins can manage schools" ON public.schools;
CREATE POLICY "Super admins can manage schools" ON public.schools
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'superadmin', 'SuperAdmin'))
);

-- 2. Add 'suspended' to subscription_status check constraint if it exists
-- The current constraint is CHECK(subscription_status IN ('Active', 'Expired', 'Trial'))
-- We need to replace it or verify.
DO $$ 
BEGIN
    ALTER TABLE schools DROP CONSTRAINT IF EXISTS schools_subscription_status_check;
    ALTER TABLE schools DROP CONSTRAINT IF EXISTS schools_subscription_status_check1;
    -- We'll just allow any text or use a new one including suspended
    ALTER TABLE schools ADD CONSTRAINT schools_subscription_status_check_v2 
    CHECK (subscription_status IN ('Active', 'Expired', 'Trial', 'suspended', 'active'));
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- 3. Ensure users table trigger handles school_id correctly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, school_id)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'name', 'New Administrator'), 
    COALESCE(NEW.raw_user_meta_data->>'role', 'Admin'),
    (NEW.raw_user_meta_data->>'school_id')::bigint
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = CASE WHEN users.role IS NULL THEN EXCLUDED.role ELSE users.role END,
    school_id = CASE WHEN users.school_id IS NULL THEN EXCLUDED.school_id ELSE users.school_id END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
