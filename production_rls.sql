-- EduNexa Analytics: Production RLS Security Policies
-- This script enables RLS on all tables and defines secure access patterns.

-- 1. Enable RLS on all tables
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 2. Orders Policy (Publicly accessible for contact form)
DROP POLICY IF EXISTS "Enable public insert for orders" ON orders;
CREATE POLICY "Enable public insert for orders" ON orders
FOR INSERT TO anon
WITH CHECK (true);

-- 3. Schools Policy (Restricted)
DROP POLICY IF EXISTS "Schools are viewable by authenticated users" ON schools;
CREATE POLICY "Schools are viewable by authenticated users" ON schools
FOR SELECT TO authenticated
USING (true);

-- 4. Multi-Tenant Policies (Using a custom parameter or role)
-- NOTE: Since this app uses a custom Express backend, the backend should ideally 
-- use the SERVICE_ROLE key to bypass RLS. These policies are for 
-- additional security or if Supabase Auth is enabled later.

-- Example Policy for Teachers: Only see teachers in your school
-- (This requires Supabase Auth and a 'school_id' claim in the JWT)
-- CREATE POLICY "Users can only see data from their own school" ON teachers
-- FOR ALL TO authenticated
-- USING (school_id = (auth.jwt() ->> 'school_id')::bigint);

-- For now, we will add a policy that allows the service_role (default)
-- and restricts anon/authenticated to specific logic if needed.

-- Default: Deny everything for anon on sensitive tables
-- (Already handled by enabling RLS without policies)

-- 5. Helper to check for Admin role in JWT (Optional/Future)
-- CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
-- BEGIN
--   RETURN (auth.jwt() ->> 'role') = 'Admin';
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Summary of protections
-- - ALL tables have RLS enabled.
-- - 'orders' table allows public INSERTS (contact form).
-- - NO other table allows public access via 'anon' key.
-- - Backend should use SERVICE_ROLE for full management.
-- - Frontend 'anon' access to sensitive data is completely BLOCKED by RLS.
