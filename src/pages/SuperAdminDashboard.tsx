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
  Plus,
  UserPlus,
  School,
  Award,
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

/* Brand Colors */
const BRAND = {
  electric: '#2563EB',
  cyan: '#22D3EE',
  emerald: '#10B981',
  amber: '#F59E0B',
  violet: '#8B5CF6',
};

/* UI Components */
const GlassCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
  <div className={`relative rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] ${className}`} {...rest}>
    {children}
  </div>
);

const SectionTitle: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="mb-4">
    <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">{title}</h3>
    {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
  </div>
);

/* KPI Card */
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
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white" style={{ background: accent }}>
        <Icon size={24} />
      </div>
    </div>
  </GlassCard>
);

/* ================= SUPER ADMIN DASHBOARD ================= */
const SuperAdminDashboard: React.FC = () => {
  const { user, sessionReady } = useAuth();
  const enabled = sessionReady && !!user;

  // Fetch all data without school_id filter (Super Admin)
  const schoolsQuery = useData('super-schools', 'schools', {}, enabled);
  const studentsQuery = useData('super-students', 'students', {}, enabled);
  const teachersQuery = useData('super-teachers', 'teachers', {}, enabled);
  const subscriptionsQuery = useData('super-subscriptions', 'subscriptions', {}, enabled);

  const schools = schoolsQuery.data || [];
  const students = studentsQuery.data || [];
  const teachers = teachersQuery.data || [];
  const subscriptions = subscriptionsQuery.data || [];

  const totalRevenue = subscriptions.reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0);

  // Platform Growth Trend
  const platformTrend = useMemo(() => {
    const base = Math.max(3, schools.length);
    return Array.from({ length: 6 }, (_, i) => ({
      month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i],
      schools: base + i * 2,
      students: (base + i * 2) * 92,
    }));
  }, [schools.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-cyan-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 p-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 text-xs font-semibold mb-2">
            <Sparkles size={12} /> Platform Overview
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Super Admin Dashboard</h1>
          <p className="text-slate-500">Real-time overview of all schools on EduNexa</p>
        </div>

        <div className="flex items-center gap-3">
          <button className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border flex items-center justify-center relative">
            <Bell size={18} />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">3</span>
          </button>
          <div className="h-12 px-5 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white flex items-center gap-2 font-medium">
            <ShieldCheck size={18} />
            Super Admin
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <KpiCard title="Total Schools" value={schools.length} icon={GraduationCap} accent={BRAND.electric} loading={schoolsQuery.isLoading} />
        <KpiCard title="Total Students" value={students.length} icon={Users} accent={BRAND.cyan} loading={studentsQuery.isLoading} />
        <KpiCard title="Total Teachers" value={teachers.length} icon={UserCheck} accent={BRAND.emerald} loading={teachersQuery.isLoading} />
        <KpiCard title="Revenue" value={`KSh ${(totalRevenue / 1000000).toFixed(1)}M`} icon={TrendingUp} accent={BRAND.amber} loading={subscriptionsQuery.isLoading} />
      </div>

      {/* Platform Growth Chart */}
      <GlassCard className="p-6 mb-8">
        <SectionTitle title="Platform Growth" subtitle="Last 6 months trend" />
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={platformTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="schools" stroke={BRAND.electric} fill={BRAND.electric} fillOpacity={0.25} strokeWidth={3} />
              <Area type="monotone" dataKey="students" stroke={BRAND.cyan} fill={BRAND.cyan} fillOpacity={0.25} strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* Quick Actions & Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <GlassCard className="p-6">
          <SectionTitle title="Quick Actions" />
          <div className="grid grid-cols-2 gap-4">
            <button className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl hover:border-blue-300 transition-all active:scale-95">
              <School className="w-8 h-8 text-blue-600 mb-3" />
              <span className="font-medium">Add New School</span>
            </button>
            <button className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl hover:border-violet-300 transition-all active:scale-95">
              <UserPlus className="w-8 h-8 text-violet-600 mb-3" />
              <span className="font-medium">Add Admin User</span>
            </button>
            <button className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl hover:border-emerald-300 transition-all active:scale-95">
              <Award className="w-8 h-8 text-emerald-600 mb-3" />
              <span className="font-medium">Send Announcement</span>
            </button>
            <button className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl hover:border-amber-300 transition-all active:scale-95">
              <TrendingUp className="w-8 h-8 text-amber-600 mb-3" />
              <span className="font-medium">View Reports</span>
            </button>
          </div>
        </GlassCard>

        {/* Recent Notifications */}
        <GlassCard className="p-6">
          <SectionTitle title="Recent Notifications" />
          <div className="space-y-4">
            <div className="flex gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10">
              <div className="w-2 h-2 mt-2 bg-emerald-500 rounded-full flex-shrink-0" />
              <div>
                <p className="text-sm">New school <strong>Starlight Academy</strong> onboarded successfully</p>
                <p className="text-xs text-slate-500 mt-1">2 hours ago</p>
              </div>
            </div>

            <div className="flex gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10">
              <div className="w-2 h-2 mt-2 bg-amber-500 rounded-full flex-shrink-0" />
              <div>
                <p className="text-sm">Subscription renewal due for <strong>3 schools</strong></p>
                <p className="text-xs text-slate-500 mt-1">Yesterday</p>
              </div>
            </div>

            <div className="flex gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10">
              <div className="w-2 h-2 mt-2 bg-blue-500 rounded-full flex-shrink-0" />
              <div>
                <p className="text-sm">System backup completed successfully</p>
                <p className="text-xs text-slate-500 mt-1">3 days ago</p>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Debug Info (Remove in production) */}
      {schoolsQuery.data && (
        <div className="mt-8 text-xs text-slate-500 bg-slate-100 dark:bg-slate-900 p-4 rounded-2xl">
          Debug: {schools.length} schools loaded | Students: {students.length}
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;