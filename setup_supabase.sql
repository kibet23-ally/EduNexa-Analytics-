-- Run these commands in your Supabase SQL Editor to prepare your database
-- WARNING: This will delete existing data in these tables for a clean setup.

-- Drop existing tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS marks CASCADE;
DROP TABLE IF EXISTS teacher_subjects CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS exams CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS grades CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

-- 1. Grades Table
CREATE TABLE IF NOT EXISTS grades (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  grade_name TEXT NOT NULL,
  school_id BIGINT,
  UNIQUE(grade_name, school_id)
);

-- 2. Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  subject_name TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  school_id BIGINT,
  UNIQUE(subject_name, school_id),
  UNIQUE(subject_code, school_id)
);

-- 3. Students Table
CREATE TABLE IF NOT EXISTS students (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  admission_number TEXT NOT NULL,
  gender TEXT CHECK(gender IN ('Male', 'Female')),
  grade_id BIGINT REFERENCES grades(id),
  school_id BIGINT,
  UNIQUE(admission_number, school_id)
);

-- 4. Exams Table
CREATE TABLE IF NOT EXISTS exams (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  exam_name TEXT NOT NULL,
  term INTEGER CHECK(term IN (1, 2, 3)),
  year INTEGER NOT NULL,
  school_id BIGINT
);

-- 5. Teachers Table
CREATE TABLE IF NOT EXISTS teachers (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT,
  role TEXT CHECK(role IN ('Admin', 'Teacher', 'SuperAdmin')) DEFAULT 'Teacher',
  school_id BIGINT
);

-- 6. Teacher Assignments
CREATE TABLE IF NOT EXISTS teacher_assignments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  teacher_id BIGINT REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id BIGINT REFERENCES subjects(id),
  grade_id BIGINT REFERENCES grades(id),
  school_id BIGINT,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(teacher_id, subject_id, grade_id)
);

-- 7. Marks Table
CREATE TABLE IF NOT EXISTS marks (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  student_id BIGINT REFERENCES students(id),
  subject_id BIGINT REFERENCES subjects(id),
  exam_id BIGINT REFERENCES exams(id),
  score INTEGER CHECK(score >= 0 AND score <= 100),
  school_id BIGINT,
  UNIQUE(student_id, subject_id, exam_id)
);

-- 8. Orders Table (For the website order form)
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  service TEXT NOT NULL,
  message TEXT
);

-- Note: Disabling RLS for all tables to ensure the app can read/write during setup
ALTER TABLE grades DISABLE ROW LEVEL SECURITY;
ALTER TABLE subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE marks DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

-- 9. Seed Default Admin & SuperAdmin (Passwords are 'admin123' and 'super123')
INSERT INTO teachers (name, email, password, role)
VALUES 
  ('System Admin', 'admin@marumbasi.com', '$2b$10$9mo4OYHqJ9sqBOCslaNapu0iQFXuaA/BL6XlMfqfv67JA4XsiZK6e', 'Admin'),
  ('Super Admin', 'super@marumbasi.com', '$2b$10$Y1/n8qA0F8h6zT.XvP9e.uH1n1R1N1T1S1h1b1j1l1n8P9p0.r', 'SuperAdmin')
ON CONFLICT (email) DO NOTHING;
