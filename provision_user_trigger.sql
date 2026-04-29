-- SQL Trigger to automatically provision user profiles in the 'users' table 
-- when a new user signs up via Supabase Auth.
-- This ensures they can always login even if the application provisioning failed.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'name', 'New Administrator'), 
    COALESCE(NEW.raw_user_meta_data->>'role', 'Admin')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = CASE WHEN users.role IS NULL THEN EXCLUDED.role ELSE users.role END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Optional: Ensure RLS allows the trigger (Security Definer handles this usually)
-- But make sure 'users' table has a policy allowing the service role/trigger to insert
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "System can manage all users" ON public.users;
CREATE POLICY "System can manage all users" ON public.users FOR ALL USING (true) WITH CHECK (true);
