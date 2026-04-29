-- PERFORMANCE OPTIMIZATIONS FOR EDUNEXA ANALYTICS
-- Run these in the Supabase SQL Editor

-- 1. ADD INDEXES FOR FREQUENTLY FILTERED COLUMNS
CREATE INDEX IF NOT EXISTS idx_teachers_school_id ON teachers(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_grade_id ON students(grade_id);
CREATE INDEX IF NOT EXISTS idx_marks_school_id ON marks(school_id);
CREATE INDEX IF NOT EXISTS idx_marks_student_id ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_subject_id ON marks(subject_id);
CREATE INDEX IF NOT EXISTS idx_attendance_school_id ON attendance(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_exams_school_id ON exams(school_id);
CREATE INDEX IF NOT EXISTS idx_subjects_school_id ON subjects(school_id);

-- 2. FULL TEXT SEARCH INDEX (Optional but fast for large student search)
-- CREATE INDEX IF NOT EXISTS idx_students_name_search ON students USING GIN (to_tsvector('english', name));

-- 3. OPTIMIZE RLS (If using RLS, ensure school_id is indexed)
-- Already covered by indices above.

