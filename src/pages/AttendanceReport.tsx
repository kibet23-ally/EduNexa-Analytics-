import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  BarChart3, Search, ArrowUpRight, TrendingDown, TrendingUp,
  AlertCircle, Edit, Trash2, History, LayoutDashboard, Users,
  CheckCircle2, XCircle, Clock, ShieldCheck, Filter, Sparkles, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { fetchWithProxy, writeWithProxy } from '../lib/fetchProxy';
import { useData } from '../hooks/useData';
import { useAuth } from '../useAuth';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import Letterhead from '../components/Letterhead';

/* ───────── Types ───────── */
interface Grade { id: number; grade_name: string; }
interface Subject { id: number; subject_name: string; }
interface TeacherAssignment { id: number; teacher_id: number; subject_id: number; grade_id: number; }
interface AttendanceProxyItem {
  id: number; student_id: number; date: string; status: string;
  grade_id: number; subject_id: number; remarks?: string;
  students?: { name: string; admission_number: string };
  subjects?: { subject_name: string };
  grades?: { grade_name: string };
}
interface AttendanceRecord {
  id: number; student_id: number; student_name: string; admission_number: string;
  date: string; status: 'present' | 'absent' | 'late' | 'excused';
  remarks?: string; subject_name: string; grade_name: string;
}
interface StudentSummary {
  id: number; name: string; admission_number: string;
  present: number; absent: number; late: number; excused: number;
  total: number; percentage: number;
}

/* ───────── Aurora background ───────── */
const Aurora = () => (
  <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
    <div className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full bg-gradient-to-br from-indigo-500/30 via-sky-400/20 to-transparent blur-3xl animate-pulse" />
    <div className="absolute top-40 -right-20 w-[480px] h-[480px] rounded-full bg-gradient-to-br from-cyan-400/25 via-blue-500/20 to-transparent blur-3xl" />
    <div className="absolute bottom-0 left-1/3 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-violet-500/15 via-fuchsia-400/10 to-transparent blur-3xl" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.05)_1px,transparent_0)] [background-size:24px_24px]" />
  </div>
);

/* ───────── Glass primitives ───────── */
const GlassCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...p }) => (
  <div
    {...p}
    className={cn(
      'relative rounded-3xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-[0_8px_40px_-12px_rgba(15,23,42,0.18)]',
      className,
    )}
  >
    {children}
  </div>
);

const StatPill = ({
  icon: Icon, label, value, tone, hint,
}: {
  icon: React.ElementType; label: string; value: string | number;
  tone: 'indigo' | 'emerald' | 'rose' | 'amber' | 'sky'; hint?: string;
}) => {
  const tones: Record<string, string> = {
    indigo: 'from-indigo-500 to-violet-600 shadow-indigo-500/25',
    emerald: 'from-emerald-500 to-teal-600 shadow-emerald-500/25',
    rose: 'from-rose-500 to-pink-600 shadow-rose-500/25',
    amber: 'from-amber-500 to-orange-500 shadow-amber-500/25',
    sky: 'from-sky-500 to-cyan-500 shadow-sky-500/25',
  };
  return (
    <GlassCard className="p-5 overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-900 tabular-nums tracking-tight">{value}</p>
          {hint && <p className="text-[11px] text-slate-500 mt-1 font-medium">{hint}</p>}
        </div>
        <div className={cn('p-3 rounded-2xl bg-gradient-to-br text-white shadow-lg', tones[tone])}>
          <Icon size={20} />
        </div>
      </div>
    </GlassCard>
  );
};

const STATUS_STYLE: Record<string, { dot: string; chip: string; ring: string; label: string }> = {
  present: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', ring: 'ring-emerald-400', label: 'Present' },
  absent:  { dot: 'bg-rose-500',    chip: 'bg-rose-50 text-rose-700 ring-rose-200',          ring: 'ring-rose-400',    label: 'Absent' },
  late:    { dot: 'bg-amber-500',   chip: 'bg-amber-50 text-amber-700 ring-amber-200',       ring: 'ring-amber-400',   label: 'Late' },
  excused: { dot: 'bg-sky-500',     chip: 'bg-sky-50 text-sky-700 ring-sky-200',             ring: 'ring-sky-400',     label: 'Excused' },
};

