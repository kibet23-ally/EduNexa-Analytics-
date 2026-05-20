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
);  const SectionTitle: React.FC<{  
title: string; subtitle?: string; action?: React.ReactNode;  
}> = ({ title, subtitle, action }) => (    <div className="flex items-end justify-between mb-4">    
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
);  const Pill: React.FC<{  
tone?: 'up' | 'down' | 'neutral'; children: React.ReactNode;  
}> = ({ tone = 'up', children }) => {  
const map = {  
up:      'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',  
down:    'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',  
neutral: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',  
} as const;  
return (  
<span
  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${map[tone]}`}
>  
{tone === 'up'   && <TrendingUp size={12} />}  
{tone === 'down' && <TrendingDown size={12} />}  
{children}  
</span>  
);  
};  const ChartTooltip = ({ active, payload, label }: any) => {
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
};  /* ─────────────────────────────────────────────────────────────
KPI CARD
───────────────────────────────────────────────────────────── */
interface KpiProps {
title: string; value: number | string; delta?: string;
tone?: 'up' | 'down' | 'neutral'; icon: React.ElementType;
accent: string; spark: { v: number }[]; loading?: boolean;
}

const KpiCard: React.FC<KpiProps> = ({
title, value, delta, tone, icon: Icon, accent, spark, loading,
}) => (
<motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
<GlassCard className="p-5 overflow-hidden group hover:shadow-[0_20px_60px_-20px_rgba(37,99,235,0.35)] transition-shadow">

<div className="flex items-start justify-between">  
<div>  
<p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">  
{title}  
</p>  
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
<div  
className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg"  
style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}  
>  
<Icon size={20} />  
</div>  
</div>  
<div className="h-14 mt-3 -mx-1">  
<ResponsiveContainer width="100%" height="100%">  
<AreaChart data={spark} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>  
<defs>  
<linearGradient id={`g-${title}`} x1="0" x2="0" y1="0" y2="1">  
<stop offset="0%" stopColor={accent} stopOpacity={0.5} />  
<stop offset="100%" stopColor={accent} stopOpacity={0} />  
</linearGradient>  
</defs>  
<Area
  type="monotone"
  dataKey="v"
  stroke={accent}
  strokeWidth={2}
  fill={`url(#g-${title})`}
/>  
</AreaChart>  
</ResponsiveContainer>  
</div>  
</GlassCard>  
</motion.div>  
);  /* ─────────────────────────────────────────────────────────────
EVENTS — TYPES, HOOK, MODAL, DELETE CONFIRM
───────────────────────────────────────────────────────────── */
interface SchoolEvent {
id: string; school_id: string; title: string;
description: string | null; event_date: string;
event_time: string | null; category: string | null;
created_by: string | null; created_at: string; updated_at: string;
}

interface EventFormData {
title: string; description: string; event_date: string;
event_time: string; category: string;
}

const EVENT_CATEGORIES = ['Academic','Sports','Cultural','Meeting','Holiday','Exam','Other'];

const CATEGORY_COLORS: Record<string, string> = {
Academic: 'bg-blue-500/10 text-blue-600',
Sports:   'bg-emerald-500/10 text-emerald-600',
Cultural: 'bg-purple-500/10 text-purple-600',
Meeting:  'bg-amber-500/10 text-amber-600',
Holiday:  'bg-rose-500/10 text-rose-600',
Exam:     'bg-orange-500/10 text-orange-600',
Other:    'bg-slate-100 text-slate-600',
};

function useEvents(schoolId: number | undefined) {
const [events, setEvents]   = useState<SchoolEvent[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError]     = useState<string | null>(null);

const refetch = useCallback(async () => {
if (!schoolId) return;
setLoading(true); setError(null);
const { data, error: err } = await supabase
.from('events').select('*').order('event_date', { ascending: true });
if (err) setError(err.message);
else setEvents(data ?? []);
setLoading(false);
}, [schoolId]);

useEffect(() => { refetch(); }, [refetch]);

const todayStr = new Date().toISOString().split('T')[0];
const upcoming = events.filter(e => e.event_date >= todayStr).slice(0, 5);

const add = async (form: EventFormData, userId: string) => {
const { error: err } = await supabase.from('events').insert({
title: form.title, description: form.description || null,
event_date: form.event_date, event_time: form.event_time || null,
category: form.category || null, created_by: userId,
});
if (!err) refetch();
return err?.message ?? null;
};

const update = async (id: string, form: EventFormData) => {
const { error: err } = await supabase.from('events').update({
title: form.title, description: form.description || null,
event_date: form.event_date, event_time: form.event_time || null,
category: form.category || null, updated_at: new Date().toISOString(),
}).eq('id', id);
if (!err) refetch();
return err?.message ?? null;
};

const remove = async (id: string) => {
const { error: err } = await supabase.from('events').delete().eq('id', id);
if (!err) refetch();
return err?.message ?? null;
};

return { events, upcoming, loading, error, add, update, remove };
}

const EMPTY_FORM: EventFormData = {
title: '', description: '', event_date: '', event_time: '', category: 'Academic',
};

const EventModal: React.FC<{
mode: 'add' | 'edit'; initial: EventFormData;
onSave: (f: EventFormData) => Promise<void>;
onClose: () => void; saving: boolean; saveError: string | null;
}> = ({ mode, initial, onSave, onClose, saving, saveError }) => {
const [form, setForm] = useState<EventFormData>(initial);
const set = (k: keyof EventFormData) =>
(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
setForm(p => ({ ...p, [k]: e.target.value }));

return (

<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">  
<div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-white/10">  
<div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10">  
<h2 className="text-base font-semibold text-slate-800 dark:text-white">  
{mode === 'add' ? 'Add New Event' : 'Edit Event'}  
</h2>  
<button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">  
<X size={16} />  
</button>  
</div>  
<form  
onSubmit={async e => { e.preventDefault(); if (!form.title.trim() || !form.event_date) return; await onSave(form); }}  
className="px-6 py-5 space-y-4"  
>  
<div>  
<label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Title *</label>  
<input type="text" value={form.title} onChange={set('title')} required  
placeholder="e.g. End of Term Exams"  
className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"  
/>  
</div>  
<div className="grid grid-cols-2 gap-3">  
<div>  
<label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Date *</label>  
<input type="date" value={form.event_date} onChange={set('event_date')} required  
className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"  
/>  
</div>  
<div>  
<label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Time</label>  
<input type="time" value={form.event_time} onChange={set('event_time')}  
className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"  
/>  
</div>  
</div>  
<div>  
<label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Category</label>  
<select value={form.category} onChange={set('category')}  
className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"  
>  
{EVENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}  
</select>  
</div>  
<div>  
<label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Description</label>  
<textarea value={form.description} onChange={set('description')} rows={3}  
placeholder="Optional details…"  
className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"  
/>  
</div>  
{saveError && (  
<p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 rounded-lg">{saveError}</p>  
)}  
<div className="flex gap-3 pt-1">  
<button type="button" onClick={onClose}    
className="flex-1 px-4 py-2 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">  
Cancel  
</button>  
<button type="submit" disabled={saving}    
className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors">  
{saving ? 'Saving…' : mode === 'add' ? 'Add Event' : 'Save Changes'}  
</button>  
</div>  
</form>  
</div>  
</div>  
);  
};  const DeleteConfirm: React.FC<{
event: SchoolEvent; onConfirm: () => void;
onCancel: () => void; deleting: boolean;
}> = ({ event, onConfirm, onCancel, deleting }) => (

  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">    
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-200 dark:border-white/10">    
      <div className="flex items-center gap-3 mb-4">    
        <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center flex-shrink-0">    
          <Trash2 size={18} className="text-rose-600" />    
        </div>    
        <div>    
          <h3 className="font-semibold text-slate-800 dark:text-white">Delete Event</h3>    
          <p className="text-xs text-slate-500 mt-0.5">This cannot be undone.</p>    
        </div>    
      </div>    
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">    
        Delete <strong className="text-slate-800 dark:text-white">"{event.title}"</strong>?    
      </p>    
      <div className="flex gap-3">    
        <button onClick={onCancel}    
          className="flex-1 px-4 py-2 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">    
          Cancel    
        </button>    
        <button onClick={onConfirm} disabled={deleting}    
          className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-medium hover:bg-rose-700 disabled:opacity-60 transition-colors">    
          {deleting ? 'Deleting…' : 'Delete'}    
        </button>    
      </div>    
    </div>    
  </div>    
);  /* ─────────────────────────────────────────────────────────────  
HELPER  
───────────────────────────────────────────────────────────── */  
function daysFromNow(dateStr: string) {  
const today = new Date(); today.setHours(0, 0, 0, 0);  
const d = new Date(dateStr + 'T00:00:00');  
const diff = Math.round((d.getTime() - today.getTime()) / 86400000);  
if (diff === 0) return 'Today';  
if (diff === 1) return 'Tomorrow';  
if (diff < 0) return `${Math.abs(diff)}d ago`;
function daysFromNow(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const d = new Date(dateStr + 'T00:00:00');

  const diff = Math.round(
    (d.getTime() - today.getTime()) / 86400000
  );

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 0) return `${Math.abs(diff)}d ago`;

  return `In ${diff}d`;
}   
}  /* ─────────────────────────────────────────────────────────────
ACADEMIC PERFORMANCE HOOK
───────────────────────────────────────────────────────────── */
function useAcademicPerformance(schoolId: number | undefined) {
const [data, setData]       = useState<{ label: string; avg: number }[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError]     = useState<string | null>(null);

useEffect(() => {
if (!schoolId) return;
(async () => {
setLoading(true);
const { data: rows, error: err } = await supabase
.from('marks')
.select('score, exam_id, exams!inner(id, exam_name, term, year)')
.not('score', 'is', null);
if (err) { setError(err.message); setLoading(false); return; }

const map = new Map<string, { label: string; scores: number[]; sortKey: string }>();
for (const row of rows ?? []) {
const exam = (row as any).exams as { id: number; exam_name: string; term: number; year: number } | null;
if (!exam || row.score === null) continue;
const key     = String(exam.id);
const sortKey = `${exam.year ?? 0}-${String(exam.term ?? 0).padStart(2, '0')}`;
const label = `${exam.exam_name} (T${exam.term ?? '?'} ${exam.year ?? ''})`.trim();
const label   = ${exam.exam_name} (T${exam.term ?? '?'} ${exam.year ?? ''}).trim();
if (!map.has(key)) map.set(key, { label, scores: [], sortKey });
map.get(key)!.scores.push(row.score as number);
}
const result = Array.from(map.values())
.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
.slice(-6)
.map(e => ({ label: e.label, avg: Math.round(e.scores.reduce((s, v) => s + v, 0) / e.scores.length) }));
setData(result); setLoading(false);
})();

}, [schoolId]);

return { data, loading, error };
}

/* ─────────────────────────────────────────────────────────────
SUBJECT PERFORMANCE HOOK
───────────────────────────────────────────────────────────── */
function useSubjectPerformance(schoolId: number | undefined) {
const [data, setData]       = useState<{ subject: string; avg: number }[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError]     = useState<string | null>(null);

useEffect(() => {
if (!schoolId) return;
(async () => {
setLoading(true);
const { data: rows, error: err } = await supabase
.from('marks')
.select('score, subject_id, subjects!inner(id, subject_name)')
.not('score', 'is', null);
if (err) { setError(err.message); setLoading(false); return; }

const map = new Map<string, { label: string; scores: number[] }>();
for (const row of rows ?? []) {
const subject = (row as any).subjects as { id: number; subject_name: string } | null;
if (!subject || row.score === null) continue;
const key = String(subject.id);
if (!map.has(key)) map.set(key, { label: subject.subject_name, scores: [] });
map.get(key)!.scores.push(row.score as number);
}
const result = Array.from(map.values())
.map(s => ({ subject: s.label, avg: Math.round(s.scores.reduce((sum, v) => sum + v, 0) / s.scores.length) }))
.sort((a, b) => b.avg - a.avg);
setData(result); setLoading(false);
})();

}, [schoolId]);

return { data, loading, error };
}

/* ─────────────────────────────────────────────────────────────
MAIN DASHBOARD COMPONENT
───────────────────────────────────────────────────────────── */
const SchoolDashboard: React.FC = () => {
const { user, sessionReady } = useAuth();
const enabled  = sessionReady && !!user?.school_id;
const isAdmin  = user?.role === 'school_admin' || user?.role === 'admin';

/* ── today string — used in query key AND filter ── */
const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

/* ── Standard data queries ── */
const studentsQuery = useData<any>('dashboard-students', 'students',
{ filters: { school_id: user?.school_id } }, enabled);
const teachersQuery = useData<any>('dashboard-teachers', 'teachers',
{ filters: { school_id: user?.school_id } }, enabled);
const subjectsQuery = useData<any>('dashboard-subjects', 'subjects',
{ filters: { school_id: user?.school_id } }, enabled);
const examsQuery    = useData<any>('dashboard-exams', 'exams',
{ filters: { school_id: user?.school_id }, orderBy: { column: 'year', ascending: false } }, enabled);

/* ── Attendance period state ── */
const [attendancePeriod, setAttendancePeriod] = useState<'today' | 'week' | 'month'>('today');

/* ── Attendance query ── */
const attendanceQuery = useData<any>(
  `dashboard-attendance-${attendancePeriod}-${today}`,
  'attendance_daily',
  {
    select: 'student_id, grade_name, status, date',
    filters: {
      school_id: user?.school_id,
    },
  },
  enabled,
  0,
);

/* ── Analytics hooks ── */
const { data: performanceData, loading: loadingPerf, error: errorPerf } =
useAcademicPerformance(enabled ? user?.school_id : undefined);
const { data: subjectData, loading: loadingSubj, error: errorSubj } =
useSubjectPerformance(enabled ? user?.school_id : undefined);

/* ── Events hook ── */
const { upcoming, loading: loadingEvents, error: errorEvents, add, update, remove } =
useEvents(enabled ? user?.school_id : undefined);

/* ── Event modal state ── */
const [showAdd,      setShowAdd]      = useState(false);
const [editTarget,   setEditTarget]   = useState<SchoolEvent | null>(null);
const [deleteTarget, setDeleteTarget] = useState<SchoolEvent | null>(null);
const [saving,       setSaving]       = useState(false);
const [deleting,     setDeleting]     = useState(false);
const [saveError,    setSaveError]    = useState<string | null>(null);

const handleAdd = async (form: EventFormData) => {
setSaving(true); setSaveError(null);
const err = await add(form, user?.id ?? '');
setSaving(false);
if (err) { setSaveError(err); return; }
setShowAdd(false);
};
const handleEdit = async (form: EventFormData) => {
if (!editTarget) return;
setSaving(true); setSaveError(null);
const err = await update(editTarget.id, form);
setSaving(false);
if (err) { setSaveError(err); return; }
setEditTarget(null);
};
const handleDelete = async () => {
if (!deleteTarget) return;
setDeleting(true);
await remove(deleteTarget.id);
setDeleting(false); setDeleteTarget(null);
};

/* ── Loading screen ── */
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

/* ── Filter attendance rows by selected period ── */
const attendanceRows = useMemo(() => {
  const rows = attendanceQuery.data ?? [];

  const now = new Date();

  return rows.filter((row: any) => {
    if (!row.date) return false;

    const rowDate = new Date(row.date);

    if (attendancePeriod === 'today') {
      return row.date === today;
    }

    if (attendancePeriod === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      return rowDate >= weekAgo;
    }

    if (attendancePeriod === 'month') {
      return (
        rowDate.getMonth() === now.getMonth() &&
        rowDate.getFullYear() === now.getFullYear()
      );
    }

    return true;
  });
}, [attendanceQuery.data, attendancePeriod, today]);

const present = attendanceRows.filter(
  (a: any) => a.status?.toLowerCase() === 'present'
).length;

const absent = attendanceRows.filter(
  (a: any) => a.status?.toLowerCase() === 'absent'
).length;

const late = attendanceRows.filter(
  (a: any) => a.status?.toLowerCase() === 'late'
).length;

const totalMarked = present + absent + late;

const attendanceRate = totalMarked
  ? Math.round((present / totalMarked) * 100)
  : 0;

const attendancePie = [
{ name: 'Present', value: present, fill: BRAND.emerald },
{ name: 'Absent',  value: absent,  fill: BRAND.rose    },
{ name: 'Late',    value: late,    fill: BRAND.amber   },
];
const attendanceRadial = [{ name: 'Attendance', value: attendanceRate, fill: BRAND.electric }];

/* ── Attendance breakdown by grade (new — replaces redundant pie) ── */
const attendanceByGrade = useMemo(() => {
const map: Record<string, { present: number; total: number }> = {};
attendanceRows.forEach((a: any) => {
const grade = a.grade_name ?? 'Unknown';
if (!map[grade]) map[grade] = { present: 0, total: 0 };
map[grade].total += 1;
if (a.status?.toLowerCase() === 'present') map[grade].present += 1;
});
return Object.entries(map)
.map(([grade, v]) => ({
grade,
rate: v.total ? Math.round((v.present / v.total) * 100) : 0,
}))
.sort((a, b) => a.grade.localeCompare(b.grade));
}, [attendanceRows]);

/* ── KPI counts ── */
const studentsCount = studentsQuery.data?.length ?? 0;
const teachersCount = teachersQuery.data?.length ?? 0;
const subjectsCount = subjectsQuery.data?.length ?? 0;
const examsCount    = examsQuery.data?.length    ?? 0;

const mkSpark = (seed: number) =>
Array.from({ length: 12 }, (_, i) => ({
v: Math.max(2, Math.round(seed * (0.6 + Math.sin(i / 1.7 + seed) * 0.25 + i / 28))),
}));

const enrollmentTrend = useMemo(() => [
{ month: 'Jan', students: Math.max(20, studentsCount - 120), target: studentsCount - 80  },
{ month: 'Feb', students: Math.max(20, studentsCount - 95),  target: studentsCount - 60  },
{ month: 'Mar', students: Math.max(20, studentsCount - 70),  target: studentsCount - 40  },
{ month: 'Apr', students: Math.max(20, studentsCount - 50),  target: studentsCount - 20  },
{ month: 'May', students: Math.max(20, studentsCount - 25),  target: studentsCount - 10  },
{ month: 'Jun', students: studentsCount,                      target: studentsCount + 10  },
], [studentsCount]);

const kpis: KpiProps[] = [
{ title: 'Total Students', value: studentsCount, delta: '+4.8%',  tone: 'up',      icon: Users,        accent: BRAND.electric, spark: mkSpark(studentsCount || 40), loading: studentsQuery.isLoading },
{ title: 'Teachers',       value: teachersCount, delta: '+1.2%',  tone: 'up',      icon: UserCheck,    accent: BRAND.emerald,  spark: mkSpark(teachersCount || 14), loading: teachersQuery.isLoading },
{ title: 'Subjects',       value: subjectsCount, delta: 'Stable', tone: 'neutral', icon: BookOpen,     accent: BRAND.violet,   spark: mkSpark(subjectsCount || 10), loading: subjectsQuery.isLoading },
{ title: 'Exams Tracked',  value: examsCount,    delta: '+12%',   tone: 'up',      icon: ClipboardList,accent: BRAND.amber,    spark: mkSpark(examsCount    || 8),  loading: examsQuery.isLoading    },
];

const topSubject = subjectData[0] ? Top: ${subjectData[0].subject} ${subjectData[0].avg}% : null;

/* ════════════════════════════════════════════════════════
RENDER
════════════════════════════════════════════════════════ */
return (

<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-cyan-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 p-4 md:p-6 lg:p-8">  {/* ── Event modals ── */}
{showAdd && (
<EventModal mode="add" initial={EMPTY_FORM} onSave={handleAdd}
onClose={() => { setShowAdd(false); setSaveError(null); }}
saving={saving} saveError={saveError} />
)}
{editTarget && (
<EventModal mode="edit"
initial={{ title: editTarget.title, description: editTarget.description ?? '',
event_date: editTarget.event_date, event_time: editTarget.event_time ?? '',
category: editTarget.category ?? 'Academic' }}
onSave={handleEdit}
onClose={() => { setEditTarget(null); setSaveError(null); }}
saving={saving} saveError={saveError} />
)}
{deleteTarget && (
<DeleteConfirm event={deleteTarget} onConfirm={handleDelete}
onCancel={() => setDeleteTarget(null)} deleting={deleting} />
)}

{/* ════════════ HEADER ════════════ */}
<motion.div
initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8"

> 

<div>    
  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-3">    
    <Sparkles size={12} /> Dashboard Overview    
  </div>    
  <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">    
    Welcome back, {user?.name || 'Admin'} 👋    
  </h1>    
  <p className="text-slate-500 dark:text-slate-400 mt-2">    
    Here's a real-time snapshot of your school's performance today.    
  </p>    
</div>    
<div className="flex items-center gap-3">    
  <div className="hidden md:flex items-center gap-2 px-4 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 w-72">    
    <Search size={16} className="text-slate-400" />    
    <input className="flex-1 bg-transparent outline-none text-sm placeholder:text-slate-400"    
      placeholder="Search students, teachers..." />    
  </div>    
  <button className="relative w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 flex items-center justify-center hover:shadow-md transition">    
    <Bell size={18} className="text-slate-700 dark:text-slate-200" />    
    <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />    
  </button>    
  <div className="h-12 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold text-sm flex items-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer">    
    <ShieldCheck size={16} />    
    {user?.role || 'Admin'}    
  </div>    
</div>

</motion.div>

{/* ════════════ KPI ROW ════════════ */}

  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">    
    {kpis.map(k => <KpiCard key={k.title} {...k} />)}    
  </div>    {/* ════════════ ROW 1 — Enrollment + Today's Attendance ════════════ */}

  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">    {/* Enrollment growth */}    
<GlassCard className="lg:col-span-2 p-6">    
  <SectionTitle    
    title="Enrollment Growth"    
    subtitle="Students vs target over the last 6 months"    
    action={    
      <div className="flex items-center gap-3 text-xs">    
        <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">    
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: BRAND.electric }} /> Students    
        </span>    
        <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">    
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: BRAND.cyan }} /> Target    
        </span>    
      </div>    
    }    
  />    
  <div className="h-72">    
    <ResponsiveContainer width="100%" height="100%">    
      <AreaChart data={enrollmentTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>    
        <defs>    
          <linearGradient id="gStudents" x1="0" x2="0" y1="0" y2="1">    
            <stop offset="0%" stopColor={BRAND.electric} stopOpacity={0.45} />    
            <stop offset="100%" stopColor={BRAND.electric} stopOpacity={0} />    
          </linearGradient>    
          <linearGradient id="gTarget" x1="0" x2="0" y1="0" y2="1">    
            <stop offset="0%" stopColor={BRAND.cyan} stopOpacity={0.35} />    
            <stop offset="100%" stopColor={BRAND.cyan} stopOpacity={0} />    
          </linearGradient>    
        </defs>    
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />    
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />    
        <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />    
        <Tooltip content={<ChartTooltip />} />    
        <Area type="monotone" dataKey="target"   stroke={BRAND.cyan}    strokeWidth={2}   fill="url(#gTarget)"   />    
        <Area type="monotone" dataKey="students" stroke={BRAND.electric} strokeWidth={2.5} fill="url(#gStudents)" />    
      </AreaChart>    
    </ResponsiveContainer>    
  </div>    
</GlassCard>    

{/* Today's attendance — radial gauge + status totals */}    
<GlassCard className="p-6">    
  <SectionTitle
  title="Attendance Overview"
  subtitle={
    attendancePeriod === 'today'
      ? 'Today'
      : attendancePeriod === 'week'
      ? 'Last 7 Days'
      : 'This Month'
  }
  action={
    <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/10 p-1 rounded-xl">
      {['today', 'week', 'month'].map((period) => (
        <button
          key={period}
          onClick={() => setAttendancePeriod(period as 'today' | 'week' | 'month')}
          className={`px-3 py-1 text-xs rounded-lg transition-colors font-medium ${
            attendancePeriod === period
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10'
          }`}
        >
          {period === 'today'
            ? 'Today'
            : period === 'week'
            ? 'Week'
            : 'Month'}
        </button>
      ))}
    </div>
  }
/>   
  <div className="relative h-48">    
    <ResponsiveContainer width="100%" height="100%">    
      <RadialBarChart innerRadius="70%" outerRadius="100%"    
        data={attendanceRadial} startAngle={90} endAngle={-270}>    
        <RadialBar background dataKey="value" cornerRadius={20} fill={BRAND.electric} />    
      </RadialBarChart>    
    </ResponsiveContainer>    
    <div className="absolute inset-0 flex flex-col items-center justify-center">    
      <div className="text-4xl font-bold text-slate-900 dark:text-white tabular-nums">    
        {attendanceRate}%    
      </div>    
      <div className="text-xs font-medium text-slate-500 mt-1">Present rate</div>    
    </div>    
  </div>    
  <div className="grid grid-cols-3 gap-2 mt-4">    
    {attendancePie.map(a => (    
      <div key={a.name} className="text-center rounded-xl p-2 bg-slate-50 dark:bg-white/5">    
        <div className="flex items-center justify-center gap-1.5">    
          <span className="w-2 h-2 rounded-full" style={{ background: a.fill }} />    
          <span className="text-[11px] font-medium text-slate-500">{a.name}</span>    
        </div>    
        <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">    
          {a.value}    
        </div>    
      </div>    
    ))}    
  </div>    
</GlassCard>

  </div>    {/* ════════════ ROW 2 — Academic Performance + Attendance Breakdown by Grade ════════════ */}

  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">    {/* Academic Performance */}    
<GlassCard className="lg:col-span-2 p-6">    
  <SectionTitle title="Academic Performance" subtitle="Average score per exam" />    
  {loadingPerf ? (    
    <div className="h-72 flex items-center justify-center">    
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />    
    </div>    
  ) : errorPerf ? (    
    <div className="h-72 flex items-center justify-center text-sm text-rose-500">{errorPerf}</div>    
  ) : performanceData.length === 0 ? (    
    <div className="h-72 flex flex-col items-center justify-center text-slate-400">    
      <ClipboardList size={32} className="mb-2 opacity-40" />    
      <p className="text-sm">No exam results recorded yet.</p>    
    </div>    
  ) : (    
    <div className="h-72">    
      <ResponsiveContainer width="100%" height="100%">    
        <BarChart data={performanceData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>    
          <defs>    
            <linearGradient id="gBar" x1="0" x2="0" y1="0" y2="1">    
              <stop offset="0%" stopColor={BRAND.electric} />    
              <stop offset="100%" stopColor={BRAND.cyan} />    
            </linearGradient>    
          </defs>    
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />    
          <XAxis dataKey="label" tickLine={false} axisLine={false}    
            tick={{ fill: '#94a3b8', fontSize: 12 }}    
            tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + '…' : v} />    
          <YAxis domain={[0, 100]} tickLine={false} axisLine={false}    
            tick={{ fill: '#94a3b8', fontSize: 12 }}    
            tickFormatter={(v: number) => `${v}%`} />    
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />    
          <Bar dataKey="avg" name="Avg score" fill="url(#gBar)" radius={[8, 8, 0, 0]} barSize={28} />    
        </BarChart>    
      </ResponsiveContainer>    
    </div>    
  )}    
</GlassCard>    

{/* Attendance Breakdown — by grade (meaningful, not a repeat of the radial) */}    
<GlassCard className="p-6">    
  <SectionTitle title="Attendance Breakdown" subtitle="Today's rate by grade" />    
  {attendanceByGrade.length === 0 ? (    
    <div className="h-56 flex flex-col items-center justify-center text-slate-400">    
      <Activity size={32} className="mb-2 opacity-40" />    
      <p className="text-sm">No attendance recorded today.</p>    
    </div>    
  ) : (    
    <div className="space-y-3 mt-2">    
      {attendanceByGrade.map(g => (    
        <div key={g.grade}>    
          <div className="flex items-center justify-between text-sm mb-1">    
            <span className="text-slate-600 dark:text-slate-300 font-medium">{g.grade}</span>    
            <span className="font-bold text-slate-900 dark:text-white tabular-nums">{g.rate}%</span>    
          </div>    
          <div className="h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">    
            <div    
              className="h-full rounded-full transition-all duration-500"    
              style={{    
                width: `${g.rate}%`,    
                background: g.rate >= 80 ? BRAND.emerald : g.rate >= 60 ? BRAND.amber : BRAND.rose,    
              }}    
            />    
          </div>    
        </div>    
      ))}    
    </div>    
  )}    
</GlassCard>

  </div>    {/* ════════════ ROW 3 — Subject Trend + Events ════════════ */}

   <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">    {/* Subject Performance Trend */}    
        <GlassCard className="lg:col-span-2 p-6">    
  <SectionTitle    
    title="Subject Performance Trend"    
    subtitle="Average score across subjects"    
    action={topSubject ? <Pill tone="up">{topSubject}</Pill> : undefined}    
  />    
  {loadingSubj ? (    
    <div className="h-64 flex items-center justify-center">    
      <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />    
    </div>    
  ) : errorSubj ? (    
    <div className="h-64 flex items-center justify-center text-sm text-rose-500">{errorSubj}</div>    
  ) : subjectData.length === 0 ? (    
    <div className="h-64 flex flex-col items-center justify-center text-slate-400">    
      <BookOpen size={32} className="mb-2 opacity-40" />    
      <p className="text-sm">No marks recorded yet.</p>    
    </div>    
  ) : (    
    <div className="h-64">    
      <ResponsiveContainer width="100%" height="100%">    
        <LineChart data={subjectData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>    
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />    
          <XAxis dataKey="subject" tickLine={false} axisLine={false}    
            tick={{ fill: '#94a3b8', fontSize: 12 }}    
            tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 10) + '…' : v} />    
          <YAxis domain={[0, 100]} tickLine={false} axisLine={false}    
            tick={{ fill: '#94a3b8', fontSize: 12 }}    
            tickFormatter={(v: number) => `${v}%`} />    
          <Tooltip content={<ChartTooltip />} />    
          <Line type="monotone" dataKey="avg" name="Avg score"    
            stroke={BRAND.electric} strokeWidth={3}    
            dot={{ r: 5, fill: '#fff', stroke: BRAND.electric, strokeWidth: 2 }}    
            activeDot={{ r: 7, fill: BRAND.electric }} />    
        </LineChart>    
      </ResponsiveContainer>    
    </div>    
  )}    
