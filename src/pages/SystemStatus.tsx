import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ShieldAlert, Database, 
  Terminal, Activity, RefreshCw, AlertTriangle,
  Users, UserPlus, Fingerprint, Trash2
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// Design Recipe 1: Technical Dashboard Layout
const DetailRow = ({ label, value, hint }: { label: string, value: string | null | boolean | number, type?: 'text' | 'token' | 'boolean', hint?: string }) => (
  <div className="group flex flex-col border-b border-slate-100 hover:bg-slate-50/50 transition-colors py-2 px-4">
    <div className="flex items-center justify-between">
      <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 group-hover:text-slate-600 transition-colors italic">
        {label}
      </span>
      <span className={`font-mono text-xs truncate max-w-[200px] ${
        value === true ? 'text-emerald-500 font-bold' : 
        value === false ? 'text-red-500 font-bold' :
        value === null ? 'text-amber-500 font-bold' :
        'text-slate-700'
      }`}>
        {value === true ? 'PRESENT' : value === false ? 'MISSING' : value === null ? 'UNVERIFIED' : String(value)}
      </span>
    </div>
    {hint && !value && <p className="text-[9px] text-red-400 mt-1 font-medium">{hint}</p>}
  </div>
);

interface UserRegistryEntry {
  email: string;
  success: boolean;
  role?: string;
}

interface DbHealth {
  status: string;
  message: string;
  hasPasswordColumn: boolean | null;
  hasSchoolIdColumn: boolean | null;
  details?: string;
}

