export interface User {
  id: string | number;
  name: string;
  email: string;
  role: 'SuperAdmin' | 'Admin' | 'Teacher' | 'Principal';
  school_id?: string | number;
  school_name?: string;
  schools?: { name: string };
}

export interface School {
  id: number;
  name: string;
  slug: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  motto?: string;
  subscription_status: 'Active' | 'Expired' | 'Trial' | 'suspended' | 'active';
  subscription_tier?: 'Basic' | 'Standard' | 'Premium';
  subscription_plan?: string;
  expiry_date?: string;
  subscription_activation_date?: string;
  subscription_expiry_date?: string;
  subscription_end_date?: string;
  subscription_expiry?: string;
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

export interface Plan {
  id: number;
  name: string;
  price_kes: number;
  student_limit: number;
  teacher_limit: number;
  features: string[];
  description: string;
  is_active: boolean;
}
