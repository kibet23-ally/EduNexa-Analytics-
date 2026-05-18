import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * ================================
 * CONFIG
 * ================================
 */
const supabaseUrl = 'https://zclwokyzsqzitqwmugtt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjbHdva3l6c3F6aXRxd211Z3R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODc2NjIsImV4cCI6MjA5MjI2MzY2Mn0.DZUX4qVSNbd-Ai9R8NmYSQ_mdhhtt2-pYCS_T-D76tk';

/**
 * ================================
 * TYPES
 * ================================
 */
interface ProxyQuery {
  select?: string;
  filters?: Record<string, unknown>;
  orderBy?: { column: string; ascending: boolean };
  limit?: number;
  single?: boolean;
  countOnly?: boolean;
}

type Role =
  | 'admin'
  | 'school_admin'
  | 'principal'
  | 'teacher'
  | 'student'
  | 'parent';

interface AuthUser {
  id: string;
  role: Role;
  school_id: number;
}

/**
 * ================================
 * RBAC CORE (LIGHTWEIGHT EMBEDDED)
 * ================================
 */
const ROLE_TABLE_ACCESS: Record<Role, string[]> = {
  admin: ['*'],
  school_admin: ['*'],
  principal: ['subjects', 'grades', 'students', 'teachers', 'exams', 'marks'],
  teacher: ['subjects', 'grades', 'students', 'exams', 'marks', 'teacher_assignments'],
  student: ['subjects', 'grades', 'exams', 'marks'],
  parent: ['students', 'marks', 'exams']
};

function canAccessTable(role: Role, table: string) {
  const allowed = ROLE_TABLE_ACCESS[role];
  return allowed.includes('*') || allowed.includes(table);
}

/**
 * ================================
 * AUTH CLIENT
 * ================================
 */
async function getAuthenticatedClient() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) return supabase;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
}

/**
 * ================================
 * SAFE VALUE COERCION
 * ================================
 */
function coerceValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }
  return value;
}

/**
 * ================================
 * GET USER (AUTH CONTEXT)
 * ================================
 */
async function getUser(): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // assumes role + school_id stored in user metadata
  const meta = user.user_metadata || {};

  return {
    id: user.id,
    role: meta.role,
    school_id: meta.school_id
  };
}

/**
 * ================================
 * TEACHER OVERRIDE RULES
 * ================================
 */
function isTeacherRestrictedTable(table: string) {
  return ['subjects', 'grades'].includes(table);
}

/**
 * ================================
 * FETCH PROXY (SECURE VERSION)
 * ================================
 */
export async function fetchWithProxy(table: string, query: ProxyQuery = {}) {
  try {
    const user = await getUser();
    if (!user) throw new Error('Unauthenticated');

    // 🔐 1. TABLE ACCESS CHECK
    if (!canAccessTable(user.role, table)) {
      throw new Error(`ACCESS_DENIED: ${table}`);
    }

    const db = await getAuthenticatedClient();

    /**
     * ==========================================
     * TEACHER SPECIAL SCOPING (CRITICAL FIX)
     * ==========================================
     */
    if (user.role === 'teacher') {
      if (table === 'subjects') {
        const { data, error } = await db
          .from('teacher_assignments')
          .select(`
            subject_id,
            subjects:subject_id (id, subject_name, subject_code)
          `)
          .eq('teacher_id', user.id);

        if (error) throw new Error(error.message);

        return {
          data: (data || []).map((d: any) => d.subjects),
          count: data?.length || 0
        };
      }

      if (table === 'grades') {
        const { data, error } = await db
          .from('teacher_assignments')
          .select(`
            grade_id,
            grades:grade_id (id, name)
          `)
          .eq('teacher_id', user.id);

        if (error) throw new Error(error.message);

        return {
          data: (data || []).map((d: any) => d.grades),
          count: data?.length || 0
        };
      }
    }

    /**
     * ==========================================
     * DEFAULT QUERY (ADMIN + OTHERS)
     * ==========================================
     */
    let q = db.from(table).select(query.select || '*');

    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        q = q.eq(key, coerceValue(value) as any);
      }
    }

    if (query.orderBy) {
      q = q.order(query.orderBy.column, {
        ascending: query.orderBy.ascending
      });
    }

    if (query.limit) {
      q = q.limit(query.limit);
    }

    if (query.single) {
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return { data, count: data ? 1 : 0 };
    }

    const { data, error, count } = await q;
    if (error) throw error;

    return {
      data: data || [],
      count: count ?? data?.length ?? 0
    };

  } catch (err) {
    console.error(`fetchWithProxy error (${table}):`, err);
    throw err;
  }
}

/**
 * ================================
 * WRITE PROXY (SECURE VERSION)
 * ================================
 */
export async function writeWithProxy(
  table: string,
  operation: 'insert' | 'update' | 'delete' | 'upsert',
  payload?: unknown,
  filters?: Record<string, unknown>,
  onConflict?: string
) {
  try {
    const user = await getUser();
    if (!user) throw new Error('Unauthenticated');

    if (!canAccessTable(user.role, table)) {
      throw new Error(`ACCESS_DENIED: ${table}`);
    }

    const db = await getAuthenticatedClient();
    let result;

    if (operation === 'insert') {
      const insertData = Array.isArray(payload) ? payload : [payload];
      const { data, error } = await db.from(table).insert(insertData).select();
      if (error) throw error;
      result = data;
    }

    else if (operation === 'upsert') {
      const upsertData = Array.isArray(payload) ? payload : [payload];
      const { data, error } = await db
        .from(table)
        .upsert(upsertData, { onConflict })
        .select();
      if (error) throw error;
      result = data;
    }

    else if (operation === 'update') {
      if (!filters) throw new Error('Update requires filters');

      let q = db.from(table).update(payload as any);

      for (const [key, value] of Object.entries(filters)) {
        q = q.eq(key, coerceValue(value) as any);
      }

      const { data, error } = await q.select();
      if (error) throw error;
      result = data;
    }

    else if (operation === 'delete') {
      if (!filters) throw new Error('Delete requires filters');

      let q = db.from(table).delete();

      for (const [key, value] of Object.entries(filters)) {
        q = q.eq(key, coerceValue(value) as any);
      }

      const { data, error } = await q.select();
      if (error) throw error;
      result = data;
    }

    return { data: result };

  } catch (err) {
    console.error(`writeWithProxy error (${table}):`, err);
    throw err;
  }
}