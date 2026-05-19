import React, { useMemo } from 'react';
import {
  Users,
  BookOpen,
  ClipboardList,
  UserCheck,
  Calendar,
  Bell,
  Activity,
  ShieldCheck,
  Search,
  Sparkles,
  Clock,
  CheckCircle2,
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

/* ---------- UI primitives (UNCHANGED) ---------- */
const GlassCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
  <div
    className={`relative rounded-3xl border border-slate-200/70 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const SectionTitle = ({ title, subtitle }: any) => (
  <div className="mb-4">
    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
    {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
  </div>
);

/* ---------- MAIN DASHBOARD ---------- */
const SuperAdminDashboard: React.FC = () => {
  const { user, sessionReady } = useAuth();

  const enabled = sessionReady;

  /* ✅ GLOBAL DATA (NO school_id FILTER) */
  const studentsQuery = useData('sa-students', 'students', {}, enabled);
  const teachersQuery = useData('sa-teachers', 'teachers', {}, enabled);
  const subjectsQuery = useData('sa-subjects', 'subjects', {}, enabled);
  const examsQuery = useData('sa-exams', 'exams', {}, enabled);
  const schoolsQuery = useData('sa-schools', 'schools', {}, enabled);

  const today = new Date().toISOString().slice(0, 10);
  const attendanceQuery = useData('sa-attendance', 'attendance', {
    select: 'status,date',
    filters: { date: today },
  }, enabled);

  /* ---------- LOADING ---------- */
  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  /* ---------- DERIVED ---------- */
  const studentsCount = studentsQuery.data?.length || 0;
  const teachersCount = teachersQuery.data?.length || 0;
  const subjectsCount = subjectsQuery.data?.length || 0;
  const examsCount = examsQuery.data?.length || 0;
  const schoolsCount = schoolsQuery.data?.length || 0;

  const attendanceData = attendanceQuery.data || [];
  const present = attendanceData.filter((a: any) => a.status === 'present').length;
  const total = attendanceData.length;
  const attendanceRate = total ? Math.round((present / total) * 100) : 0;

  const mkSpark = (seed: number) =>
    Array.from({ length: 10 }, (_, i) => ({
      v: Math.max(1, Math.round(seed * (0.5 + i / 10))),
    }));

  const kpis = [
    { title: 'Schools', value: schoolsCount, icon: Users, accent: BRAND.electric, spark: mkSpark(schoolsCount || 5) },
    { title: 'Students', value: studentsCount, icon: Users, accent: BRAND.emerald, spark: mkSpark(studentsCount || 40) },
    { title: 'Teachers', value: teachersCount, icon: UserCheck, accent: BRAND.violet, spark: mkSpark(teachersCount || 10) },
    { title: 'Subjects', value: subjectsCount, icon: BookOpen, accent: BRAND.amber, spark: mkSpark(subjectsCount || 8) },
  ];

  const attendancePie = [
    { name: 'Present', value: present, fill: BRAND.emerald },
    { name: 'Others', value: total - present, fill: BRAND.rose },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">

      {/* HEADER (UNCHANGED STYLE) */}
      <motion.div className="mb-8">
        <div className="flex items-center gap-2 text-blue-600 text-xs font-semibold">
          <Sparkles size={12} /> Super Admin Dashboard
        </div>
        <h1 className="text-3xl font-bold">
          Welcome back, {user?.name || 'Super Admin'}
        </h1>
        <p className="text-slate-500">Global system overview</p>
      </motion.div>

      {/* KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {kpis.map((k) => (
          <GlassCard key={k.title} className="p-5">
            <p className="text-sm text-slate-500">{k.title}</p>
            <h2 className="text-2xl font-bold">{k.value}</h2>
          </GlassCard>
        ))}
      </div>

      {/* ROW 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">

        {/* Growth */}
        <GlassCard className="lg:col-span-2 p-6">
          <SectionTitle title="System Growth" subtitle="All schools combined" />
          <div className="h-64 flex items-center justify-center text-slate-400">
            Chart placeholder (reuse your school chart if needed)
          </div>
        </GlassCard>

        {/* Attendance */}
        <GlassCard className="p-6">
          <SectionTitle title="Attendance Rate" />
          <div className="text-4xl font-bold">{attendanceRate}%</div>
        </GlassCard>

      </div>

      {/* FOOTER */}
      <div className="text-xs text-slate-500 mt-10 flex justify-between">
        <span>All systems operational</span>
        <span>{new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;