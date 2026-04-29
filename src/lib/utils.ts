import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getCBCGrade = (score: number) => {
  if (score >= 90) return { level: "EE1", points: 8 };
  if (score >= 75) return { level: "EE2", points: 7 };
  if (score >= 58) return { level: "ME1", points: 6 };
  if (score >= 41) return { level: "ME2", points: 5 };
  if (score >= 31) return { level: "AE1", points: 4 };
  if (score >= 21) return { level: "AE2", points: 3 };
  if (score >= 11) return { level: "BE1", points: 2 };
  return { level: "BE2", points: 1 };
};

export const getRemarks = (score: number) => {
  if (score >= 75) return {
    teacher: "Excellent performance. Keep up the high standards.",
    principal: "Outstanding achievement. A role model to others."
  };
  if (score >= 41) return {
    teacher: "Good work. You have shown consistent effort.",
    principal: "Commendable performance. Aim higher next time."
  };
  if (score >= 21) return {
    teacher: "Fair performance. More effort needed in weak subjects.",
    principal: "Needs improvement. Focus on consistent revision."
  };
  return {
    teacher: "Below expectations. Urgent intervention required.",
    principal: "Immediate improvement required. See the principal."
  };
};

export const getOverallGrade = (score: number) => {
  if (score >= 90) return "EE1";
  if (score >= 75) return "EE2";
  if (score >= 58) return "ME1";
  if (score >= 41) return "ME2";
  if (score >= 31) return "AE1";
  if (score >= 21) return "AE2";
  if (score >= 11) return "BE1";
  return "BE2";
};

