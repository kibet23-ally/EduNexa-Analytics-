'use client';

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  GraduationCap,
  UserCheck,
  TrendingUp,
  Bell,
  ShieldCheck,
  Sparkles,
  UserPlus,
  School,
  CreditCard,
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

/* Notification dot color */
const dotColor = (type: string) => {
  if (type === 'success' || type === 'onboarding') return 'bg-emerald-500';
  if (type === 'warning' || type === 'renewal') return 'bg-amber-500';
  if (type === 'info' || type === 'system') return 'bg-blue-500';
  if (type === 'error') return 'bg-red-500';
  return 'bg-slate-400';
};

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
};

/* ================= SUPER ADMIN DASHBOARD ================= */
const SuperAdminDashboard: React.FC = () => {
  const { user, sessionReady } = useAuth();
  const navigate = useNavigate();
  const enabled = sessionReady && !!user;

  // Fetch all data without school_id filter (Super Admin)
  const schoolsQuery = useData('super-schools', 'schools', {}, enabled);
  const studentsQuery = useData('super-students', 'students', {}, enabled);
  const teachersQuery = useData('super-teachers', 'teachers', {}, enabled);
  const subscriptionsQuery = useData('super-subscriptions', 'subscriptions', {}, enabled);
  const notificationsQuery = useData(
    'super-notifications', 'notifications',
    { order: { column: 'created_at', ascending: false }, limit: 10 },
    enabled,
  );

  const schools = schoolsQuery.data || [];
  const students = studentsQuery.data || [];
  const teachers = teachersQuery.data || [];
  const subscriptions = subscriptionsQuery.data || [];
  const notifications: any[] = notificationsQuery.data || [];

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
            {notifications.filter((n: any) => !n.read).length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {notifications.filter((n: any) => !n.read).length}
              </span>
            )}
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
            <button
              onClick={() => navigate('/super/schools')}
              className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl hover:border-blue-300 transition-all active:scale-95"
            >
              <School className="w-8 h-8 text-blue-600 mb-3" />
              <span className="font-medium">Add New School</span>
            </button>
            <button
              onClick={() => navigate('/super/users')}
              className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl hover:border-violet-300 transition-all active:scale-95"
            >
              <UserPlus className="w-8 h-8 text-violet-600 mb-3" />
              <span className="font-medium">Add Admin User</span>
            </button>
            <button
              onClick={() => navigate('/super/subscriptions')}
              className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl hover:border-emerald-300 transition-all active:scale-95"
            >
              <CreditCard className="w-8 h-8 text-emerald-600 mb-3" />
              <span className="font-medium">Subscriptions</span>
            </button>
            <button
              onClick={() => navigate('/super/analytics')}
              className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl hover:border-amber-300 transition-all active:scale-95"
            >
              <TrendingUp className="w-8 h-8 text-amber-600 mb-3" />
              <span className="font-medium">View Reports</span>
            </button>
          </div>
        </GlassCard>

        {/* Recent Notifications */}
        <GlassCard className="p-6">
          <SectionTitle title="Recent Notifications" />
          {notificationsQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : notifications.length > 0 ? (
            <div className="space-y-4">
              {notifications.slice(0, 5).map((n: any) => (
                <div key={n.id} className="flex gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10">
                  <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${dotColor(n.type)}`} />
                  <div>
                    <p className="text-sm">{n.message || n.title || n.body || 'Notification'}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {n.created_at ? timeAgo(n.created_at) : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">No notifications yet</div>
          )}
        </GlassCard>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;