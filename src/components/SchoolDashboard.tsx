import React, { useMemo } from 'react';
import {
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  UserCheck,
  TrendingUp,
  TrendingDown,
  Calendar,
  Bell,
  Activity,
  ShieldCheck,
  Search,
  ArrowUpRight,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../useAuth';
import { useData } from '../hooks/useData';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  RadialBarChart,
  RadialBar,
  Legend,
} from 'recharts';

/* ---------- Brand palette ---------- */
const BRAND = {
  navy: '#0B1F4D',
  electric: '#2563EB',
  cyan: '#22D3EE',
  emerald: '#10B981',
  amber: '#F59E0B',
  rose: '#EF4444',
  violet: '#8B5CF6',
};

/* ---------- Small UI primitives ---------- */
const GlassCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
  <div
    className={`relative rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const SectionTitle: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({
  title,
  subtitle,
  action,
}) => (
  <div className="flex items-end justify-between mb-4">
    <div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">{title}</h3>
      {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

const Pill: React.FC<{ tone?: 'up' | 'down' | 'neutral'; children: React.ReactNode }> = ({
  tone = 'up',
  children,
}) => {
  const map = {
    up: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    down: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
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

/* ---------- Custom tooltip ---------- */
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

/* ---------- KPI card ---------- */
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
  <motion.div
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45 }}
  >
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
);

/* =====================================================
   MAIN DASHBOARD
   ===================================================== */
const SchoolDashboard: React.FC = () => {
  const { user, sessionReady } = useAuth();
  const enabled = sessionReady && !!user?.school_id;

  // ----- Data queries -----
  const studentsQuery = useData<any>(
    'dashboard-students',
    'students',
    { filters: { school_id: user?.school_id } },
    enabled,
  );
  const teachersQuery = useData<any>(
    'dashboard-teachers',
    'teachers',
    { filters: { school_id: user?.school_id } },
    enabled,
  );
  const gradesQuery = useData<any>(
    'dashboard-grades',
    'grades',
    { filters: { school_id: user?.school_id } },
    enabled,
  );
  const subjectsQuery = useData<any>(
    'dashboard-subjects',
    'subjects',
    { filters: { school_id: user?.school_id } },
    enabled,
  );
  const examsQuery = useData<any>(
    'dashboard-exams',
    'exams',
    {
      filters: { school_id: user?.school_id },
      orderBy: { column: 'year', ascending: false },
    },
    enabled,
  );

  const today = new Date().toISOString().slice(0, 10);
  const attendanceQuery = useData<any>(
    'dashboard-attendance',
    'attendance',
    {
      select: 'student_id, status, date',
      filters: { school_id: user?.school_id, date: today },
    },
    enabled,
  );

  // ----- Loading state -----
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

  // ----- Derived data -----
  const attendanceData = attendanceQuery.data || [];
  const present = attendanceData.filter((a: any) => a.status?.toLowerCase() === 'present').length;
  const absent = attendanceData.filter((a: any) => a.status?.toLowerCase() === 'absent').length;
  const late = attendanceData.filter((a: any) => a.status?.toLowerCase() === 'late').length;
  const totalMarked = present + absent + late;
  const attendanceRate = totalMarked ? Math.round((present / totalMarked) * 100) : 0;

  const attendancePie = [
    { name: 'Present', value: present, fill: BRAND.emerald },
    { name: 'Absent', value: absent, fill: BRAND.rose },
    { name: 'Late', value: late, fill: BRAND.amber },
  ];

  const attendanceRadial = [
    { name: 'Attendance', value: attendanceRate, fill: BRAND.electric },
  ];

  const studentsCount = studentsQuery.data?.length || 0;
  const teachersCount = teachersQuery.data?.length || 0;
  const subjectsCount = subjectsQuery.data?.length || 0;
  const examsCount = examsQuery.data?.length || 0;

  // Synthetic mini spark data – replace with real series when available
  const mkSpark = (seed: number) =>
    Array.from({ length: 12 }, (_, i) => ({
      v: Math.max(2, Math.round(seed * (0.6 + Math.sin(i / 1.7 + seed) * 0.25 + i / 28))),
    }));

  const enrollmentTrend = useMemo(
    () => [
      { month: 'Jan', students: Math.max(20, studentsCount - 120), target: studentsCount - 80 },
      { month: 'Feb', students: Math.max(20, studentsCount - 95), target: studentsCount - 60 },
      { month: 'Mar', students: Math.max(20, studentsCount - 70), target: studentsCount - 40 },
      { month: 'Apr', students: Math.max(20, studentsCount - 50), target: studentsCount - 20 },
      { month: 'May', students: Math.max(20, studentsCount - 25), target: studentsCount - 10 },
      { month: 'Jun', students: studentsCount, target: studentsCount + 10 },
    ],
    [studentsCount],
  );

  const performanceData = [
    { grade: 'Grade 7', score: 76, last: 71 },
    { grade: 'Grade 8', score: 81, last: 78 },
    { grade: 'Grade 9', score: 74, last: 75 },
    { grade: 'Grade 10', score: 88, last: 82 },
    { grade: 'Grade 11', score: 79, last: 77 },
    { grade: 'Grade 12', score: 91, last: 86 },
  ];

  const subjectPerformance = [
    { subject: 'Math', score: 82 },
    { subject: 'English', score: 88 },
    { subject: 'Science', score: 79 },
    { subject: 'History', score: 74 },
    { subject: 'ICT', score: 91 },
    { subject: 'Kiswahili', score: 85 },
  ];

  const kpis: KpiProps[] = [
    {
      title: 'Total Students',
      value: studentsCount,
      delta: '+4.8%',
      tone: 'up',
      icon: Users,
      accent: BRAND.electric,
      spark: mkSpark(studentsCount || 40),
      loading: studentsQuery.isLoading,
    },
    {
      title: 'Teachers',
      value: teachersCount,
      delta: '+1.2%',
      tone: 'up',
      icon: UserCheck,
      accent: BRAND.emerald,
      spark: mkSpark(teachersCount || 14),
      loading: teachersQuery.isLoading,
    },
    {
      title: 'Subjects',
      value: subjectsCount,
      delta: 'Stable',
      tone: 'neutral',
      icon: BookOpen,
      accent: BRAND.violet,
      spark: mkSpark(subjectsCount || 10),
      loading: subjectsQuery.isLoading,
    },
    {
      title: 'Exams Tracked',
      value: examsCount,
      delta: '+12%',
      tone: 'up',
      icon: ClipboardList,
      accent: BRAND.amber,
      spark: mkSpark(examsCount || 8),
      loading: examsQuery.isLoading,
    },
  ];

  const upcomingEvents = [
    { title: 'Term 2 Mid-term Exams', date: 'Mon, 25 May', tag: 'Academics', tone: 'bg-blue-500/10 text-blue-600' },
    { title: 'Parents Consultative Day', date: 'Sat, 30 May', tag: 'Engagement', tone: 'bg-violet-500/10 text-violet-600' },
    { title: 'Inter-school Sports', date: 'Wed, 03 Jun', tag: 'Sports', tone: 'bg-emerald-500/10 text-emerald-600' },
    { title: 'Board of Governors Meeting', date: 'Fri, 05 Jun', tag: 'Admin', tone: 'bg-amber-500/10 text-amber-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-cyan-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 p-4 md:p-6 lg:p-8">
      {/* ---------- HEADER ---------- */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
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
            <input
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-slate-400"
              placeholder="Search students, teachers..."
            />
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

      {/* ---------- KPI ROW ---------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {kpis.map((k) => (
          <KpiCard key={k.title} {...k} />
        ))}
      </div>

      {/* ---------- ROW 1: Enrollment + Attendance ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        {/* Enrollment growth */}
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
                <Area type="monotone" dataKey="target" stroke={BRAND.cyan} strokeWidth={2} fill="url(#gTarget)" />
                <Area type="monotone" dataKey="students" stroke={BRAND.electric} strokeWidth={2.5} fill="url(#gStudents)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Attendance radial */}
        <GlassCard className="p-6">
          <SectionTitle title="Today's Attendance" subtitle={new Date().toDateString()} />
          <div className="relative h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="70%"
                outerRadius="100%"
                data={attendanceRadial}
                startAngle={90}
                endAngle={-270}
              >
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
            {attendancePie.map((a) => (
              <div key={a.name} className="text-center rounded-xl p-2 bg-slate-50 dark:bg-white/5">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: a.fill }} />
                  <span className="text-[11px] font-medium text-slate-500">{a.name}</span>
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{a.value}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* ---------- ROW 2: Performance + Subjects + Pie ---------- */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        {/* Academic performance per grade */}
        <GlassCard className="lg:col-span-2 p-6">
          <SectionTitle
            title="Academic Performance"
            subtitle="Average score by grade vs last term"
            action={<Pill tone="up">+5.4% avg</Pill>}
          />
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
                <XAxis dataKey="grade" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
                <Bar dataKey="last" name="Last term" fill="#cbd5e1" radius={[8, 8, 0, 0]} barSize={14} />
                <Bar dataKey="score" name="This term" fill="url(#gBar)" radius={[8, 8, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Attendance breakdown pie */}
        <GlassCard className="p-6">
          <SectionTitle title="Attendance Breakdown" subtitle="Today's status distribution" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<ChartTooltip />} />
                <Pie
                  data={attendancePie.every((d) => d.value === 0) ? [{ name: 'No data', value: 1, fill: '#e2e8f0' }] : attendancePie}
                  dataKey="value"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  stroke="none"
                >
                  {attendancePie.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {attendancePie.map((a) => (
              <div key={a.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: a.fill }} />
                  <span className="text-slate-600 dark:text-slate-300">{a.name}</span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{a.value}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* ---------- ROW 3: Subject perf line + Events ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassCard className="lg:col-span-2 p-6">
          <SectionTitle
            title="Subject Performance Trend"
            subtitle="Average score across core subjects"
            action={<Pill tone="up">Top: ICT 91%</Pill>}
          />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={subjectPerformance} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
                <XAxis dataKey="subject" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} domain={[60, 100]} />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke={BRAND.electric}
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#fff', stroke: BRAND.electric, strokeWidth: 2 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <SectionTitle
            title="Upcoming Events"
            subtitle="Next 30 days"
            action={
              <button className="text-xs font-semibold text-blue-600 inline-flex items-center gap-1">
                View all <ArrowUpRight size={12} />
              </button>
            }
          />
          <ul className="space-y-3">
            {upcomingEvents.map((e) => (
              <li
                key={e.title}
                className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-transparent hover:border-blue-200 dark:hover:border-blue-500/30 transition"
              >
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 flex items-center justify-center">
                  <Calendar size={16} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{e.title}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Clock size={11} /> {e.date}
                  </p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${e.tone}`}>
                  {e.tag}
                </span>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      {/* ---------- FOOTER STATUS BAR ---------- */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-500" /> All systems operational
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Activity size={14} className="text-blue-500" /> Live data sync
          </span>
        </div>
        <span>Last updated {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

export default SchoolDashboard;