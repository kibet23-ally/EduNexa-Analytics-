export interface User {
  id: number;
  name: string;
  email: string;
  role: 'SuperAdmin' | 'Admin' | 'Teacher';
  school_id?: number;
  school_name?: string;
  schools?: { name: string };
}

export interface School {
  id: number;
  name: string;
  slug: string;
  logo_url?: string;
  subscription_status: 'Active' | 'Expired' | 'Trial';
  subscription_tier?: 'Basic' | 'Standard' | 'Premium';
  subscription_end_date?: string;
  created_at: string;
}

export interface Grade {
  id: number;
  grade_name: string;
  school_id: number;
}

export interface Subject {
  id: number;
  subject_name: string;
  subject_code: string;
  school_id: number;
}

export interface Student {
  id: number;
  name: string;
  admission_number: string;
  gender: 'Male' | 'Female';
  grade_id: number;
  school_id: number;
  grade_name?: string;
}

export interface Exam {
  id: number;
  exam_name: string;
  term: 1 | 2 | 3;
  year: number;
  school_id: number;
}

export interface Mark {
  id: number;
  student_id: number;
  subject_id: number;
  exam_id: number;
  score: number;
  school_id: number;
  student_name?: string;
  admission_number?: string;
  subject_name?: string;
  subject_code?: string;
}

export interface Assignment {
  id: number;
  teacher_id: number;
  subject_id: number;
  grade_id: number;
  teacher_name: string;
  subject_name: string;
  grade_name: string;
}