const AttendanceReport = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'summary' | 'logs'>('summary');

  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const gradesQuery = useData<Grade>('grades-list-att', 'grades', {
    select: 'id, grade_name', orderBy: { column: 'grade_name', ascending: true },
  }, !!user?.school_id);

  const subjectsQuery = useData<Subject>('subjects-list-att', 'subjects', {
    select: 'id, subject_name', orderBy: { column: 'subject_name', ascending: true },
  }, !!user?.school_id);

  const assignmentsQuery = useData<TeacherAssignment>('assignments-list-att', 'teacher_assignments', {
    filters: { is_active: true },
  }, !!user?.school_id && user.role === 'Teacher');

  const allGrades = useMemo(() => {
    const data = gradesQuery.data || [];
    return [...data].sort((a, b) => {
      const numA = parseInt(a.grade_name.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.grade_name.match(/\d+/)?.[0] || '0');
      if (numA !== numB) return numA - numB;
      return a.grade_name.localeCompare(b.grade_name);
    });
  }, [gradesQuery.data]);

  const assignments = useMemo(() => assignmentsQuery.data || [], [assignmentsQuery.data]);
  const isTeacher = user?.role === 'Teacher';

  const subjects = useMemo(() => {
    const sData = subjectsQuery.data || [];
    if (!isTeacher) return sData;
    const ids = new Set(assignments.map(a => Number(a.subject_id)));
    return sData.filter(s => ids.has(s.id));
  }, [subjectsQuery.data, isTeacher, assignments]);

  const currentGrades = useMemo(() => {
    if (!isTeacher) return allGrades;
    if (assignments.length === 0) return [];
    if (selectedSubject) {
      const subjectId = Number(selectedSubject);
      const ids = assignments.filter(a => Number(a.subject_id) === subjectId).map(a => Number(a.grade_id));
      return allGrades.filter(g => ids.includes(g.id));
    }
    const ids = new Set(assignments.map(a => Number(a.grade_id)));
    return allGrades.filter(g => ids.has(g.id));
  }, [allGrades, assignments, isTeacher, selectedSubject]);

  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubject(subjectId);
    if (isTeacher && subjectId && selectedGrade && assignments.length > 0) {
      const subId = Number(subjectId);
      const ids = assignments.filter(a => Number(a.subject_id) === subId).map(a => Number(a.grade_id));
      if (!ids.includes(Number(selectedGrade))) setSelectedGrade('');
    }
  };

  const fetchAttendance = useCallback(async () => {
    if (!user?.school_id) return;
    if (isTeacher && assignments.length === 0) { setAttendance([]); return; }
    setLoading(true);
    try {
      const filters: Record<string, unknown> = {};
      if (selectedGrade) filters.grade_id = Number(selectedGrade);
      if (selectedSubject) filters.subject_id = Number(selectedSubject);

      const result = await fetchWithProxy('attendance', {
        select: '*, students:student_id(name, admission_number), subjects:subject_id(subject_name), grades:grade_id(grade_name)',
        filters,
      });
      let filteredData = result.data || [];

      if (isTeacher) {
        const ag = new Set(assignments.map(a => Number(a.grade_id)));
        const as_ = new Set(assignments.map(a => Number(a.subject_id)));
        filteredData = filteredData.filter((r: AttendanceProxyItem) =>
          ag.has(Number(r.grade_id)) && as_.has(Number(r.subject_id)),
        );
      }
      if (startDate || endDate) {
        filteredData = (filteredData as { date: string }[]).filter((r) => {
          if (startDate && r.date < startDate) return false;
          if (endDate && r.date > endDate) return false;
          return true;
        });
      }
      const processed: AttendanceRecord[] = (filteredData as AttendanceProxyItem[]).map((i) => ({
        id: i.id,
        student_id: i.student_id,
        student_name: i.students?.name || 'Unknown',
        admission_number: i.students?.admission_number || 'N/A',
        date: i.date,
        status: i.status as AttendanceRecord['status'],
        remarks: i.remarks || '',
        subject_name: i.subjects?.subject_name || 'N/A',
        grade_name: i.grades?.grade_name || 'N/A',
      }));
      setAttendance(processed);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load attendance records.';
      if (!attendance.length) setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedGrade, selectedSubject, startDate, endDate, isTeacher, assignments, user?.school_id, attendance.length]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setActionLoading(true);
    try {
      await writeWithProxy('attendance', 'update',
        { status: editingRecord.status, remarks: editingRecord.remarks },
        { id: editingRecord.id });
      setFeedback({ type: 'success', message: 'Attendance record updated' });
      setEditingRecord(null);
      fetchAttendance();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Update failed' });
    } finally {
      setActionLoading(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setActionLoading(true);
    try {
      await writeWithProxy('attendance', 'delete', null, { id: deletingId });
      setFeedback({ type: 'success', message: 'Record deleted successfully' });
      setDeletingId(null);
      fetchAttendance();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Delete failed' });
    } finally {
      setActionLoading(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  /* ───────── Derived data ───────── */
  const studentSummaries: StudentSummary[] = useMemo(() => {
    const map = new Map<number, StudentSummary>();
    attendance.forEach(r => {
      if (!map.has(r.student_id)) {
        map.set(r.student_id, {
          id: r.student_id, name: r.student_name, admission_number: r.admission_number,
          present: 0, absent: 0, late: 0, excused: 0, total: 0, percentage: 0,
        });
      }
      const s = map.get(r.student_id)!;
      s.total += 1; s[r.status] += 1;
    });
    return Array.from(map.values())
      .map(s => ({ ...s, percentage: s.total > 0 ? (s.present / s.total) * 100 : 0 }))
      .filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.admission_number.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.percentage - a.percentage);
  }, [attendance, searchTerm]);

  const totals = useMemo(() => ({
    present: studentSummaries.reduce((a, s) => a + s.present, 0),
    absent:  studentSummaries.reduce((a, s) => a + s.absent, 0),
    late:    studentSummaries.reduce((a, s) => a + s.late, 0),
    excused: studentSummaries.reduce((a, s) => a + s.excused, 0),
  }), [studentSummaries]);

  const totalSessions = totals.present + totals.absent + totals.late + totals.excused;
  const overallRate = totalSessions ? (totals.present / totalSessions) * 100 : 0;
  const atRisk = studentSummaries.filter(s => s.percentage < 80).length;

  const chartData = [
    { name: 'Present', value: totals.present, color: '#10b981' },
    { name: 'Absent',  value: totals.absent,  color: '#f43f5e' },
    { name: 'Late',    value: totals.late,    color: '#f59e0b' },
    { name: 'Excused', value: totals.excused, color: '#0ea5e9' },
  ].filter(d => d.value > 0);

  /* Trend: last 14 distinct dates */
  const trendData = useMemo(() => {
    const byDate = new Map<string, { date: string; present: number; absent: number; late: number; excused: number }>();
    attendance.forEach(r => {
      if (!byDate.has(r.date)) byDate.set(r.date, { date: r.date, present: 0, absent: 0, late: 0, excused: 0 });
      byDate.get(r.date)![r.status] += 1;
    });
    return Array.from(byDate.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14)
      .map(d => ({
        ...d,
        label: new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      }));
  }, [attendance]);

  const exportCSV = () => {
    const rows = [
      ['Date', 'Admission No', 'Student', 'Grade', 'Subject', 'Status', 'Remarks'],
      ...attendance.map(r => [r.date, r.admission_number, r.student_name, r.grade_name, r.subject_name, r.status, r.remarks || '']),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `attendance-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="relative min-h-screen">
      <Aurora />

      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <Letterhead />

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-end justify-between gap-6"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 backdrop-blur-md border border-white/60 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
              <Sparkles size={12} className="text-indigo-500" /> Attendance Intelligence
            </div>
            <h1 className="mt-4 text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-700 bg-clip-text text-transparent">
              Attendance Report
            </h1>
            <p className="text-slate-500 mt-2 font-medium max-w-xl">
              Track engagement, surface at-risk students and audit attendance trends across grades and subjects.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-white/70 backdrop-blur-md p-1 rounded-2xl border border-white/60 shadow-sm">
              {([
                { id: 'summary', label: 'Summary', icon: LayoutDashboard },
                { id: 'logs', label: 'Raw Logs', icon: History },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setViewMode(t.id)}
                  className={cn(
                    'px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] flex items-center gap-2 transition-all',
                    viewMode === t.id
                      ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30'
                      : 'text-slate-500 hover:text-slate-800',
                  )}
                >
                  <t.icon size={13} /> {t.label}
                </button>
              ))}
            </div>
            <button
              onClick={exportCSV}
              className="px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] bg-white/70 backdrop-blur-md border border-white/60 text-slate-700 hover:bg-white flex items-center gap-2 shadow-sm transition-all"
            >
              <Download size={14} /> Export
            </button>
          </div>
        </motion.header>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatPill icon={Users} label="Students" value={studentSummaries.length} tone="indigo" hint="In current filter" />
          <StatPill icon={CheckCircle2} label="Present" value={totals.present} tone="emerald" />
          <StatPill icon={XCircle} label="Absent" value={totals.absent} tone="rose" />
          <StatPill icon={Clock} label="Late" value={totals.late} tone="amber" />
          <StatPill icon={ShieldCheck} label="Attendance Rate" value={`${overallRate.toFixed(1)}%`} tone="sky" hint={`${atRisk} below 80%`} />
        </div>

        {/* Toast */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className={cn(
                'fixed top-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border',
                feedback.type === 'success'
                  ? 'bg-emerald-500/90 text-white border-emerald-300/50'
                  : 'bg-rose-500/90 text-white border-rose-300/50',
              )}
            >
              {feedback.type === 'success' ? <TrendingUp size={18} /> : <AlertCircle size={18} />}
              <span className="text-sm font-bold uppercase tracking-wider">{feedback.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <GlassCard className="p-6">
          {error && (
            <div className="mb-5 p-4 bg-rose-50/80 border border-rose-200 rounded-2xl flex items-start gap-3">
              <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-rose-900 font-bold text-sm">Action required</p>
                <p className="text-rose-700 text-xs">{error}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
              <Filter size={14} />
            </div>
            <h3 className="text-sm font-black uppercase tracking-[0.15em] text-slate-700">Filters</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {[
              { label: 'Subject', el: (
                <select value={selectedSubject} onChange={e => handleSubjectChange(e.target.value)}
                  className="w-full bg-white/70 border border-white/80 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300 outline-none transition-all">
                  <option value="">All Subjects</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                </select>
              )},
              { label: 'Grade', el: (
                <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}
                  className="w-full bg-white/70 border border-white/80 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300 outline-none transition-all">
                  <option value="">All Grades</option>
                  {currentGrades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
                </select>
              )},
              { label: 'From', el: (
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-white/70 border border-white/80 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300 outline-none transition-all"/>
              )},
              { label: 'To', el: (
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-white/70 border border-white/80 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300 outline-none transition-all"/>
              )},
            ].map((f, i) => (
              <div key={i} className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.18em]">{f.label}</label>
                {f.el}
              </div>
            ))}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.18em]">Search</label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Name or admission…"
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white/70 border border-white/80 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300 outline-none transition-all"/>
              </div>
            </div>

            <div className="space-y-2 flex flex-col">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.18em]">Reset</label>
              <button
                onClick={() => { setSelectedGrade(''); setSelectedSubject(''); setStartDate(''); setEndDate(''); setSearchTerm(''); }}
                className="w-full h-[46px] rounded-xl text-[11px] font-black uppercase tracking-[0.15em] bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-md"
              >
                Clear filters
              </button>
            </div>
          </div>
        </GlassCard>

        {/* Main grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* LEFT: data table */}
           <div className="xl:col-span-2 space-y-6">
            <GlassCard className="overflow-hidden">
              <div className="p-6 border-b border-white/60 flex items-center justify-between bg-gradient-to-r from-white/40 to-transparent">
                <h3 className="font-black text-slate-900 text-lg flex items-center gap-3 tracking-tight">
                  {viewMode === 'summary'
                    ? <><BarChart3 className="text-indigo-600" size={22} /> Class Performance</>
                    : <><History className="text-indigo-600" size={22} /> Raw Attendance Logs</>}
                </h3>
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.18em] px-3 py-1.5 rounded-full bg-white/70 border border-white/80">
                  {viewMode === 'summary' ? studentSummaries.length : attendance.length} items
                </span>
              </div>

              <div className="relative min-h-[420px] overflow-x-auto">
                {loading && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                    <div className="animate-spin w-10 h-10 border-[3px] border-indigo-600 border-t-transparent rounded-full mb-3" />
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.18em]">Refreshing…</p>
                  </div>
                )}

                {viewMode === 'summary' ? (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/60 backdrop-blur-sm">
                        {['Student', 'Sessions', 'Attendance', 'Status'].map(h => (
                          <th key={h} className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {studentSummaries.map((s, idx) => (
                          <motion.tr
                            key={s.id}
                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                            className="border-t border-slate-100/60 hover:bg-white/60 transition-colors"
                          >
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  'w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white shadow-lg',
                                  s.percentage >= 95 ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30' :
                                  s.percentage >= 80 ? 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/30' :
                                  'bg-gradient-to-br from-rose-500 to-pink-600 shadow-rose-500/30',
                                )}>
                                  {s.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900">{s.name}</p>
                                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{s.admission_number}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex flex-wrap gap-1.5">
                                {(['present', 'absent', 'late', 'excused'] as const).map(k => s[k] > 0 && (
                                  <span key={k} className={cn(
                                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black ring-1',
                                    STATUS_STYLE[k].chip,
                                  )}>
                                    <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_STYLE[k].dot)} />
                                    {s[k]}
                                  </span>
                                ))}
                                <span className="text-[10px] font-bold text-slate-400 ml-1">of {s.total}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 max-w-[160px] h-2 rounded-full bg-slate-100 overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }} animate={{ width: `${s.percentage}%` }}
                                    transition={{ duration: 0.9, ease: 'easeOut' }}
                                    className={cn(
                                      'h-full rounded-full',
                                      s.percentage >= 95 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' :
                                      s.percentage >= 80 ? 'bg-gradient-to-r from-indigo-500 to-violet-500' :
                                      'bg-gradient-to-r from-rose-500 to-pink-500',
                                    )}
                                  />
                                </div>
                                <span className={cn(
                                  'text-sm font-black tabular-nums',
                                  s.percentage < 80 ? 'text-rose-600' : 'text-slate-900',
                                )}>
                                  {s.percentage.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              {s.percentage < 80 ? (
                                <div className="inline-flex items-center gap-1.5 text-rose-700 bg-rose-50 ring-1 ring-rose-200 px-3 py-1 rounded-full">
                                  <TrendingDown size={12} />
                                  <span className="text-[10px] font-black uppercase tracking-wider">At Risk</span>
                                </div>
                              ) : s.percentage >= 95 ? (
                                <div className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 px-3 py-1 rounded-full">
                                  <TrendingUp size={12} />
                                  <span className="text-[10px] font-black uppercase tracking-wider">Exemplary</span>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 text-indigo-700 bg-indigo-50 ring-1 ring-indigo-200 px-3 py-1 rounded-full">
                                  <CheckCircle2 size={12} />
                                  <span className="text-[10px] font-black uppercase tracking-wider">Engaged</span>
                                </div>
                              )}
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/60 backdrop-blur-sm">
                        {['Date / Student', 'Context', 'Status', 'Actions'].map((h, i) => (
                          <th key={h} className={cn(
                            'px-6 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500',
                            i === 3 && 'text-right',
                          )}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {attendance
                        .filter(r =>
                          r.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.admission_number.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((r, idx) => {
                          const st = STATUS_STYLE[r.status];
                          return (
                            <motion.tr
                              key={r.id}
                              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: Math.min(idx * 0.015, 0.2) }}
                              className="border-t border-slate-100/60 hover:bg-white/60 transition-colors"
                            >
                              <td className="px-6 py-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                  {new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                                <p className="font-bold text-slate-900 mt-1">{r.student_name}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{r.admission_number}</p>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-sm font-bold text-slate-700">{r.subject_name}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{r.grade_name}</p>
                              </td>
                              <td className="px-6 py-4">
                                <div className={cn(
                                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full ring-1 text-[10px] font-black uppercase tracking-wider',
                                  st.chip,
                                )}>
                                  <span className={cn('w-1.5 h-1.5 rounded-full', st.dot)} />
                                  {st.label}
                                </div>
                                {r.remarks && (
                                  <p className="text-[11px] text-slate-500 mt-1 italic truncate max-w-[180px]">"{r.remarks}"</p>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => setEditingRecord(r)}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                                    <Edit size={16} />
                                  </button>
                                  <button onClick={() => setDeletingId(r.id)}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                    </tbody>
                  </table>
                )}

                {((viewMode === 'summary' && studentSummaries.length === 0) ||
                  (viewMode === 'logs' && attendance.length === 0)) && !loading && (
                  <div className="p-20 text-center">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                      <BarChart3 className="text-slate-400" size={26} />
                    </div>
                    <p className="text-slate-500 font-bold uppercase tracking-[0.18em] text-xs">No records for current filters</p>
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Trend chart */}
            {trendData.length > 0 && (
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-slate-900 text-lg flex items-center gap-3 tracking-tight">
                    <TrendingUp className="text-indigo-600" size={20} />
                    Attendance Trend
                  </h3>
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.18em]">
                    Last {trendData.length} days
                  </span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(255,255,255,0.95)', border: '1px solid #e2e8f0',
                          borderRadius: 12, fontSize: 12, fontWeight: 700,
                          boxShadow: '0 10px 30px -10px rgba(15,23,42,0.2)',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                      <Bar dataKey="present" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="late"    stackId="a" fill="#f59e0b" />
                      <Bar dataKey="excused" stackId="a" fill="#0ea5e9" />
                      <Bar dataKey="absent"  stackId="a" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            )}
          </div>

          {/* RIGHT: Sidebar */}
          <div className="space-y-6">
            {/* Distribution donut */}
            <GlassCard className="p-6">
              <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-[0.18em] mb-4">Distribution</h4>
              <div className="w-full h-52">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none">
                        {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(255,255,255,0.95)', border: '1px solid #e2e8f0',
                          borderRadius: 12, fontSize: 12, fontWeight: 700,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                    <BarChart3 size={36} className="mb-2 opacity-50" />
                    <p className="text-[10px] font-bold uppercase tracking-wider">No data</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-5">
                {chartData.map(d => (
                  <div key={d.name} className="flex items-center justify-between p-2.5 rounded-xl bg-white/60 border border-white/80">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider">{d.name}</span>
                    </div>
                    <span className="text-xs font-black text-slate-900 tabular-nums">{d.value}</span>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Compliance alert */}
            <GlassCard className="p-6 bg-gradient-to-br from-rose-50/80 to-orange-50/80 border-rose-200/60">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/25 shrink-0">
                  <AlertCircle size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-rose-900 uppercase tracking-[0.15em]">Compliance Alert</h4>
                  <p className="text-xs font-medium text-rose-800/90 mt-2 leading-relaxed">
                    <span className="font-black text-rose-900">{atRisk}</span> student{atRisk === 1 ? '' : 's'} currently below
                    the 80% attendance threshold. Parental notification recommended.
                  </p>
                </div>
              </div>
            </GlassCard>

            {/* Export card */}
            <GlassCard className="p-6 overflow-hidden relative bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white border-white/20">
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
              <div className="relative z-10">
                <Sparkles size={20} className="text-white/80 mb-3" />
                <h4 className="font-black text-xl tracking-tight">Export this report</h4>
                <p className="text-white/70 text-xs font-medium mt-1 leading-relaxed">
                  Download the current selection as a CSV file for archives or follow-up.
                </p>
                <button onClick={exportCSV}
                  className="mt-5 inline-flex items-center gap-2 bg-white text-indigo-700 px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-[0.15em] hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg">
                  Download CSV <ArrowUpRight size={14} />
                </button>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingRecord && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            onClick={() => setEditingRecord(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/60"
            >
              <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-50/60 to-violet-50/60">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">Edit Attendance</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">{editingRecord.student_name}</h3>
                <p className="text-xs font-bold text-slate-500 mt-1">
                  {editingRecord.subject_name} • {editingRecord.grade_name} •{' '}
                  {new Date(editingRecord.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>

              <form onSubmit={handleUpdate} className="p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.18em]">Status</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(['present', 'absent', 'late', 'excused'] as const).map(s => {
                      const st = STATUS_STYLE[s];
                      const active = editingRecord.status === s;
                      return (
                        <button key={s} type="button"
                          onClick={() => setEditingRecord({ ...editingRecord, status: s })}
                          className={cn(
                            'px-4 py-3 rounded-xl text-xs font-black uppercase tracking-[0.15em] border-2 transition-all flex items-center justify-center gap-2',
                            active ? `border-current ${st.chip} shadow-md` : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                          )}
                        >
                          <span className={cn('w-2 h-2 rounded-full', st.dot)} />
                          {st.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.18em]">Remarks</label>
                  <textarea
                    value={editingRecord.remarks || ''}
                    onChange={e => setEditingRecord({ ...editingRecord, remarks: e.target.value })}
                    placeholder="Optional notes or reason…" rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300 outline-none resize-none transition-all"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditingRecord(null)}
                    className="flex-1 px-6 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] text-slate-500 hover:bg-slate-100 transition-all">
                    Cancel
                  </button>
                  <button type="submit" disabled={actionLoading}
                    className="flex-1 px-6 py-3.5 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] shadow-lg shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50">
                    {actionLoading ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {deletingId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            onClick={() => setDeletingId(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-white/60"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-rose-500/30">
                  <Trash2 className="text-white" size={28} />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Delete record?</h3>
                <p className="text-slate-500 text-sm font-medium mt-2">
                  This attendance entry will be permanently removed. This action cannot be undone.
                </p>

                <div className="flex flex-col gap-2.5 mt-7">
                  <button onClick={handleDelete} disabled={actionLoading}
                    className="w-full px-6 py-3.5 bg-gradient-to-br from-rose-500 to-pink-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.15em] shadow-lg shadow-rose-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50">
                    {actionLoading ? 'Deleting…' : 'Yes, delete record'}
                  </button>
                  <button onClick={() => setDeletingId(null)}
                    className="w-full px-6 py-3.5 text-slate-500 font-black text-[11px] uppercase tracking-[0.15em] hover:bg-slate-100 rounded-2xl transition-all">
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AttendanceReport;
