/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Users, BookOpen, ClipboardList, UserCheck,
  TrendingUp, TrendingDown, Calendar, Bell, Activity,
  ShieldCheck, Search, Sparkles, Clock, CheckCircle2,
  Plus, Pencil, Trash2, X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../useAuth';
import { useData } from '../hooks/useData';
import { supabase } from '../lib/supabase';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
  LineChart, Line, RadialBarChart, RadialBar,
} from 'recharts';

/* ─────────────────────────────────────────────────────────────
BRAND PALETTE
───────────────────────────────────────────────────────────── */
const BRAND = {
  navy:    '#0B1F4D',
  electric:'#2563EB',
  cyan:    '#22D3EE',
  emerald: '#10B981',
  amber:   '#F59E0B',
  rose:    '#EF4444',
  violet:  '#8B5CF6',
};

/* ─────────────────────────────────────────────────────────────
UI PRIMITIVES
───────────────────────────────────────────────────────────── */
const GlassCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '', children, ...rest
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
  title: string; subtitle?: string; action?: React.ReactNode;
}> = ({ title, subtitle, action }) => (
  <div className="flex items-end justify-between mb-4">
    <div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
        {title}
      </h3>
      {subtitle && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
      )}
    </div>
    {action}
  </div>
);

const Pill: React.FC<{
  tone?: 'up' | 'down' | 'neutral'; children: React.ReactNode;
}> = ({ tone = 'up', children }) => {
  const map = {
    up:      'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    down:    'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
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

/* ... (rest of your components: KpiCard, Event types, useEvents, EventModal, DeleteConfirm remain mostly the same) ... */

/* Fixed helper */
function daysFromNow(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const d = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 0) return `${Math.abs(diff)}d ago`;

  return `In ${diff}d`;
}

/* ... rest of hooks (useAcademicPerformance, useSubjectPerformance) ... */

/* In useEvents → improve the query */
const refetch = useCallback(async () => {
  if (!schoolId) return;
  setLoading(true); setError(null);
  const { data, error: err } = await supabase
    .from('events')
    .select('*')
    .eq('school_id', schoolId)           // ← Added school filter
    .order('event_date', { ascending: true });
  // ...
}, [schoolId]);

/* Main component — Loading moved to top */
const SchoolDashboard: React.FC = () => {
  const { user, sessionReady } = useAuth();
  // ... all hooks ...

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

  // ... rest of your component (attendanceRows, charts, etc.)
};

export default SchoolDashboard;