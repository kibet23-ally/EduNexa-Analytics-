-- EduNexa Analytics: Multi-Tenancy & Subscription Script
CREATE TABLE IF NOT EXISTS schools (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  subscription_status TEXT CHECK(subscription_status IN ('Active', 'Expired', 'Trial')) DEFAULT 'Trial',
  subscription_tier TEXT CHECK(subscription_tier IN ('Basic', 'Standard', 'Premium')) DEFAULT 'Basic',
  subscription_end_date TIMESTAMP WITH TIME ZONE,
  subscription_plan TEXT,
  subscription_status TEXT DEFAULT 'Trial',
  expiry_date TIMESTAMP WITH TIME ZONE,
  subscription_activation_date TIMESTAMP WITH TIME ZONE,
  subscription_expiry_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Insert a default school for existing data
INSERT INTO schools (name, slug) VALUES ('Default School', 'default-school') ON CONFLICT DO NOTHING;

-- 3. Add school_id to all relevant tables
DO $$ 
BEGIN
  -- Schools reference
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teachers' AND column_name='school_id') THEN
    ALTER TABLE teachers ADD COLUMN school_id BIGINT REFERENCES schools(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='grades' AND column_name='school_id') THEN
    ALTER TABLE grades ADD COLUMN school_id BIGINT REFERENCES schools(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='school_id') THEN
    ALTER TABLE subjects ADD COLUMN school_id BIGINT REFERENCES schools(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='school_id') THEN
    ALTER TABLE students ADD COLUMN school_id BIGINT REFERENCES schools(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exams' AND column_name='school_id') THEN
    ALTER TABLE exams ADD COLUMN school_id BIGINT REFERENCES schools(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='marks' AND column_name='school_id') THEN
    ALTER TABLE marks ADD COLUMN school_id BIGINT REFERENCES schools(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='teacher_assignments' AND column_name='school_id') THEN
    ALTER TABLE teacher_assignments ADD COLUMN school_id BIGINT REFERENCES schools(id);
  END IF;
END $$;

-- 4. Assign existing data to the default school (ID 1 if it's the first one)
UPDATE teachers SET school_id = (SELECT id FROM schools WHERE slug = 'default-school') WHERE school_id IS NULL;
UPDATE grades SET school_id = (SELECT id FROM schools WHERE slug = 'default-school') WHERE school_id IS NULL;
UPDATE subjects SET school_id = (SELECT id FROM schools WHERE slug = 'default-school') WHERE school_id IS NULL;
UPDATE students SET school_id = (SELECT id FROM schools WHERE slug = 'default-school') WHERE school_id IS NULL;
UPDATE exams SET school_id = (SELECT id FROM schools WHERE slug = 'default-school') WHERE school_id IS NULL;
UPDATE marks SET school_id = (SELECT id FROM schools WHERE slug = 'default-school') WHERE school_id IS NULL;
UPDATE teacher_assignments SET school_id = (SELECT id FROM schools WHERE slug = 'default-school') WHERE school_id IS NULL;

-- 5. Make school_id NOT NULL for future constraints (Uncomment after running updates if desired)
-- ALTER TABLE teachers ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE grades ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE subjects ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE students ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE exams ALTER COLUMN school_id SET NOT NULL;
-- ALTER TABLE marks ALTER COLUMN school_id SET NOT NULL;

-- 6. Update Unique Constraints to be per-school
ALTER TABLE grades DROP CONSTRAINT IF EXISTS grades_grade_name_key;
ALTER TABLE grades ADD CONSTRAINT grades_grade_name_school_id_key UNIQUE (grade_name, school_id);

ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_subject_name_key;
ALTER TABLE subjects ADD CONSTRAINT subjects_subject_name_school_id_key UNIQUE (subject_name, school_id);

ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_subject_code_key;
ALTER TABLE subjects ADD CONSTRAINT subjects_subject_code_school_id_key UNIQUE (subject_code, school_id);

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_admission_number_key;
ALTER TABLE students ADD CONSTRAINT students_admission_number_school_id_key UNIQUE (admission_number, school_id);

-- Marks constraint update (student_id + subject_id + exam_id is already unique, school_id is redundant but good for indexing)
-- ALTER TABLE marks DROP CONSTRAINT IF EXISTS marks_student_id_subject_id_exam_id_key;
-- ALTER TABLE marks ADD CONSTRAINT marks_student_unique UNIQUE (student_id, subject_id, exam_id);

-- 7. Update User Roles for SuperAdmin
ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_role_check;
ALTER TABLE teachers ADD CONSTRAINT teachers_role_check CHECK (role IN ('Teacher', 'Admin', 'SuperAdmin', 'Principal'));

-- 8. Add indexing for performance
CREATE INDEX IF NOT EXISTS idx_teachers_school ON teachers(school_id);
CREATE INDEX IF NOT EXISTS idx_grades_school ON grades(school_id);
CREATE INDEX IF NOT EXISTS idx_subjects_school ON subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_exams_school ON exams(school_id);
CREATE INDEX IF NOT EXISTS idx_marks_school ON marks(school_id);

-- 9. Subscription Plans Table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL UNIQUE,
  price_kes INTEGER NOT NULL DEFAULT 0,
  student_limit INTEGER NOT NULL DEFAULT 100,
  teacher_limit INTEGER NOT NULL DEFAULT 10,
  features TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Seed initial plans if they don't exist
INSERT INTO subscription_plans (name, price_kes, student_limit, teacher_limit, features, description)
VALUES 
('Basic', 3000, 100, 10, ARRAY['Attendance tracking', 'Basic reports', 'Email Support'], 'Ideal for small schools starting their digital journey.'),
('Standard', 6000, 300, 30, ARRAY['All Basic features', 'Exam management', 'Parent portal'], 'Perfect for growing growing institutions.'),
('Premium', 10000, 100000, 100000, ARRAY['Analytics', 'Custom reports', 'Priority support'], 'Built for large chains and enterprise institutions.')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE schools DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans DISABLE ROW LEVEL SECURITY;
