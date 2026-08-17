import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  ChevronLeft,
  ChevronRight,
  Calendar,
  BookOpen,
  Users,
  Search,
  Save,
  TrendingUp,
  UserCheck,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useSubscription } from '../useSubscription';
import { useAuth } from '../useAuth';
import { useData, useDataMutation } from '../hooks/useData';
import { Grade, Subject, Student, TeacherAssignment } from '../types';
import { TableSkeleton } from '../components/ui/Skeleton';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

const PAGE_SIZE = 50;

/* ─────────────────────────── Premium Primitives ─────────────────────────── */

const Aurora = () => (
  <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
    <div className="absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,theme(colors.indigo.400/.35),transparent_70%)] blur-3xl" />
    <div className="absolute top-1/3 -right-32 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,theme(colors.cyan.400/.30),transparent_70%)] blur-3xl" />
    <div className="absolute bottom-0 left-1/4 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,theme(colors.fuchsia.400/.22),transparent_70%)] blur-3xl" />
  </div>
);

const GlassCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div
    className={cn(
      'relative rounded-3xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-[0_8px_40px_-12px_rgba(30,41,99,0.18)]',
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

const StatPill: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky';
}> = ({ icon: Icon, label, value, tone }) => {
  const tones: Record<string, string> = {
    indigo: 'from-indigo-500 to-violet-500',
    emerald: 'from-emerald-500 to-teal-500',
    amber: 'from-amber-500 to-orange-500',
    rose: 'from-rose-500 to-pink-500',
    sky: 'from-sky-500 to-cyan-500',
  };
  return (
    <GlassCard className="px-5 py-4 flex items-center gap-4">
      <div
        className={cn(
          'h-11 w-11 rounded-2xl bg-gradient-to-br grid place-items-center text-white shadow-lg',
          tones[tone],
        )}
      >
        <Icon size={20} strokeWidth={2.2} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
        <p className="text-2xl font-bold text-slate-900 tabular-nums leading-tight">{value}</p>
      </div>
    </GlassCard>
  );
};

const Field: React.FC<{
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}> = ({ label, icon: Icon, children }) => (
  <div className="space-y-1.5">
    <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
      <Icon size={11} /> {label}
    </label>
    {children}
  </div>
);

const STATUS_META: Record<
  AttendanceStatus,
  { label: string; icon: React.ElementType; active: string; idle: string; dot: string }
> = {
  present: {
    label: 'Present',
    icon: CheckCircle2,
    active: 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 border-transparent',
    idle: 'bg-white/60 text-emerald-700 border-emerald-200 hover:bg-emerald-50',
    dot: 'bg-emerald-500',
  },
  absent: {
    label: 'Absent',
    icon: XCircle,
    active: 'bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30 border-transparent',
    idle: 'bg-white/60 text-rose-700 border-rose-200 hover:bg-rose-50',
    dot: 'bg-rose-500',
  },
  late: {
    label: 'Late',
    icon: Clock,
    active: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 border-transparent',
    idle: 'bg-white/60 text-amber-700 border-amber-200 hover:bg-amber-50',
    dot: 'bg-amber-500',
  },
  excused: {
    label: 'Excused',
    icon: FileText,
    active: 'bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-500/30 border-transparent',
    idle: 'bg-white/60 text-sky-700 border-sky-200 hover:bg-sky-50',
    dot: 'bg-sky-500',
  },
};

const StatusButton: React.FC<{
  status: AttendanceStatus;
  active: boolean;
  onClick: () => void;
}> = ({ status, active, onClick }) => {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all duration-200',
        active ? meta.active : meta.idle,
      )}
    >
      <Icon size={13} strokeWidth={2.4} />
      <span className="hidden sm:inline">{meta.label}</span>
    </button>
  );
};

/* ───────────────────────────────── Page ─────────────────────────────────── */

