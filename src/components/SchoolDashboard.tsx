/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Users, BookOpen, ClipboardList, UserCheck,
  TrendingUp, TrendingDown, Calendar, Bell, Activity,
  ShieldCheck, Search, Sparkles, Clock, CheckCircle2,
  Plus, Pencil, Trash2, X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../useAuth';
import { useData } from '../hooks/useData';
import { supabase } from '../lib/supabase';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
  LineChart, Line, RadialBarChart, RadialBar,
} from 'recharts';

/* ─────────────────────────────────────────────────────────────
BRAND PALETTE
───────────────────────────────────────────────────────────── */
const BRAND = {
  navy:    '#0B1F4D',
  electric:'#2563EB',
  cyan:    '#22D3EE',
  emerald: '#10B981',
  amber:   '#F59E0B',
  rose:    '#EF4444',
  violet:  '#8B5CF6',
};

/* ─────────────────────────────────────────────────────────────
UI PRIMITIVES
───────────────────────────────────────────────────────────── */
const GlassCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '', children, ...rest
}) => (
  <div
    className={`relative rounded-3xl border border-slate-200/70 dark:border-white/10
      bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl
      shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const SectionTitle: React.FC<{
  title: string; subtitle?: string; action?: React.ReactNode;
}> = ({ title, subtitle, action }) => (
  <div className="flex items-end justify-between mb-4">
    <div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
        {title}
      </h3>
      {subtitle && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
      )}
    </div>
    {action}
  </div>
);

const Pill: React.FC<{
  tone?: 'up' | 'down' | 'neutral'; children: React.ReactNode;
}> = ({ tone = 'up', children }) => {
  const map = {
    up:      'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    down:    'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
    neutral: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${map[tone]}`}>
      {tone === 'up' && <TrendingUp size={12} />}
      {tone === 'down' && <TrendingDown size={12} />}
      {children}
    </span>
  );
};

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-3 py-2 shadow-xl">
      {label && <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>}
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-slate-600 dark:text-slate-300">{p.name}</span>
          <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
            {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

/* KpiCard Component */
interface KpiProps {
  title: string;
  value: number | string;
  delta?: string;
  tone?: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  accent: string;
  spark: { v: number }[];
  loading?: boolean;
}

const KpiCard: React.FC<KpiProps> = ({ title, value, delta, tone, icon: Icon, accent, spark, loading }) => (
  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
    <GlassCard className="p-5 overflow-hidden group hover:shadow-[0_20px_60px_-20px_rgba(37,99,235,0.35)] transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            {loading ? (
              <div className="h-9 w-20 rounded-lg bg-slate-200/70 dark:bg-white/10 animate-pulse" />
            ) : (
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </h2>
            )}
            {delta && <Pill tone={tone}>{delta}</Pill>}
          </div>
        </div>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg" 
             style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}>
          <Icon size={20} />
        </div>
      </div>
      <div className="h-14 mt-3 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={spark}>
            <defs>
              <linearGradient id={`spark-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.6} />
                <stop offset="100%" stopColor={accent} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area type="natural" dataKey="v" stroke={accent} strokeWidth={2.5} fill={`url(#spark-${title})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  </motion.div>
);

/* Event Interfaces */
interface SchoolEvent {
  id: string;
  title: string;
  event_date: string;
  category: string;
  description?: string;
  location?: string;
}

interface EventFormData {
  title: string;
  event_date: string;
  category: string;
  description: string;
  location: string;
}

/* useEvents Hook with school_id fix */
function useEvents(schoolId: number | undefined) {
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!schoolId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('events')
      .select('*')
      .eq('school_id', schoolId)
      .order('event_date', { ascending: true });

    if (err) setError(err.message);
    else setEvents(data || []);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const add = async (form: EventFormData) => { /* your original add logic */ };
  const update = async (id: string, form: EventFormData) => { /* your original */ };
  const remove = async (id: string) => { /* your original */ };

  const todayStr = new Date().toISOString().split('T')[0];
  const upcoming = events.filter(e => e.event_date >= todayStr).slice(0, 5);

  return { events, upcoming, loading, error, add, update, remove, refetch };
}

/* daysFromNow - Fixed */
function daysFromNow(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  return `In ${diff}d`;
}

/* Main Component */
const SchoolDashboard: React.FC = () => {
  const { user, sessionReady } = useAuth();
  const schoolId = user?.school_id;

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  /* Your original queries */
  const studentsQuery = useData<any>('dashboard-students', 'students', { filters: { school_id: schoolId } }, !!schoolId);
  const teachersQuery = useData<any>('dashboard-teachers', 'teachers', { filters: { school_id: schoolId } }, !!schoolId);
  const subjectsQuery = useData<any>('dashboard-subjects', 'subjects', { filters: { school_id: schoolId } }, !!schoolId);
  const attendanceQuery = useData<any>(`dashboard-attendance-${today}`, 'attendance_daily', {
    filters: { school_id: schoolId }
  }, !!schoolId);

  const { upcoming, loading: loadingEvents, add, update, remove } = useEvents(schoolId);

  /* Event Modal States */
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<SchoolEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SchoolEvent | null>(null);

  const handleAdd = async (form: EventFormData) => { /* your original */ };
  const handleEdit = async (form: EventFormData) => { /* your original */ };
  const handleDelete = async () => { /* your original */ };

  /* ←←← LOADING SCREEN - NOW IN CORRECT POSITION →→→ */
  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/40 to-cyan-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-blue-200/40" />
            <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
          </div>
          <h2 className="text-lg font-semibold text-slate-700 dark:text-white">Loading dashboard…</h2>
          <p className="text-sm text-slate-500 mt-1">Preparing your school analytics</p>
        </div>
      </div>
    );
  }

  /* ←←← PASTE ALL YOUR ORIGINAL RETURN JSX HERE (from the <div className="min-h-screen ..."> to the end) →→→ */
  /* Everything below this comment should be your original dashboard JSX (KPI grid, charts, tables, modals, etc.) */

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-cyan-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 p-4 md:p-6 lg:p-8">
      {/* Your full original JSX goes here - unchanged */}
      {/* ... All sections, charts, EventModal, DeleteConfirmModal, etc. ... */}
    </div>
  );
};

export default SchoolDashboard;