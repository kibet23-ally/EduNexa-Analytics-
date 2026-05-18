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
 * GET USER (RBAC CONTEXT)
 * ================================
 */
async function getUser(): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const meta = user.user_metadata || {};

  return {
    id: user.id,
    role: (meta.role as Role) || 'student',
    school_id: Number(meta.school_id)
  };
}

/**
 * ================================
 * TEACHER DATA RESOLVERS
 * ================================
 * IMPORTANT: keeps frontend unchanged
 */
async function getTeacherSubjects(db: any, userId: string) {
  const { data, error } = await db
    .from('teacher_assignments')
    .select(`
      subjects:subject_id (
        id,
        subject_name,
        subject_code
      )
    `)
    .eq('teacher_id', userId);

  if (error) throw new Error(error.message);

  return (data || [])
    .map((d: any) => d.subjects)
    .filter(Boolean);
}

async function getTeacherGrades(db: any, userId: string) {
  const { data, error } = await db
    .from('teacher_assignments')
    .select(`
      grades:grade_id (
        id,
        name
      )
    `)
    .eq('teacher_id', userId);

  if (error) throw new Error(error.message);

  return (data || [])
    .map((d: any) => d.grades)
    .filter(Boolean);
}

/**
 * ================================
 * MAIN FETCH PROXY
 * ================================
 */
export async function fetchWithProxy(table: string, query: ProxyQuery = {}) {
  try {
    const user = await getUser();
    if (!user) throw new Error('Unauthenticated');

    const db = await getAuthenticatedClient();
    const selectStr = query.select || '*';

    /**
     * ================================
     * TEACHER RESTRICTIONS (FIXED)
     * ================================
     */
    if (user.role === 'teacher') {
      if (table === 'subjects') {
        const data = await getTeacherSubjects(db, user.id);
        return { data, count: data.length };
      }

      if (table === 'grades') {
        const data = await getTeacherGrades(db, user.id);
        return { data, count: data.length };
      }
    }

    /**
     * ================================
     * COUNT ONLY
     * ================================
     */
    if (query.countOnly) {
      let q = db.from(table).select('*', { count: 'exact', head: true });

      if (query.filters) {
        for (const [key, value] of Object.entries(query.filters)) {
          q = q.eq(key, value as any);
        }
      }

      const { count, error } = await q;
      if (error) throw error;

      return { data: null, count: count ?? 0 };
    }

    /**
     * ================================
     * DEFAULT QUERY (ADMIN / OTHERS)
     * ================================
     */
    let q = db.from(table).select(selectStr);

    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        q = q.eq(key, value as any);
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
 * WRITE PROXY (UNCHANGED BUT SAFE)
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
        q = q.eq(key, value as any);
      }

      const { data, error } = await q.select();
      if (error) throw error;
      result = data;
    }

    else if (operation === 'delete') {
      if (!filters) throw new Error('Delete requires filters');

      let q = db.from(table).delete();

      for (const [key, value] of Object.entries(filters)) {
        q = q.eq(key, value as any);
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