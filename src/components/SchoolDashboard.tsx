/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Users, BookOpen, ClipboardList, UserCheck,
  TrendingUp, TrendingDown, Calendar, Bell, Activity,
  ShieldCheck, Search, Sparkles, Clock,
  Plus, Pencil, Trash2, X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../useAuth';
import { useData } from '../hooks/useData';
import { supabase } from '../lib/supabase';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, LineChart,
  Line, RadialBarChart, RadialBar,
} from 'recharts';

/* ─────────────────────────────────────────────────────────────
BRAND PALETTE
───────────────────────────────────────────────────────────── */
const BRAND = {
  navy: '#0B1F4D',
  electric: '#2563EB',
  cyan: '#22D3EE',
  emerald: '#10B981',
  amber: '#F59E0B',
  rose: '#EF4444',
  violet: '#8B5CF6',
};

/* ─────────────────────────────────────────────────────────────
UI PRIMITIVES
───────────────────────────────────────────────────────────── */
const GlassCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...rest
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
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ title, subtitle, action }) => (
  <div className="flex items-end justify-between mb-4">
    <div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
        {title}
      </h3>

      {subtitle && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {subtitle}
        </p>
      )}
    </div>

    {action}
  </div>
);

const Pill: React.FC<{
  tone?: 'up' | 'down' | 'neutral';
  children: React.ReactNode;
}> = ({ tone = 'up', children }) => {
  const map = {
    up: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    down: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
    neutral: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
  } as const;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${map[tone]}`}
    >
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
      {label && (
        <p className="text-xs font-medium text-slate-500 mb-1">
          {label}
        </p>
      )}

      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-xs">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: p.color || p.fill }}
          />

          <span className="text-slate-600 dark:text-slate-300">
            {p.name}
          </span>

          <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
            {typeof p.value === 'number'
              ? p.value.toLocaleString()
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
MAIN DASHBOARD COMPONENT
───────────────────────────────────────────────────────────── */
const SchoolDashboard: React.FC = () => {
  const { user, sessionReady } = useAuth();

  const enabled = sessionReady && !!user?.school_id;

  /* ─────────────────────────────────────────────────────────────
  ATTENDANCE PERIOD
  ───────────────────────────────────────────────────────────── */
  const [attendancePeriod, setAttendancePeriod] = useState<
    'today' | 'week' | 'month'
  >('today');

  const today = useMemo(() => {
    return new Date().toISOString().slice(0, 10);
  }, []);

  const attendanceFilters = useMemo(() => {
    const now = new Date();

    if (attendancePeriod === 'today') {
      return {
        school_id: user?.school_id,
        date: today,
      };
    }

    if (attendancePeriod === 'week') {
      const firstDay = new Date(now);

      firstDay.setDate(now.getDate() - 7);

      return {
        school_id: user?.school_id,
        date_gte: firstDay.toISOString().slice(0, 10),
      };
    }

    const firstDay = new Date(now);

    firstDay.setMonth(now.getMonth() - 1);

    return {
      school_id: user?.school_id,
      date_gte: firstDay.toISOString().slice(0, 10),
    };
  }, [attendancePeriod, today, user?.school_id]);

  /* ─────────────────────────────────────────────────────────────
  DATA QUERIES
  ───────────────────────────────────────────────────────────── */
  const studentsQuery = useData<any>(
    'dashboard-students',
    'students',
    {
      filters: { school_id: user?.school_id },
    },
    enabled
  );

  const teachersQuery = useData<any>(
    'dashboard-teachers',
    'teachers',
    {
      filters: { school_id: user?.school_id },
    },
    enabled
  );

  const attendanceQuery = useData<any>(
    `dashboard-attendance-${attendancePeriod}-${today}`,
    'attendance_daily',
    {
      select: 'student_id, grade_name, status, date',
      filters: attendanceFilters,
    },
    enabled,
    0
  );

  /* ─────────────────────────────────────────────────────────────
  LOADING SCREEN
  ───────────────────────────────────────────────────────────── */
  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/40 to-cyan-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-blue-200/40" />

            <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
          </div>

          <h2 className="text-lg font-semibold text-slate-700 dark:text-white">
            Loading dashboard…
          </h2>

          <p className="text-sm text-slate-500 mt-1">
            Preparing your school analytics
          </p>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
  ATTENDANCE STATS
  ───────────────────────────────────────────────────────────── */
  const attendanceRows = attendanceQuery.data ?? [];

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

  const attendanceRadial = [
    {
      name: 'Attendance',
      value: attendanceRate,
      fill: BRAND.electric,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-cyan-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 p-4 md:p-6 lg:p-8">

      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8"
      >
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-3">
            <Sparkles size={12} />
            Dashboard Overview
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            Welcome back, {user?.name || 'Admin'} 👋
          </h1>

          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Here's a real-time snapshot of your school's performance.
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

          <div className="h-12 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold text-sm flex items-center gap-2 shadow-lg shadow-blue-600/20">
            <ShieldCheck size={16} />
            {user?.role || 'Admin'}
          </div>
        </div>
      </motion.div>

      {/* ATTENDANCE CARD */}
      <GlassCard className="p-6">
        <SectionTitle
          title="Attendance Overview"
          subtitle={`Viewing ${attendancePeriod} attendance`}
          action={
            <select
              value={attendancePeriod}
              onChange={(e) =>
                setAttendancePeriod(
                  e.target.value as 'today' | 'week' | 'month'
                )
              }
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-xs font-medium"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          }
        />

        <div className="relative h-56">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="70%"
              outerRadius="100%"
              data={attendanceRadial}
              startAngle={90}
              endAngle={-270}
            >
              <RadialBar
                background
                dataKey="value"
                cornerRadius={20}
                fill={BRAND.electric}
              />
            </RadialBarChart>
          </ResponsiveContainer>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-bold text-slate-900 dark:text-white tabular-nums">
              {attendanceRate}%
            </div>

            <div className="text-xs font-medium text-slate-500 mt-1">
              Attendance Rate
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 p-4 text-center">
            <p className="text-xs font-medium text-emerald-600">
              Present
            </p>

            <h3 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
              {present}
            </h3>
          </div>

          <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 p-4 text-center">
            <p className="text-xs font-medium text-rose-600">
              Absent
            </p>

            <h3 className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">
              {absent}
            </h3>
          </div>

          <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 p-4 text-center">
            <p className="text-xs font-medium text-amber-600">
              Late
            </p>

            <h3 className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">
              {late}
            </h3>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default SchoolDashboard;