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
  XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, RadialBarChart, RadialBar,
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
   DATE HELPERS — TIMEZONE SAFE
───────────────────────────────────────────────────────────── */
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getKenyaToday() {
  const now = new Date();

  const kenyaTime = new Date(
    now.toLocaleString('en-US', {
      timeZone: 'Africa/Nairobi',
    })
  );

  return getLocalDateString(kenyaTime);
}

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
        <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
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
   HELPER
───────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────
   MAIN DASHBOARD COMPONENT
───────────────────────────────────────────────────────────── */
const SchoolDashboard: React.FC = () => {
  const { user, sessionReady } = useAuth();

  const enabled = sessionReady && !!user?.school_id;

  const today = useMemo(() => getKenyaToday(), []);

  /* ── Standard queries ── */
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

  const subjectsQuery = useData<any>(
    'dashboard-subjects',
    'subjects',
    {
      filters: { school_id: user?.school_id },
    },
    enabled
  );

  const examsQuery = useData<any>(
    'dashboard-exams',
    'exams',
    {
      filters: { school_id: user?.school_id },
    },
    enabled
  );

  /* ── FIXED ATTENDANCE QUERY ── */
  const attendanceQuery = useData<any>(
    `dashboard-attendance-${today}`,
    'attendance_daily',
    {
      select: 'student_id, grade_name, status, date, created_at',
      filters: {
        school_id: user?.school_id,
        date: today,
      },
    },
    enabled,
    0
  );

  /* ── FIXED ATTENDANCE ROWS ── */
  const attendanceRows = useMemo(() => {
    const rows = attendanceQuery.data ?? [];

    return rows.filter((row: any) => {
      if (row.date) {
        return row.date === today;
      }

      if (row.created_at) {
        const rowDate = getLocalDateString(
          new Date(row.created_at)
        );

        return rowDate === today;
      }

      return false;
    });
  }, [attendanceQuery.data, today]);

  /* ── Attendance stats ── */
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
    {
      name: 'Present',
      value: present,
      fill: BRAND.emerald,
    },
    {
      name: 'Absent',
      value: absent,
      fill: BRAND.rose,
    },
    {
      name: 'Late',
      value: late,
      fill: BRAND.amber,
    },
  ];

  const attendanceRadial = [
    {
      name: 'Attendance',
      value: attendanceRate,
      fill: BRAND.electric,
    },
  ];

  const attendanceByGrade = useMemo(() => {
    const map: Record<
      string,
      { present: number; total: number }
    > = {};

    attendanceRows.forEach((a: any) => {
      const grade = a.grade_name ?? 'Unknown';

      if (!map[grade]) {
        map[grade] = {
          present: 0,
          total: 0,
        };
      }

      map[grade].total += 1;

      if (a.status?.toLowerCase() === 'present') {
        map[grade].present += 1;
      }
    });

    return Object.entries(map)
      .map(([grade, v]) => ({
        grade,
        rate: v.total
          ? Math.round((v.present / v.total) * 100)
          : 0,
      }))
      .sort((a, b) => a.grade.localeCompare(b.grade));
  }, [attendanceRows]);

  /* ── KPI Counts ── */
  const studentsCount = studentsQuery.data?.length ?? 0;
  const teachersCount = teachersQuery.data?.length ?? 0;
  const subjectsCount = subjectsQuery.data?.length ?? 0;
  const examsCount = examsQuery.data?.length ?? 0;

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading dashboard...
      </div>
    );
  }

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
            Here's a real-time snapshot of your school's
            performance today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="relative w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 flex items-center justify-center hover:shadow-md transition">
            <Bell
              size={18}
              className="text-slate-700 dark:text-slate-200"
            />
          </button>

          <div className="h-12 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold text-sm flex items-center gap-2 shadow-lg shadow-blue-600/20">
            <ShieldCheck size={16} />
            {user?.role || 'Admin'}
          </div>
        </div>
      </motion.div>

      {/* KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">

        <GlassCard className="p-5">
          <div className="flex justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Students
              </p>

              <h2 className="text-3xl font-bold mt-2">
                {studentsCount.toLocaleString()}
              </h2>
            </div>

            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white bg-blue-600">
              <Users size={20} />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Teachers
              </p>

              <h2 className="text-3xl font-bold mt-2">
                {teachersCount.toLocaleString()}
              </h2>
            </div>

            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white bg-emerald-600">
              <UserCheck size={20} />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Subjects
              </p>

              <h2 className="text-3xl font-bold mt-2">
                {subjectsCount.toLocaleString()}
              </h2>
            </div>

            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white bg-violet-600">
              <BookOpen size={20} />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Exams
              </p>

              <h2 className="text-3xl font-bold mt-2">
                {examsCount.toLocaleString()}
              </h2>
            </div>

            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white bg-amber-500">
              <ClipboardList size={20} />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* TODAY ATTENDANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">

        <GlassCard className="p-6">
          <SectionTitle
            title="Today's Attendance"
            subtitle={today}
          />

          <div className="relative h-48">
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
                Present rate
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {attendancePie.map((a) => (
              <div
                key={a.name}
                className="text-center rounded-xl p-2 bg-slate-50 dark:bg-white/5"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: a.fill }}
                  />

                  <span className="text-[11px] font-medium text-slate-500">
                    {a.name}
                  </span>
                </div>

                <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  {a.value}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-2 p-6">
          <SectionTitle
            title="Attendance Breakdown"
            subtitle="Today's rate by grade"
          />

          {attendanceByGrade.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-slate-400">
              <Activity size={32} className="mb-2 opacity-40" />

              <p className="text-sm">
                No attendance recorded today.
              </p>
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              {attendanceByGrade.map((g) => (
                <div key={g.grade}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      {g.grade}
                    </span>

                    <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                      {g.rate}%
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${g.rate}%`,
                        background:
                          g.rate >= 80
                            ? BRAND.emerald
                            : g.rate >= 60
                            ? BRAND.amber
                            : BRAND.rose,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
};

export default SchoolDashboard;