</GlassCard>    

{/* Upcoming Events */}    
<GlassCard className="p-6 flex flex-col">    
  <SectionTitle    
    title="Upcoming Events"    
    subtitle="School calendar"    
    action={    
      isAdmin ? (    
        <button onClick={() => { setShowAdd(true); setSaveError(null); }}    
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors">    
          <Plus size={13} /> Add    
        </button>    
      ) : undefined    
    }    
  />    
  {loadingEvents ? (    
    <div className="flex-1 flex items-center justify-center">    
      <div className="w-6 h-6 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />    
    </div>    
  ) : upcoming.length === 0 ? (    
    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-8">    
      <Calendar size={32} className="mb-2 opacity-40" />    
      <p className="text-sm">No upcoming events.</p>    
      {isAdmin && (    
        <button onClick={() => { setShowAdd(true); setSaveError(null); }}    
          className="mt-3 text-xs text-blue-600 hover:underline font-medium">    
          Add one now    
        </button>    
      )}    
    </div>    
  ) : (    
    <div className="space-y-3 flex-1">    
      {upcoming.map(ev => (    
        <div key={ev.id}    
          className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-blue-50/60 dark:hover:bg-white/10 transition-colors group">    
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"    
            style={{ background: `linear-gradient(135deg, ${BRAND.electric}, ${BRAND.cyan})` }}>    
            {new Date(ev.event_date + 'T00:00:00').getDate()}    
          </div>    
          <div className="flex-1 min-w-0">    
            <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{ev.title}</p>    
            <div className="flex items-center gap-2 mt-0.5">    
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${CATEGORY_COLORS[ev.category ?? 'Other'] ?? CATEGORY_COLORS.Other}`}>    
                {ev.category ?? 'Other'}    
              </span>    
              <span className="text-[11px] text-slate-400 flex items-center gap-1">    
                <Clock size={10} /> {daysFromNow(ev.event_date)}    
              </span>    
            </div>    
          </div>    
          {isAdmin && (    
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">    
              <button onClick={() => { setEditTarget(ev); setSaveError(null); }}    
                className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">    
                <Pencil size={13} />    
              </button>    
              <button onClick={() => setDeleteTarget(ev)}    
                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors">    
                <Trash2 size={13} />    
              </button>    
            </div>    
          )}    
        </div>    
      ))}    
    </div>    
  )}    
</GlassCard>

  </div>    
</div>  );
};

export default SchoolDashboard;