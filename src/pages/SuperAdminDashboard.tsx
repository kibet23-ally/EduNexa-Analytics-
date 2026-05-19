'use client';

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

/* ---------- UI Components (kept same) ---------- */
const GlassCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
  <div className={`relative rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] ${className}`} {...rest}>
    {children}
  </div>
);

const SectionTitle: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({
  title, subtitle, action,
}) => (
  <div className="flex items-end justify-between mb-4">
    <div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">{title}</h3>
      {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

const Pill: React.FC<{ tone?: 'up' | 'down' | 'neutral'; children: React.ReactNode }> = ({ tone = 'up', children }) => {
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

/* ---------- KPI Card ---------- */
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
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}>
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
            <Area type="monotone" dataKey="v" stroke={accent} strokeWidth={2} fill={`url(#g-${title})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  </motion.div>
);

/* =====================================================
   SUPER ADMIN DASHBOARD
   ===================================================== */
const SuperAdminDashboard: React.FC = () => {
  const { user, sessionReady } = useAuth();
  const enabled = sessionReady && !!user;

  // Platform-wide queries (Super Admin)
  const schoolsQuery = useData('all-schools', 'schools', {}, enabled);
  const studentsQuery = useData('all-students', 'students', {}, enabled);
  const teachersQuery = useData('all-teachers', 'teachers', {}, enabled);
  const revenueQuery = useData('platform-revenue', 'subscriptions', {}, enabled);

  const totalSchools = schoolsQuery.data?.length || 0;
  const totalStudents = studentsQuery.data?.length || 0;
  const totalTeachers = teachersQuery.data?.length || 0;

  const mkSpark = (seed: number) => Array.from({ length: 12 }, (_, i) => ({
    v: Math.max(2, Math.round(seed * (0.6 + Math.sin(i / 1.7 + seed) * 0.25 + i / 28))),
  }));

  const kpis = [
    {
      title: 'Total Schools',
      value: totalSchools,
      delta: '+2 this month',
      tone: 'up' as const,
      icon: GraduationCap,
      accent: BRAND.electric,
      spark: mkSpark(totalSchools || 12),
      loading: schoolsQuery.isLoading,
    },
    {
      title: 'Total Students',
      value: totalStudents,
      delta: '+8.4%',
      tone: 'up' as const,
      icon: Users,
      accent: BRAND.cyan,
      spark: mkSpark(totalStudents || 1248),
      loading: studentsQuery.isLoading,
    },
    {
      title: 'Total Teachers',
      value: totalTeachers,
      delta: '+3.1%',
      tone: 'up' as const,
      icon: UserCheck,
      accent: BRAND.emerald,
      spark: mkSpark(totalTeachers || 48),
      loading: teachersQuery.isLoading,
    },
    {
      title: 'Monthly Revenue',
      value: "₦24.8M",
      delta: '+12%',
      tone: 'up' as const,
      icon: TrendingUp,
      accent: BRAND.amber,
      spark: mkSpark(248),
      loading: false,
    },
  ];

  const upcomingEvents = [
    { title: 'Platform Maintenance', date: 'Tomorrow', tag: 'System' },
    { title: 'New School Onboarding', date: 'This Week', tag: 'Growth' },
    { title: 'Billing Cycle', date: '30 May 2026', tag: 'Finance' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-cyan-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-3">
            <Sparkles size={12} /> Platform Overview
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            Super Admin Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Real-time view across all schools on EduNexa</p>
        </div>

        <div className="flex items-center gap-3">
          <button className="relative w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 flex items-center justify-center hover:shadow-md transition">
            <Bell size={18} className="text-slate-700 dark:text-slate-200" />
          </button>
          <div className="h-12 px-5 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold flex items-center gap-2 shadow-lg">
            <ShieldCheck size={18} />
            Super Admin
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {kpis.map((k) => <KpiCard key={k.title} {...k} />)}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassCard className="lg:col-span-2 p-6">
          <SectionTitle title="Platform Growth" subtitle="Students across all schools" />
          <div className="h-80">
            {/* Placeholder for big chart */}
            <div className="h-full flex items-center justify-center text-slate-400 border border-dashed border-slate-300 rounded-2xl">
              Platform-wide Trend Chart (Coming Soon)
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <SectionTitle title="Active Schools" subtitle="Distribution" />
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl font-bold text-slate-900 dark:text-white">{totalSchools}</div>
              <p className="text-slate-500">Schools Active</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Footer Status */}
      <div className="mt-10 text-xs text-slate-500 flex justify-between">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> All Systems Operational</span>
          <span className="flex items-center gap-1.5"><Activity size={14} className="text-blue-500" /> Live Sync</span>
        </div>
        <span>Last updated: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;