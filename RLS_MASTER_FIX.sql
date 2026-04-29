-- EduNexa Standardized RLS Fix (Recursion Proof V3.1 - CONSOLIDATED)
-- Run this in your Supabase SQL Editor to fix the "infinite recursion" error and "violated row-level security policy" error.

-- 1. PREVENT LOOP: DISABLE RLS TEMPORARILY
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 2. DEFINE SECURITY HELPERS
-- These bypass RLS because of SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_auth_role() 
RETURNS text AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_auth_school_id() 
RETURNS bigint AS $$
  SELECT school_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_staff_super_admin() 
RETURNS boolean AS $$
  SELECT LOWER(COALESCE(public.get_auth_role(), '')) IN ('superadmin', 'super_admin');
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. RESET USERS TABLE POLICIES
DO $$ 
DECLARE pol record;
BEGIN
  FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_access_policy" ON public.users FOR ALL
USING (id = auth.uid() OR public.is_staff_super_admin())
WITH CHECK (id = auth.uid() OR public.is_staff_super_admin());

-- 4. APPLY CLEAN POLICIES TO ALL SCHOOL DATA TABLES
DO $$ 
DECLARE
  tab text;
  pol record;
  tables text[] := ARRAY['teachers', 'students', 'subjects', 'grades', 'teacher_assignments', 'exams', 'marks', 'attendance'];
BEGIN
  FOREACH tab IN ARRAY tables LOOP
    -- Drop EVERY policy on the table to ensure no "ghost" policies remain
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = tab AND schemaname = 'public') LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tab);
    END LOOP;
    
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tab);
    
    -- Consolidated Policy: SuperAdmin OR SchoolMatch
    EXECUTE format('CREATE POLICY "consolidated_access_policy" ON public.%I FOR ALL 
                   USING (public.is_staff_super_admin() OR school_id = public.get_auth_school_id()) 
                   WITH CHECK (public.is_staff_super_admin() OR school_id = public.get_auth_school_id())', tab);
  END LOOP;
END $$;

-- 5. FINAL SCHEMA POLISH
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Teacher';
UPDATE public.users SET role = 'super_admin' WHERE role ILIKE 'super%admin';