const Attendance = () => {
  const { user } = useAuth();
  const { isReadOnly } = useSubscription();

  const [page, setPage] = useState(0);
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [attendanceData, setAttendanceData] = useState<
    Record<number, { student_id: number; status: AttendanceStatus; remarks: string }>
  >({});

  const attendanceMutation = useDataMutation('attendance');
  const lessonReportMutation = useDataMutation('lesson_absence_reports');

  const isAdmin = user?.role === 'Admin' || user?.role === 'Principal' || user?.role === 'SuperAdmin';
  const isTeacherRole = user?.role === 'Teacher';

  // Every grade in the school (admins can take attendance for any class).
  const gradesQuery = useData<Grade>(
    'grades-all',
    'grades',
    { select: 'id, grade_name, class_teacher_id', orderBy: { column: 'grade_name', ascending: true } },
    !!user?.school_id,
  );
  const allGrades = useMemo(() => gradesQuery.data || [], [gradesQuery.data]);

  const sortFn = (a: Grade, b: Grade) => {
    const numA = parseInt(a.grade_name.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.grade_name.match(/\d+/)?.[0] || '0');
    if (numA !== numB) return numA - numB;
    return a.grade_name.localeCompare(b.grade_name);
  };

  // The class(es) this teacher is the official Class Teacher of — the
  // official daily-attendance workflow (Select Class → Date → Mark → Save)
  // is scoped to exactly these, per the "class teacher is primary" model.
  const myClassGrades = useMemo(
    () => (isTeacherRole ? allGrades.filter(g => g.class_teacher_id === user?.id) : []),
    [allGrades, isTeacherRole, user?.id],
  );

  // Admins can take/view official attendance for any class; a Class
  // Teacher only for their own; a plain subject teacher (no class
  // assignment) doesn't get the official marking grid at all — see
  // `canTakeOfficialAttendance` below.
  const availableGrades = useMemo(
    () => [...(isAdmin ? allGrades : myClassGrades)].sort(sortFn),
    [isAdmin, allGrades, myClassGrades],
  );

  const canTakeOfficialAttendance = isAdmin || myClassGrades.length > 0;

  // Subject teachers who are NOT a class teacher of anything still get a
  // subject list, for the lightweight "report a lesson absence" flow
  // (never writes to the official attendance table).
  const subjectsQuery = useData<Subject>(
    'subjects-all', 'subjects', { select: 'id, subject_name' },
    !!user?.school_id && isTeacherRole && myClassGrades.length === 0,
  );
  const assignmentsQuery = useData<TeacherAssignment>(
    'teacher-assignments-active', 'teacher_assignments',
    { select: '*, grades(grade_name), subjects(subject_name)', filters: { is_active: true } },
    !!user?.school_id && isTeacherRole && myClassGrades.length === 0,
  );
  const assignments = useMemo(() => assignmentsQuery.data || [], [assignmentsQuery.data]);
  const [reportSubject, setReportSubject] = useState('');
  const [reportGrade, setReportGrade] = useState('');
  const [reportStudent, setReportStudent] = useState('');
  const [reportRemarks, setReportRemarks] = useState('');

  // Auto-select the single class for a one-class Class Teacher.
  useEffect(() => {
    if (!selectedGrade && myClassGrades.length === 1) {
      setSelectedGrade(String(myClassGrades[0].id));
    }
  }, [myClassGrades, selectedGrade]);

  const studentsQuery = useData<Student>(
    'students-attendance',
    'students',
    {
      select: 'id, name, admission_number, grade_id',
      filters: selectedGrade ? { grade_id: Number(selectedGrade) } : undefined,
      range: { from: page * PAGE_SIZE, to: (page + 1) * PAGE_SIZE - 1 },
    },
    !!user?.school_id && !!selectedGrade,
  );

  const students = useMemo(
    () => (studentsQuery.data || []) as Student[],
    [studentsQuery.data],
  );

  // Existing official attendance already saved for this class + date, so
  // re-opening a date to edit shows real statuses instead of resetting
  // everyone back to Present.
  const existingQuery = useData<{ student_id: number; status: AttendanceStatus; remarks: string | null; subject_id: number | null }>(
    'attendance-existing',
    'attendance',
    { select: 'student_id, status, remarks, subject_id', filters: { grade_id: selectedGrade ? Number(selectedGrade) : undefined, date: selectedDate } },
    !!user?.school_id && !!selectedGrade && !!selectedDate,
  );
  const existingByStudent = useMemo(() => {
    const map: Record<number, { status: AttendanceStatus; remarks: string }> = {};
    (existingQuery.data || []).forEach(r => {
      if (r.subject_id === null || r.subject_id === undefined) {
        map[r.student_id] = { status: r.status, remarks: r.remarks || '' };
      }
    });
    return map;
  }, [existingQuery.data]);

  const lastKeyRef = useRef<string>('');
  useEffect(() => {
    const key = students.map((s) => s.id).join(',') + '|' + selectedDate + '|' + JSON.stringify(existingByStudent);
    if (students.length > 0 && key !== lastKeyRef.current) {
      const initial: typeof attendanceData = {};
      students.forEach((s) => {
        const existing = existingByStudent[s.id];
        initial[s.id] = existing
          ? { student_id: s.id, status: existing.status, remarks: existing.remarks }
          : { student_id: s.id, status: 'present', remarks: '' };
      });
      setAttendanceData(initial);
      lastKeyRef.current = key;
    }
  }, [students, existingByStudent, selectedDate]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const filteredStudents = useMemo(() => {
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.admission_number.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [students, searchTerm]);

  /* live tallies */
  const tallies = useMemo(() => {
    const t = { present: 0, absent: 0, late: 0, excused: 0 };
    Object.values(attendanceData).forEach((r) => {
      t[r.status]++;
    });
    const total = students.length || 0;
    const rate = total ? Math.round((t.present / total) * 100) : 0;
    return { ...t, total, rate };
  }, [attendanceData, students]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!selectedGrade) {
      setToast({ kind: 'err', text: 'Select a class first.' });
      return;
    }
    try {
      const payload = Object.values(attendanceData).map((record) => ({
        ...record,
        grade_id: Number(selectedGrade),
        subject_id: null,
        date: selectedDate,
        school_id: user?.school_id,
        teacher_id: user?.id,
      }));
      await attendanceMutation.mutateAsync({
        operation: 'upsert',
        payload,
        onConflict: 'school_id,student_id,date,subject_key',
      });
      setToast({ kind: 'ok', text: `Attendance saved for ${payload.length} students.` });
    } catch (err: unknown) {
      const error = err as Error;
      setToast({ kind: 'err', text: 'Failed: ' + error.message });
    }
  };

  const handleReportAbsence = async () => {
    if (!reportGrade || !reportSubject || !reportStudent) {
      setToast({ kind: 'err', text: 'Select class, subject and student first.' });
      return;
    }
    try {
      await lessonReportMutation.mutateAsync({
        operation: 'insert',
        payload: {
          school_id: user?.school_id,
          grade_id: Number(reportGrade),
          subject_id: Number(reportSubject),
          student_id: Number(reportStudent),
          reported_by: user?.id,
          report_date: selectedDate,
          remarks: reportRemarks || null,
        },
      });
      setToast({ kind: 'ok', text: 'Lesson absence reported to the class teacher.' });
      setReportStudent(''); setReportRemarks('');
    } catch (err: unknown) {
      const error = err as Error;
      setToast({ kind: 'err', text: 'Failed: ' + error.message });
    }
  };

  const markAll = (status: AttendanceStatus) => {
    setAttendanceData((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        next[s.id] = { ...(next[s.id] || { student_id: s.id, remarks: '' }), status };
      });
      return next;
    });
  };

  // Plain subject teacher, not a class teacher of any grade: show the
  // lightweight "report a lesson absence" view instead of the official
  // marking grid — they're not required (or permitted) to take daily
  // attendance themselves.
  if (!canTakeOfficialAttendance) {
    const reportGrades = [...new Set(assignments.map(a => a.grade_id))]
      .map(id => allGrades.find(g => g.id === id)).filter(Boolean) as Grade[];
    const reportSubjects = (subjectsQuery.data || []).filter(s =>
      assignments.some(a => a.subject_id === s.id && (!reportGrade || a.grade_id === Number(reportGrade))));
    const reportStudentsQuery = students; // reuse below via effect-free simple fetch is overkill; keep minimal

    return (
      <div className="relative min-h-screen text-slate-900">
        <Aurora />
        <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-6">
          <div className="rounded-[2rem] border border-white/60 bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 text-white p-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
              <Sparkles size={12} /> Lesson Absence
            </div>
            <h1 className="mt-3 text-2xl md:text-3xl font-bold">Report a Lesson Absence</h1>
            <p className="mt-1.5 text-sm text-indigo-200 max-w-lg">
              Daily official attendance is taken by each class's Class Teacher. You can still
              flag a student who missed your lesson — this doesn't create a duplicate attendance record.
            </p>
          </div>
          <GlassCard className="p-6 space-y-5">
            <Field label="Class" icon={UserCheck}>
              <select value={reportGrade} onChange={e => { setReportGrade(e.target.value); setReportStudent(''); }}
                className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 outline-none">
                <option value="">Select class</option>
                {reportGrades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
              </select>
            </Field>
            <Field label="Subject" icon={BookOpen}>
              <select value={reportSubject} onChange={e => setReportSubject(e.target.value)}
                className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 outline-none">
                <option value="">Select subject</option>
                {reportSubjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
              </select>
            </Field>
            <Field label="Student Admission No." icon={Search}>
              <input type="text" value={reportStudent} onChange={e => setReportStudent(e.target.value)}
                placeholder="Enter the student's numeric ID"
                className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 outline-none" />
            </Field>
            <Field label="Remarks (optional)" icon={FileText}>
              <input type="text" value={reportRemarks} onChange={e => setReportRemarks(e.target.value)}
                className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 outline-none" />
            </Field>
            <button onClick={handleReportAbsence} disabled={lessonReportMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 text-indigo-950 text-sm font-bold shadow-lg disabled:opacity-50">
              <Save size={16} /> {lessonReportMutation.isPending ? 'Sending…' : 'Report Absence'}
            </button>
          </GlassCard>
          {toast && (
            <div className={cn('rounded-xl px-4 py-3 text-sm font-semibold', toast.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
              {toast.text}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ─────────────────────────────── render ─────────────────────────────── */
  return (
    <div className="relative min-h-screen text-slate-900">
      <Aurora />

      <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-8">
        {/* Hero */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 text-white shadow-[0_30px_80px_-30px_rgba(49,46,129,0.6)]"
        >
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-cyan-400/30 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />
          <div className="relative p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
                <Sparkles size={12} /> Attendance Console
              </div>
              <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
                Daily Register
              </h1>
              <p className="mt-1.5 text-sm text-indigo-200 max-w-lg">
                Capture presence, lateness and excused absences with precision. Auto-synced
                to your school analytics in real-time.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => markAll('present')}
                disabled={!students.length || isReadOnly}
                className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-xs font-bold uppercase tracking-wider hover:bg-white/20 transition disabled:opacity-40"
              >
                Mark all present
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  attendanceMutation.isPending ||
                  isReadOnly ||
                  !selectedGrade
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 text-indigo-950 text-sm font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-400/50 transition disabled:opacity-50"
              >
                <Save size={16} />
                {attendanceMutation.isPending ? 'Saving…' : 'Submit Attendance'}
              </button>
            </div>
          </div>
        </motion.header>

        {/* Stat strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatPill icon={Users} label="Roster" value={tallies.total} tone="indigo" />
          <StatPill icon={CheckCircle2} label="Present" value={tallies.present} tone="emerald" />
          <StatPill icon={XCircle} label="Absent" value={tallies.absent} tone="rose" />
          <StatPill icon={Clock} label="Late" value={tallies.late} tone="amber" />
          <StatPill icon={TrendingUp} label="Rate" value={`${tallies.rate}%`} tone="sky" />
        </div>

        {/* Controls */}
        <GlassCard className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Field label={isAdmin ? 'Class' : 'Your Class'} icon={UserCheck}>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
              >
                <option value="">Select Class</option>
                {availableGrades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.grade_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date" icon={Calendar}>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-white/70 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
              />
            </Field>
            <Field label="Search" icon={Search}>
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/70 border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
                  placeholder="Find by name or admission no…"
                />
              </div>
            </Field>
          </div>

          {/* Completion bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
              <span className="uppercase tracking-[0.14em]">Attendance Rate</span>
              <span className="tabular-nums text-slate-900">{tallies.rate}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${tallies.rate}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-emerald-400 via-teal-500 to-sky-500"
              />
            </div>
          </div>
        </GlassCard>

        {/* Roster table */}
        <GlassCard className="overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white/40">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Student Register</h3>
              <p className="text-xs text-slate-500">
                {filteredStudents.length} of {students.length} shown · Page {page + 1}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="h-8 w-8 grid place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={students.length < PAGE_SIZE}
                className="h-8 w-8 grid place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {studentsQuery.isLoading ? (
             <div className="p-10">
              <TableSkeleton rows={10} cols={3} />
            </div>
          ) : !selectedGrade ? (
            <div className="p-16 text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-indigo-50 grid place-items-center text-indigo-500 mb-4">
                <Users size={22} />
              </div>
              <p className="font-bold text-slate-700">Pick a subject and grade</p>
              <p className="text-sm text-slate-500 mt-1">
                Your roster will appear here once filters are set.
              </p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-16 text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-amber-50 grid place-items-center text-amber-500 mb-4">
                <AlertCircle size={22} />
              </div>
              <p className="font-bold text-slate-700">No students match this filter</p>
              <p className="text-sm text-slate-500 mt-1">Try clearing the search box.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-100">
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                      Student
                    </th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 text-center">
                      Status
                    </th>
                    <th className="px-6 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                      Remarks
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredStudents.map((student, idx) => {
                    const current = attendanceData[student.id]?.status || 'present';
                    const meta = STATUS_META[current];
                    const initials = student.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();
                    return (
                      <motion.tr
                        key={student.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.015, 0.25) }}
                        className="hover:bg-indigo-50/30 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white grid place-items-center font-bold text-xs shadow-md">
                              {initials}
                              <span
                                className={cn(
                                  'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white',
                                  meta.dot,
                                )}
                              />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 leading-tight">
                                {student.name}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                                {student.admission_number}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {(['present', 'absent', 'late', 'excused'] as AttendanceStatus[]).map(
                              (status) => (
                                <StatusButton
                                  key={status}
                                  status={status}
                                  active={current === status}
                                  onClick={() =>
                                    setAttendanceData((p) => ({
                                      ...p,
                                      [student.id]: {
                                        ...(p[student.id] || {
                                          student_id: student.id,
                                          remarks: '',
                                        }),
                                        status,
                                      },
                                    }))
                                  }
                                />
                              ),
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={attendanceData[student.id]?.remarks || ''}
                            onChange={(e) =>
                              setAttendanceData((p) => ({
                                ...p,
                                [student.id]: {
                                  ...(p[student.id] || {
                                    student_id: student.id,
                                    status: 'present',
                                  }),
                                  remarks: e.target.value,
                                },
                              }))
                            }
                            placeholder="Add a note…"
                            className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-400 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-700 outline-none transition"
                          />
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Toast */}
       <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={cn(
              'fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl text-sm font-semibold flex items-center gap-2',
              toast.kind === 'ok'
                ? 'bg-emerald-500/95 border-emerald-300 text-white'
                : 'bg-rose-500/95 border-rose-300 text-white',
            )}
          >
            {toast.kind === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Attendance;
            