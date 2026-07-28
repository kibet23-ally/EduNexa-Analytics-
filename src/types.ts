export interface User {
  id: string | number;
  name: string;
  email: string;
  phone?: string;
  role: 'SuperAdmin' | 'Admin' | 'Teacher' | 'Principal' | 'super_admin' | 'school_admin' | 'teacher';
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
  upi_number?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  birth_certificate_number?: string | null;
  nationality?: string | null;
  photo_url?: string | null;
  date_of_admission?: string | null;
  stream?: string | null;
  boarding_status?: 'Day' | 'Boarding' | null;
  previous_school?: string | null;
  student_status?: 'Active' | 'Transferred' | 'Alumni' | 'Suspended' | null;
  admission_category?: string | null;
  previous_academic_performance?: string | null;
  talents?: string | null;
  blood_group?: string | null;
  allergies?: string | null;
  medical_conditions?: string | null;
  special_needs?: string | null;
  emergency_medical_notes?: string | null;
  fee_category?: string | null;
  sponsor_bursary?: string | null;
  billing_guardian_id?: number | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Guardian {
  id: number;
  student_id: number;
  school_id: number;
  full_name: string;
  relationship?: string | null;
  phone: string;
  alt_phone?: string | null;
  email?: string | null;
  address?: string | null;
  is_emergency_contact: boolean;
}

export interface LearnerDocument {
  id: number;
  student_id: number;
  school_id: number;
  doc_type: 'birth_certificate' | 'passport_photo' | 'guardian_id' | 'previous_report' | 'transfer_letter' | 'admission_letter' | 'other';
  file_url: string;
  file_name?: string | null;
  uploaded_by?: string | null;
  uploaded_at?: string | null;
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
