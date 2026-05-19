'use client';

import React, { useMemo } from 'react';
import {
  Users,
  GraduationCap,
  UserCheck,
  TrendingUp,
  Bell,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Activity,
  BookOpen,
  ClipboardList,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../useAuth';
import { useData } from '../hooks/useData';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

/* ================= BRAND ================= */
const BRAND = {
  electric: '#2563EB',
  cyan: '#22D3EE',
  emerald: '#10B981',
  amber: '#F59E0B',
  violet: '#8B5CF6',
};

/* ================= UI COMPONENTS (same as school dashboard) ================= */
const GlassCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
  <div
    className={`relative rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const SectionTitle: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="mb-4">
    <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">{title}</h3>
    {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
  </div>
);

/* ================= KPI CARD ================= */
interface KpiProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  accent: string;
  loading?: boolean;
}

const KpiCard: React.FC<KpiProps> = ({ title, value, icon: Icon, accent, loading }) => (
  <GlassCard className="p-6">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>

        {loading ? (
          <div className="h-10 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mt-3" />
        ) : (
          <h2 className="text-4xl font-bold text-slate-900 dark:text-white tabular-nums mt-3">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </h2>
        )}
      </div>

      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
        style={{ background: accent }}
      >
        <Icon size={22} />
      </div>
    </div>
  </GlassCard>
);

/* ================= DASHBOARD ================= */
const SuperAdminDashboard: React.FC = () => {
  const { user, sessionReady } = useAuth();
  const enabled = sessionReady && !!user;

  /* IMPORTANT FIX:
     Keep same useData structure but REMOVE school filters completely */
  const schoolsQuery = useData('super-schools', 'schools', {}, enabled);
  const studentsQuery = useData('super-students', 'students', {}, enabled);
  const teachersQuery = useData('super-teachers', 'teachers', {}, enabled);
  const subjectsQuery = useData('super-subjects', 'subjects', {}, enabled);
  const examsQuery = useData('super-exams', 'exams', {}, enabled);
  const subscriptionsQuery = useData('super-subscriptions', 'subscriptions', {}, enabled);

  /* ================= SAFE DATA ================= */
  const schools = schoolsQuery.data || [];
  const students = studentsQuery.data || [];
  const teachers = teachersQuery.data || [];
  const subjects = subjectsQuery.data || [];
  const exams = examsQuery.data || [];
  const subs = subscriptionsQuery.data || [];

  const totalRevenue = subs.reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0);

  /* ================= PLATFORM TREND ================= */
  const platformTrend = useMemo(() => {
    const base = Math.max(5, schools.length);

    return Array.from({ length: 6 }, (_, i) => ({
      month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i],
      schools: base + i * 2,
      students: (base + i * 2) * 85,
      teachers: (base + i * 2) * 6,
    }));
  }, [schools.length]);

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-cyan-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 p-6">

      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center mb-8"
      >
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 text-xs font-semibold mb-2">
            <Sparkles size={12} /> Platform Overview
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Super Admin Dashboard
          </h1>
          <p className="text-slate-500">All schools, all data in one place</p>
        </div>

        <div className="flex items-center gap-3">
          <button className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border flex items-center justify-center">
            <Bell size={18} />
          </button>

          <div className="h-12 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white flex items-center gap-2">
            <ShieldCheck size={16} />
            Super Admin
          </div>
        </div>
      </motion.div>

      {/* KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <KpiCard
          title="Schools"
          value={schools.length}
          icon={GraduationCap}
          accent={BRAND.electric}
          loading={schoolsQuery.isLoading}
        />
        <KpiCard
          title="Students"
          value={students.length}
          icon={Users}
          accent={BRAND.cyan}
          loading={studentsQuery.isLoading}
        />
        <KpiCard
          title="Teachers"
          value={teachers.length}
          icon={UserCheck}
          accent={BRAND.emerald}
          loading={teachersQuery.isLoading}
        />
        <KpiCard
          title="Revenue"
          value={`KSh ${(totalRevenue / 1000).toFixed(1)}K`}
          icon={TrendingUp}
          accent={BRAND.amber}
          loading={subscriptionsQuery.isLoading}
        />
      </div>

      {/* CHART */}
      <GlassCard className="p-6">
        <SectionTitle title="Platform Growth" subtitle="Schools, students & teachers trend" />

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={platformTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />

              <Area type="monotone" dataKey="schools" stroke={BRAND.electric} fill={BRAND.electric} fillOpacity={0.2} />
              <Area type="monotone" dataKey="students" stroke={BRAND.cyan} fill={BRAND.cyan} fillOpacity={0.2} />
              <Area type="monotone" dataKey="teachers" stroke={BRAND.emerald} fill={BRAND.emerald} fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* FOOTER */}
      <div className="mt-8 flex justify-between text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-500" />
          System operational
        </span>
        <span className="flex items-center gap-2">
          <Activity size={14} className="text-blue-500" />
          Live sync
        </span>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;