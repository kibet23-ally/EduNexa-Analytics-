-- Migration: Enforce Subscription-based mutations at DB level
-- This ensures that even if middleware is bypassed, the database remains read-only for expired schools.

CREATE OR REPLACE FUNCTION public.is_subscription_active(s_id bigint)
RETURNS boolean AS $$
DECLARE
    s_status text;
    s_expiry timestamptz;
BEGIN
    -- Query the school status
    SELECT subscription_status, subscription_expiry INTO s_status, s_expiry
    FROM public.schools WHERE id = s_id;
    
    -- If no school found, default to active (policy should handle school existence)
    IF s_id IS NULL THEN RETURN true; END IF;

    -- Check if expired by status or date
    IF LOWER(s_status) = 'expired' OR (s_expiry IS NOT NULL AND s_expiry < now()) THEN
        RETURN false;
    END IF;

    -- Otherwise active
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Students Table Policies
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read students" ON public.students;
CREATE POLICY "Allow authenticated read students" 
ON public.students FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Disallow mutations for expired schools - Insert" ON public.students;
CREATE POLICY "Disallow mutations for expired schools - Insert"
ON public.students FOR INSERT
TO authenticated
WITH CHECK (is_subscription_active(school_id));

DROP POLICY IF EXISTS "Disallow mutations for expired schools - Update" ON public.students;
CREATE POLICY "Disallow mutations for expired schools - Update"
ON public.students FOR UPDATE
TO authenticated
USING (is_subscription_active(school_id));

DROP POLICY IF EXISTS "Disallow mutations for expired schools - Delete" ON public.students;
CREATE POLICY "Disallow mutations for expired schools - Delete"
ON public.students FOR DELETE
TO authenticated
USING (is_subscription_active(school_id));

-- 2. Teachers Table Policies
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read teachers" ON public.teachers;
CREATE POLICY "Allow authenticated read teachers" 
ON public.teachers FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Disallow mutations for expired schools - Insert Teacher" ON public.teachers;
CREATE POLICY "Disallow mutations for expired schools - Insert Teacher"
ON public.teachers FOR INSERT
TO authenticated
WITH CHECK (is_subscription_active(school_id));

DROP POLICY IF EXISTS "Disallow mutations for expired schools - Update Teacher" ON public.teachers;
CREATE POLICY "Disallow mutations for expired schools - Update Teacher"
ON public.teachers FOR UPDATE
TO authenticated
USING (is_subscription_active(school_id));

DROP POLICY IF EXISTS "Disallow mutations for expired schools - Delete Teacher" ON public.teachers;
CREATE POLICY "Disallow mutations for expired schools - Delete Teacher"
ON public.teachers FOR DELETE
TO authenticated
USING (is_subscription_active(school_id));

-- 3. Assignments Table Policies
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read assignments" ON public.assignments;
CREATE POLICY "Allow authenticated read assignments" 
ON public.assignments FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Disallow mutations for expired schools - Insert Assignment" ON public.assignments;
CREATE POLICY "Disallow mutations for expired schools - Insert Assignment"
ON public.assignments FOR INSERT
TO authenticated
WITH CHECK (is_subscription_active(school_id));

DROP POLICY IF EXISTS "Disallow mutations for expired schools - Update Assignment" ON public.assignments;
CREATE POLICY "Disallow mutations for expired schools - Update Assignment"
ON public.assignments FOR UPDATE
TO authenticated
USING (is_subscription_active(school_id));

DROP POLICY IF EXISTS "Disallow mutations for expired schools - Delete Assignment" ON public.assignments;
CREATE POLICY "Disallow mutations for expired schools - Delete Assignment"
ON public.assignments FOR DELETE
TO authenticated
USING (is_subscription_active(school_id));