import { supabase } from "./supabase";

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  // If it's a relative API call, intercept it and use Supabase directly
  // This allows the app to work on Vercel without a custom Express backend
  if (endpoint.startsWith('/api/')) {
    const path = endpoint.replace('/api/', '').split('?')[0];
    const originalPath = endpoint.replace('/api/', '');
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body as string) : null;
    
    // Get current user from localStorage for school_id filtering
    const savedUser = localStorage.getItem('user');
    const user = savedUser ? JSON.parse(savedUser) : null;
    const schoolId = user?.school_id;
    const isSuperAdmin = user?.role?.toLowerCase() === 'superadmin' || user?.role?.toLowerCase() === 'super_admin';

    console.log(`[Supabase Bridge] Intercepting ${method} ${endpoint}`);

    // Helper for multi-tenancy filtering
    const applyFilters = (query: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!isSuperAdmin && schoolId) {
        return query.eq('school_id', schoolId);
      }
      return query;
    };

    // Generic CRUD Router
    try {
      let result;
      
      // Handle simple table-based routes
      const tableMap: Record<string, string> = {
        'students': 'students',
        'teachers': 'teachers',
        'users': 'teachers',
        'grades': 'grades',
        'subjects': 'subjects',
        'exams': 'exams',
        'attendance': 'attendance',
        'marks': 'marks',
        'schools': 'schools',
        'orders': 'orders',
        'subscription-plans': 'subscription_plans',
        'super/users': 'teachers',
        'super/schools': 'schools'
      };

      const table = tableMap[path] || tableMap[path.split('/')[0]];

      // EXCEPTION: Always use real backend for admin operations that require service_role
      const isServerOnly = path.startsWith('admin/');

      if (table && !isServerOnly) {
        const query = supabase.from(table);
        
        if (method === 'GET') {
          // Check for single item fetch
          const id = path.split('/').pop();
          if (id && !isNaN(Number(id))) {
             result = await query.select('*, schools:school_id(name)').eq('id', id).single();
          } else {
             let q = query.select('*, schools:school_id(name)');
             
             // Handle some common query params
             const urlParams = new URLSearchParams(originalPath.split('?')[1]);
             urlParams.forEach((val, key) => {
               if (key === 'grade_id') q = q.eq('grade_id', val);
               if (key === 'subject_id') q = q.eq('subject_id', val);
               if (key === 'exam_id') q = q.eq('exam_id', val);
               if (key === 'school_id') q = q.eq('school_id', val);
             });

             result = await applyFilters(q).order('created_at', { ascending: false });
          }
        } else if (method === 'POST') {
          const payload = { ...body };
          if (!isSuperAdmin && schoolId) payload.school_id = schoolId;
          result = await query.insert([payload]).select().single();
        } else if (method === 'PUT' || method === 'PATCH') {
          const id = path.split('/')[1];
          if (id) {
            result = await query.update(body).eq('id', id).select().single();
          }
        } else if (method === 'DELETE') {
          const id = path.split('/')[1];
          if (id) {
            result = await query.delete().eq('id', id);
          }
        }
      } 
      
      // Special logic for custom endpoints
      else if (path === 'attendance/summary') {
        const { data: attData } = await applyFilters(supabase.from('attendance').select('status'));
        const summary = { present: 0, absent: 0, late: 0, excused: 0, total: attData?.length || 0 };
        attData?.forEach((a: { status: string }) => {
          if (a.status === 'Present') summary.present++;
          else if (a.status === 'Absent') summary.absent++;
          else if (a.status === 'Late') summary.late++;
          else if (a.status === 'Excused') summary.excused++;
        });
        return summary;
      }
      else if (path === 'school/my-subscription') {
        const { data: school } = await supabase.from('schools').select('*').eq('id', schoolId).single();
        const { count: studentCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', schoolId);
        const { count: teacherCount } = await supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('school_id', schoolId);
        
        // Fetch plan limits
        let planDetails = { student_limit: 100, teacher_limit: 10 };
        if (school?.subscription_plan) {
          const { data: plan } = await supabase
            .from('subscription_plans')
            .select('student_limit, teacher_limit')
            .ilike('name', school.subscription_plan)
            .single();
          if (plan) planDetails = plan;
        }

        return {
          ...school,
          usage: { students: studentCount || 0, teachers: teacherCount || 0 },
          plan: planDetails
        };
      }
      else if (path.startsWith('schools/') && path.endsWith('/stats')) {
        const id = path.split('/')[1];
        const { count: students } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', id);
        const { count: teachers } = await supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('school_id', id);
        const { count: subjects } = await supabase.from('subjects').select('*', { count: 'exact', head: true }).eq('school_id', id);
        const { count: marks } = await supabase.from('marks').select('*', { count: 'exact', head: true }).eq('school_id', id);
        return { students: students || 0, teachers: teachers || 0, subjects: subjects || 0, marks: marks || 0 };
      }
      else if (path === 'super/stats' && isSuperAdmin) {
        const { data: schools } = await supabase.from('schools').select('id, subscription_status');
        const { count: students } = await supabase.from('students').select('*', { count: 'exact', head: true });
        return {
          totalSchools: schools?.length || 0,
          activeSubscriptions: (schools as { subscription_status: string }[] | null)?.filter((s) => s.subscription_status === 'Active').length || 0,
          expiredSchools: (schools as { subscription_status: string }[] | null)?.filter((s) => s.subscription_status === 'Expired').length || 0,
          totalStudents: students || 0
        };
      }
      else if (path === 'super/recent-schools' && isSuperAdmin) {
        const { data: schools } = await supabase.from('schools').select('*').order('created_at', { ascending: false }).limit(5);
        return schools || [];
      }
      else if (path === 'super/growth-data' && isSuperAdmin) {
        // Mock growth data based on actual schools
        const { data: schools } = await supabase.from('schools').select('created_at');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const countsByMonth: Record<string, number> = {};
        
        schools?.forEach(s => {
          const date = new Date(s.created_at);
          const month = months[date.getMonth()];
          countsByMonth[month] = (countsByMonth[month] || 0) + 1;
        });

        return months.map(m => ({ month: m, schools: countsByMonth[m] || 0 }));
      }

      if (result) {
        if (result.error) throw result.error;
        return result.data || result;
      }
    } catch (err) {
      console.error(`[Supabase Bridge Error] ${endpoint}:`, err);
      throw err;
    }
  }

  // Original fetch logic as fallback for non-intercepted routes OR if we are in local dev
  let apiBase = import.meta.env.VITE_API_BASE_URL || '';
  
  // Safety: If apiBase is pointing to a Vercel URL but we are in AI Studio, 
  // it might be stale. Default to relative paths for stability.
  if (apiBase.includes('vercel.app') && !window.location.hostname.includes('vercel.app')) {
    console.warn(`VITE_API_BASE_URL (${apiBase}) points to Vercel, but you are currently in AI Studio. Overriding to local relative paths to fix Network Error.`);
    apiBase = '';
  }

  const url = endpoint.startsWith('http') ? endpoint : `${apiBase}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    let data: Record<string, unknown> = {};
    let isJson = false;

    try {
      if (text) {
        data = JSON.parse(text);
        isJson = true;
      } else {
        isJson = true; // empty body is "ok" if status is ok
        data = {};
      }
    } catch {
      isJson = false;
    }
    
    if (isJson) {
      if (!response.ok) {
        throw new Error(data.error || data.message || `API Error: ${response.status}`);
      }
      return data;
    } else {
      console.error(`Non-JSON response from ${url} (Status ${response.status}):`, text.slice(0, 500));
      if (text.includes("<!DOCTYPE html>") || text.includes("<html") || text.includes("The page could not be found")) {
        throw new Error(`Server Error (${response.status}): The server at ${url} returned an HTML page instead of JSON. This often means the API route was not found or the backend crashed. Raw response starts with: "${text.slice(0, 50).replace(/\n/g, ' ')}..."`);
      }
      throw new Error(`Invalid Response: The server returned something that isn't valid JSON. Status: ${response.status}. Raw response starts with: "${text.slice(0, 50).replace(/\n/g, ' ')}..."`);
    }
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message && (error.message.includes("Failed to fetch") || error.message.includes("network error"))) {
      throw new Error(`Network Error: Could not reach the server at ${url}. Ensure the backend is running and the URL is correct.`, { cause: err });
    }
    throw err;
  }
};
