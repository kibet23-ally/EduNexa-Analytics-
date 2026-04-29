-- 1. SQL for RLS delete policy
-- Ensure ONLY super_admin can delete schools
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- Drop any existing variants of the policy to avoid naming conflicts
DROP POLICY IF EXISTS "Super admin can delete schools" ON schools;
DROP POLICY IF EXISTS "Allow super admins to delete schools" ON schools;
DROP POLICY IF EXISTS "Enable delete for super_admins" ON schools;

CREATE POLICY "Super admin can delete schools"
ON schools
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM teachers
    WHERE id = auth.uid()
    AND (LOWER(role) = 'superadmin' OR LOWER(role) = 'super_admin')
  )
);

-- Ensure super admins can also see all schools (select)
DROP POLICY IF EXISTS "Super admins can view all schools" ON schools;
CREATE POLICY "Super admins can view all schools"
ON schools
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM teachers
    WHERE id = auth.uid()
    AND (LOWER(role) = 'superadmin' OR LOWER(role) = 'super_admin')
  )
);

-- 2. HANDLE FOREIGN KEY CONSTRAINTS (CASCADE DELETIONS)
-- This ensures deleting a school automatically removes all dependent data reliably at the DB level.
-- This is much more reliable than manual cascades in the frontend.

-- Table: Students
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_school_id_fkey;
ALTER TABLE students ADD CONSTRAINT students_school_id_fkey 
FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

-- Table: Teachers
ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_school_id_fkey;
ALTER TABLE teachers ADD CONSTRAINT teachers_school_id_fkey 
FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

-- Table: Teacher Assignments
ALTER TABLE teacher_assignments DROP CONSTRAINT IF EXISTS teacher_assignments_school_id_fkey;
ALTER TABLE teacher_assignments ADD CONSTRAINT teacher_assignments_school_id_fkey 
FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

-- Table: Marks
ALTER TABLE marks DROP CONSTRAINT IF EXISTS marks_school_id_fkey;
ALTER TABLE marks ADD CONSTRAINT marks_school_id_fkey 
FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

-- Table: Exams
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_school_id_fkey;
ALTER TABLE exams ADD CONSTRAINT exams_school_id_fkey 
FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

-- Table: Subjects
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_school_id_fkey;
ALTER TABLE subjects ADD CONSTRAINT subjects_school_id_fkey 
FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

-- Table: Grades
ALTER TABLE grades DROP CONSTRAINT IF EXISTS grades_school_id_fkey;
ALTER TABLE grades ADD CONSTRAINT grades_school_id_fkey 
FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

-- Table: Attendance (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attendance') THEN
    BEGIN
      ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_school_id_fkey;
      ALTER TABLE attendance ADD CONSTRAINT attendance_school_id_fkey 
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not apply attendance cascade: %', SQLERRM;
    END;
  END IF;
END $$;
