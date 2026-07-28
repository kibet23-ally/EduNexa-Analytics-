import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../useAuth';
import {
  BookOpen, GraduationCap, CheckCircle, XCircle,
  Plus, AlertTriangle, Loader2, Shield,
} from 'lucide-react';

/* ─── Level definitions (matches Register.tsx) ───────────────────── */
const ALL_LEVELS = [
  {
    code: 'PRIMARY',
    name: 'Primary School',
    description: 'Grades 1 – 6',
    grades: 6,
    subjects: 9,
    icon: BookOpen,
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  {
    code: 'JSS',
    name: 'Junior Secondary School',
    description: 'Grades 7 – 9',
    grades: 3,
    subjects: 11,
    icon: GraduationCap,
    color: '#1e3a5f',
    bg: '#f0f4fb',
    border: '#96aed3',
  },
  // Future: Senior Secondary — add here when released
];

interface SchoolLevel {
  id: number;
  school_id: number;
  level_name: string;
  level_code: string;
  is_active: boolean;
  created_at: string;
}

export default function SchoolLevels() {
  const { user } = useAuth();
  const schoolId = Number(user?.school_id);

  const [levels,    setLevels]   = useState<SchoolLevel[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [action,    setAction]   = useState<string | null>(null); // level code being toggled
  const [error,     setError]    = useState('');
  const [success,   setSuccess]  = useState('');

  /* ── Load current levels ─────────────────────────────────────── */
  const fetchLevels = async () => {
    if (!schoolId) return;
    setLoading(true);
    const { data } = await supabase
      .from('school_levels')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at');
    setLevels(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchLevels(); }, [schoolId]);

  /* ── Enable a level ──────────────────────────────────────────── */
  const handleEnable = async (code: string) => {
    setAction(code);
    setError('');
    setSuccess('');
    try {
      const { error: rpcError } = await supabase.rpc('enable_school_level', {
        p_school_id:  schoolId,
        p_level_code: code,
      });
      if (rpcError) throw new Error(rpcError.message);
      setSuccess(`${ALL_LEVELS.find(l => l.code === code)?.name} enabled successfully.`);
      await fetchLevels();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAction(null);
    }
  };

  /* ── Disable a level ─────────────────────────────────────────── */
  const handleDisable = async (code: string) => {
    if (!confirm(`Disable ${ALL_LEVELS.find(l => l.code === code)?.name}? This cannot be done if students or marks exist.`)) return;
    setAction(code);
    setError('');
    setSuccess('');
    try {
      const { error: rpcError } = await supabase.rpc('disable_school_level', {
        p_school_id:  schoolId,
        p_level_code: code,
      });
      if (rpcError) throw new Error(rpcError.message);
      setSuccess(`Level disabled.`);
      await fetchLevels();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAction(null);
    }
  };

  const activeLevel = (code: string) =>
    levels.find(l => l.level_code === code && l.is_active);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-5 rounded-full bg-[#1e3a5f]" />
          <span className="text-[10px] font-bold tracking-widest uppercase text-[#1e3a5f]">
            Settings
          </span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">School Levels</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Manage the education levels offered by your institution
        </p>
      </div>

      {/* Alert */}
      {error && (
        <div className="flex items-start gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
          <CheckCircle size={16} />
          {success}
        </div>
      )}

      {/* Info */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm">
        <Shield size={16} className="flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">About School Levels</p>
          <p className="text-xs mt-0.5 text-blue-600">
            Enabling a level automatically creates all grades and subjects for that level.
            A level can only be disabled if no students or marks exist in it.
          </p>
        </div>
      </div>

      {/* Level cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {ALL_LEVELS.map(level => {
            const Icon       = level.icon;
            const isActive   = !!activeLevel(level.code);
            const isLoading  = action === level.code;
            const dbLevel    = levels.find(l => l.level_code === level.code);

            return (
              <div
                key={level.code}
                className={`rounded-2xl border-2 p-5 transition-all ${
                  isActive
                    ? 'shadow-sm'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
                style={isActive ? {
                  borderColor: level.color,
                  background: level.bg,
                } : {}}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isActive ? level.color + '20' : '#e2e8f0',
                        border: `1.5px solid ${level.border}`,
                      }}>
                      <Icon size={18} style={{ color: isActive ? level.color : '#94a3b8' }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-white">{level.name}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{level.description}</p>
                      <div className="flex gap-4 mt-2 text-xs text-slate-500">
                        <span>{level.grades} grades</span>
                        <span>{level.subjects} subjects</span>
                        {dbLevel && (
                          <span>Added {new Date(dbLevel.created_at).toLocaleDateString('en-KE')}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Toggle button */}
                  <div className="flex-shrink-0">
                    {isActive ? (
                      <button
                        onClick={() => handleDisable(level.code)}
                        disabled={!!action}
                        className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-40 transition-colors flex items-center gap-1.5"
                      >
                        {isLoading
                          ? <Loader2 size={12} className="animate-spin" />
                          : <XCircle size={12} />
                        }
                        Disable
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEnable(level.code)}
                        disabled={!!action}
                        className="px-3 py-1.5 rounded-xl text-white text-xs font-semibold disabled:opacity-40 transition-colors flex items-center gap-1.5"
                        style={{ background: level.color }}
                      >
                        {isLoading
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Plus size={12} />
                        }
                        Enable
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Future note */}
      <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-center">
        <p className="text-xs text-slate-400 font-medium">
          🚀 Senior Secondary School (Grades 10–12) coming soon
        </p>
        <p className="text-xs text-slate-300 mt-1">
          Will be available here once released by EduNexa
        </p>
      </div>
    </div>
  );
}