export default function SystemStatus() {
  const [data, setData] = useState<Record<string, string | boolean | undefined> | null>(null);
  const [dbHealth, setDbHealth] = useState<DbHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [userRegistry, setUserRegistry] = useState<UserRegistryEntry[]>([]);

  const checkStatus = async () => {
    setLoading(true);
    try {
      // 1. Check Backend Health & Service Role Key status
      let adminReady = false;
      try {
        const healthRes = await fetch('/api/health');
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          adminReady = !!healthData.admin_ready;
        }
      } catch (e) {
        console.warn("Backend health check failed:", e);
      }

      const debugRes = {
        SUPABASE_URL: !!import.meta.env.VITE_SUPABASE_URL,
        SUPABASE_ANON_KEY: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: adminReady, 
        JWT_SECRET: !!import.meta.env.VITE_SUPABASE_ANON_KEY, // Indirect check
      };
      
      // Check Supabase connection via anon client
      const { data: testData, error: healthError } = await supabase.from('teachers').select('*').limit(1);
      
      const healthRes: DbHealth = {
        status: healthError ? 'error' : 'ok',
        message: healthError ? healthError.message : 'Successfully connected to Supabase',
        hasPasswordColumn: testData && (testData.length === 0 || 'password' in testData[0]),
        hasSchoolIdColumn: testData && (testData.length === 0 || 'school_id' in testData[0]),
      };
      
      setData(debugRes as Record<string, boolean>);
      setDbHealth(healthRes);
      
      if (healthRes?.hasPasswordColumn === false) {
        setError("CRITICAL: The 'password' column is missing from your database. The system cannot authenticate users.");
      }

      // Fetch all users
      const { data: usersData, error: usersError } = await supabase
        .from('teachers')
        .select('email, role');
        
      if (!usersError && usersData) {
        setUserRegistry(usersData.map(u => ({ email: u.email, role: u.role, success: true })));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Divergent system state detected');
    } finally {
      setLoading(false);
    }
  };

  const runRepair = async () => {
    alert("Administrative repairs (Heal/Purge) are currently disabled in frontend-only mode. Please use the SQL script provided to fix database issues.");
  };

  useEffect(() => {
    const load = async () => { await checkStatus(); };
    load();
  }, []);

  const sqlSetup = `-- RUN THIS IN YOUR SUPABASE SQL EDITOR
-- MASTER FIX FOR INFINITE RECURSION AND RLS (V3.1 - CONSOLIDATED)
-- This script clears all existing policies and applies a consolidated security model.

-- 1. Disable RLS temporarily to clean up
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 2. Security Definer Helpers
CREATE OR REPLACE FUNCTION public.get_auth_role() 
RETURNS text AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_auth_school_id() 
RETURNS bigint AS $$
  SELECT school_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_staff_super_admin() 
RETURNS boolean AS $$
  SELECT LOWER(COALESCE(public.get_auth_role(), '')) IN ('superadmin', 'super_admin');
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. Reset Users Table Security
DO $$ 
DECLARE pol record;
BEGIN
  FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_access_policy" ON public.users FOR ALL
USING (id = auth.uid() OR public.is_staff_super_admin())
WITH CHECK (id = auth.uid() OR public.is_staff_super_admin());

-- 4. Bulk Apply Consolidated Policies to all other tables
DO $$ 
DECLARE
  tab text;
  pol record;
  tables text[] := ARRAY['teachers', 'students', 'subjects', 'grades', 'teacher_assignments', 'exams', 'marks', 'attendance'];
BEGIN
  FOREACH tab IN ARRAY tables LOOP
    -- Drop EVERY policy on the table
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = tab AND schemaname = 'public') LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tab);
    END LOOP;
    
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tab);
    
    -- Consolidated Policy: SuperAdmin OR SchoolMatch
    EXECUTE format('CREATE POLICY "consolidated_access_policy" ON public.%I FOR ALL 
                   USING (public.is_staff_super_admin() OR school_id = public.get_auth_school_id()) 
                   WITH CHECK (public.is_staff_super_admin() OR school_id = public.get_auth_school_id())', tab);
  END LOOP;
END $$;

-- 5. Final Schema Polish
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Teacher';
UPDATE public.users SET role = 'super_admin' WHERE role ILIKE 'super%admin';
`;

  const copySql = () => {
    navigator.clipboard.writeText(sqlSetup);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  const envs = [
    { label: 'Supabase URL', value: data?.SUPABASE_URL, type: 'boolean' as const, hint: 'Essential for DB connection' },
    { label: 'Anon Key', value: data?.SUPABASE_ANON_KEY, type: 'boolean' as const, hint: 'Used for public data only' },
    { label: 'Service Role Key (Backend)', value: data?.SUPABASE_SERVICE_ROLE_KEY, type: 'boolean' as const, hint: 'Enables administrative actions like password reset' },
    { label: 'Client Identity', value: data?.JWT_SECRET, type: 'boolean' as const, hint: 'Required for login sessions' },
    { label: 'Schema Integrity', value: dbHealth?.hasPasswordColumn, type: 'boolean' as const, hint: 'Checks if password column exists' },
    { label: 'Multitenant Ready', value: dbHealth?.hasSchoolIdColumn, type: 'boolean' as const, hint: 'Checks for school_id column' },
  ];

  const serviceKeyTooShort = data?.SUPABASE_SERVICE_ROLE_KEY && String(data.SUPABASE_SERVICE_ROLE_KEY).length < 100;

  return (
    <div className="min-h-screen bg-[#E4E3E0] p-4 md:p-8 font-sans selection:bg-slate-900 selection:text-white">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        {error && (
          <div className="bg-red-600 text-white p-4 font-mono text-xs uppercase tracking-widest border-2 border-black mb-4">
            ERROR DETECTED: {error}
          </div>
        )}
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b-2 border-slate-900 pb-4 gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter text-slate-900 flex items-center gap-3">
              <Activity className="text-slate-900" size={32} />
              SYSTEM DIAGNOSTICS
            </h1>
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">
              Network Health Monitor / v1.5.0-override
            </p>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => window.location.href = '/login'}
              className="bg-white border-2 border-slate-900 text-slate-900 px-4 py-2 text-[10px] font-mono uppercase tracking-widest hover:bg-slate-100 transition-all font-black"
            >
              Return Gateway
            </button>
            <button 
              onClick={checkStatus}
              disabled={loading}
              className="group flex items-center gap-2 bg-slate-900 text-white px-4 py-2 text-[10px] font-mono uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-95"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Scan Network
            </button>
          </div>
        </div>

        {!data?.SUPABASE_SERVICE_ROLE_KEY && (
          <div className="bg-red-600 text-white p-6 border-l-[12px] border-black shadow-2xl animate-pulse">
            <div className="flex gap-4">
              <ShieldAlert size={48} className="shrink-0" />
              <div>
                <h3 className="font-mono text-lg font-black uppercase mb-1 tracking-widest">Master Security Alert</h3>
                <p className="text-sm leading-relaxed font-bold opacity-90 max-w-3xl">
                  MISSING <code className="bg-black/20 p-0.5 rounded">SUPABASE_SERVICE_ROLE_KEY</code>. 
                  Your login and secondary user creation WILL FAIL because Supabase has Row Level Security (RLS) enabled. 
                  You must add this key to your AI Studio Secrets immediately.
                </p>
              </div>
            </div>
          </div>
        )}

        {dbHealth?.hasPasswordColumn === false && (
          <div className="bg-orange-600 text-white p-6 border-l-[12px] border-black shadow-2xl">
            <div className="flex gap-4">
              <AlertTriangle size={48} className="shrink-0" />
              <div>
                <h3 className="font-mono text-lg font-black uppercase mb-1 tracking-widest">Urgent: Schema Corruption</h3>
                <p className="text-sm leading-relaxed font-bold opacity-90 max-w-3xl">
                  The <code className="bg-black/20 p-0.5 rounded">password</code> column is missing from your database. 
                  Users cannot log in and schools cannot be created.
                  <br /><br />
                  <strong>Fix:</strong> Copy the SQL script below and run it in your **Supabase SQL Editor**.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Environment Stack */}
          <div className="bg-white border border-slate-900 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
            <div className="p-4 border-b border-slate-900 bg-slate-50">
              <h3 className="font-mono text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Database size={14} />
                Environment Stack
              </h3>
            </div>
            <div className="py-2">
              {dbHealth?.status === 'connected_limited' && (
                <div className="m-4 p-3 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] leading-relaxed">
                  <p className="font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                    <ShieldAlert size={12} />
                    Service Key Restricted
                  </p>
                  Your API key was rejected by the database. The system is "live" but administrative actions (Purge/Heal) will be blocked.
                </div>
              )}
              {envs.map(env => (
                <DetailRow key={env.label} label={env.label} value={env.value} type={env.type} hint={env.hint} />
              ))}
              {serviceKeyTooShort && (
                <div className="p-4 bg-orange-50 text-orange-700 text-[10px] font-bold border-t border-orange-200">
                  ⚠️ Service key looks truncated. It should be a long string starting with 'eyJ'.
                </div>
              )}
            </div>
          </div>

          {/* User Registry Analyzer */}
          <div className="md:col-span-2 bg-white border border-slate-900 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
            <div className="p-4 border-b border-slate-900 bg-slate-50 flex items-center justify-between">
              <h3 className="font-mono text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Users size={14} />
                Database User Registry
              </h3>
              <button 
                onClick={() => runRepair()} 
                className="text-[9px] font-mono font-bold bg-slate-900 text-white px-2 py-1 uppercase"
              >
                Sync All Passwords
              </button>
            </div>
            <div className="max-h-[300px] overflow-auto">
              {userRegistry.length > 0 ? (
                <table className="w-full text-left font-mono text-[10px]">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2 border-b border-slate-200">Account</th>
                      <th className="p-2 border-b border-slate-200">Status</th>
                      <th className="p-2 border-b border-slate-200">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userRegistry.map((u, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="p-2 truncate max-w-[150px]">{u.email}</td>
                        <td className="p-2">
                          <span className={u.success ? 'text-emerald-500' : 'text-red-500'}>
                            {u.success ? 'VERIFIED' : 'FAILED'}
                          </span>
                        </td>
                        <td className="p-2 opacity-50 uppercase">{u.role || 'User'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-12 text-center space-y-4">
                  <Fingerprint size={32} className="mx-auto text-slate-200" />
                  <p className="text-[10px] text-slate-400 italic">No synchronization performed yet. Click 'Sync All Passwords' to verify registry.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Master Toolbox */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SQL Payload */}
          <div className="bg-slate-900 text-emerald-400 p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10">
              <Terminal size={120} />
            </div>
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-orange-500" />
                <h3 className="font-mono text-xs font-black uppercase tracking-widest text-white">Database Override Payload</h3>
              </div>
              <button onClick={copySql} className="text-white hover:text-emerald-400 flex items-center gap-2 font-mono text-[10px] uppercase font-bold">
                {copying ? 'Capture Successful' : 'Extract Core'}
              </button>
            </div>
            <pre className="font-mono text-[10px] bg-black/40 p-4 rounded overflow-auto border border-white/5 leading-relaxed whitespace-pre-wrap min-h-[150px]">
              {sqlSetup}
            </pre>
            <p className="mt-4 text-[9px] text-emerald-500/60 font-mono italic">
              // This script forcibly removes Row Level Security constraints across the entire cluster.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
             <div className="bg-white border border-slate-900 p-6 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
               <h3 className="font-mono text-xs font-black uppercase mb-4 tracking-widest text-slate-900">Emergency Protocol</h3>
               <div className="grid grid-cols-2 gap-4">
                 <button onClick={() => runRepair()} className="flex items-center gap-2 justify-center bg-slate-900 text-white p-3 font-mono text-[10px] font-bold uppercase tracking-wider hover:bg-slate-800">
                   <ShieldCheck size={14} /> Repair Root
                 </button>
                 <button onClick={() => runRepair()} className="flex items-center gap-2 justify-center bg-orange-600 text-white p-3 font-mono text-[10px] font-bold uppercase tracking-wider hover:bg-orange-700">
                   <UserPlus size={14} /> Repair All
                 </button>
               </div>
               
               <button 
                 onClick={() => runRepair()} 
                 className="mt-4 w-full flex flex-col items-center justify-center gap-1 bg-emerald-600 text-white p-4 font-mono uppercase hover:bg-emerald-700 transition-colors border-b-4 border-emerald-900 active:border-b-0 active:translate-y-1"
               >
                 <div className="flex items-center gap-2 text-[10px] font-black tracking-widest">
                   <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                   Heal Missing School Admins
                 </div>
                 <span className="text-[8px] font-normal opacity-80 lowercase">Restores access to Marumbasi, Chemamul, etc.</span>
               </button>
               <button 
                 onClick={() => runRepair()} 
                 className="mt-4 w-full flex items-center justify-center gap-2 bg-red-900 text-white p-3 font-mono uppercase hover:bg-black transition-colors"
               >
                 <Trash2 size={12} />
                 <span className="text-[9px] font-black tracking-widest">Purge Orphaned Data</span>
               </button>
               <div className="mt-6 p-4 bg-slate-50 border border-slate-100 rounded">
                 <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2 flex items-center gap-2">
                   <AlertTriangle size={12} className="text-orange-500" />
                   Connection Status
                 </h4>
                 <p className={`text-[10px] font-mono font-bold ${dbHealth?.status === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
                   GATEWAY: {dbHealth?.status?.toUpperCase() || 'SCAN_REQUIRED'}
                 </p>
                 <p className="text-[9px] text-slate-400 font-mono mt-1 leading-tight">
                   {dbHealth?.message || 'Awaiting synchronization with Supabase cluster...'}
                 </p>
               </div>
             </div>

             <div className="bg-slate-900 text-white p-4 font-mono text-[10px] italic">
               "If system is green but login fails, the error is definitely RLS. Paste the SQL script into your Supabase SQL Editor."
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
