-- EduNexa Comprehensive RLS Policy Fix
-- This script ensures all tables have proper Row Level Security policies

-- Enable RLS on all tables
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------
-- 1. USERS Table Policies
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
CREATE POLICY "Users can view their own profile" ON users
FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Super admins can view all users" ON users;
CREATE POLICY "Super admins can view all users" ON users
FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'superadmin'))
);

-- ---------------------------------------------------------
-- 2. TEACHERS Table Policies
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "Insert teachers" ON teachers;
CREATE POLICY "Insert teachers" ON teachers FOR INSERT WITH CHECK (
  school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "View teachers" ON teachers;
CREATE POLICY "View teachers" ON teachers FOR SELECT USING (
  school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Update teachers" ON teachers;
CREATE POLICY "Update teachers" ON teachers FOR UPDATE USING (
  school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Delete teachers" ON teachers;
CREATE POLICY "Delete teachers" ON teachers FOR DELETE USING (
  school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Super admin full access teachers" ON teachers;
CREATE POLICY "Super admin full access teachers" ON teachers FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'superadmin'))
);

-- ---------------------------------------------------------
-- 3. STUDENTS Table Policies
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "Insert students" ON students;
CREATE POLICY "Insert students" ON students FOR INSERT WITH CHECK (
  school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "View students" ON students;
CREATE POLICY "View students" ON students FOR SELECT USING (
  school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Update students" ON students;
CREATE POLICY "Update students" ON students FOR UPDATE USING (
  school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Delete students" ON students;
CREATE POLICY "Delete students" ON students FOR DELETE USING (
  school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Super admin full access students" ON students;
CREATE POLICY "Super admin full access students" ON students FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'superadmin'))
);

-- ---------------------------------------------------------
-- 4. SUBJECTS Table Policies
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "Insert subjects" ON subjects;
CREATE POLICY "Insert subjects" ON subjects FOR INSERT WITH CHECK (
  school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "View subjects" ON subjects;
CREATE POLICY "View subjects" ON subjects FOR SELECT USING (
  school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Update subjects" ON subjects;
CREATE POLICY "Update subjects" ON subjects FOR UPDATE USING (
  school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Delete subjects" ON subjects;
CREATE POLICY "Delete subjects" ON subjects FOR DELETE USING (
  school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Super admin full access subjects" ON subjects;
CREATE POLICY "Super admin full access subjects" ON subjects FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'superadmin'))
);

-- ---------------------------------------------------------
-- 5. TEACHER ASSIGNMENTS Table Policies
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "Insert assignments" ON teacher_assignments;
CREATE POLICY "Insert assignments" ON teacher_assignments FOR INSERT WITH CHECK (
  school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "View assignments" ON teacher_assignments;
CREATE POLICY "View assignments" ON teacher_assignments FOR SELECT USING (
  school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Update assignments" ON teacher_assignments;
CREATE POLICY "Update assignments" ON teacher_assignments FOR UPDATE USING (
  school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Delete assignments" ON teacher_assignments;
CREATE POLICY "Delete assignments" ON teacher_assignments FOR DELETE USING (
  school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Super admin full access assignments" ON teacher_assignments;
CREATE POLICY "Super admin full access assignments" ON teacher_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'superadmin'))
);
