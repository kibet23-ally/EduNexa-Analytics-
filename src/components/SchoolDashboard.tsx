import React from 'react';
import {
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  UserCheck,
  TrendingUp,
  Calendar,
  Bell,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../useAuth';
import { useData } from '../hooks/useData';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const SchoolDashboard = () => {
  const { user, sessionReady } = useAuth();
  const enabled = sessionReady && !!user?.school_id;

  // =============================
  // COUNTS (FIXED)
  // =============================

  const studentsQuery = useData<any>(
    'dashboard-students',
    'students',
    { filters: { school_id: user?.school_id } },
    enabled
  );

  const teachersQuery = useData<any>(
    'dashboard-teachers',
    'teachers',
    { filters: { school_id: user?.school_id } },
    enabled
  );

  const gradesQuery = useData<any>(
    'dashboard-grades',
    'grades',
    { filters: { school_id: user?.school_id } },
    enabled
  );

  const subjectsQuery = useData<any>(
    'dashboard-subjects',
    'subjects',
    { filters: { school_id: user?.school_id } },
    enabled
  );

  const examsQuery = useData<any>(
    'dashboard-exams',
    'exams',
    {
      filters: { school_id: user?.school_id },
      orderBy: { column: 'year', ascending: false }
    },
    enabled
  );

  // =============================
  // ATTENDANCE
  // =============================

  const today = new Date().toISOString().slice(0, 10);

  const attendanceQuery = useData<any>(
    'dashboard-attendance',
    'attendance',
    {
      select: 'student_id, status, date',
      filters: { school_id: user?.school_id, date: today },
    },
    enabled
  );

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-700 dark:text-white">
            Loading Dashboard...
          </h2>
        </div>
      </div>
    );
  }

  const attendanceData = attendanceQuery.data || [];

  const present = attendanceData.filter((a: any) => a.status?.toLowerCase() === 'present').length;
  const absent = attendanceData.filter((a: any) => a.status?.toLowerCase() === 'absent').length;
  const late = attendanceData.filter((a: any) => a.status?.toLowerCase() === 'late').length;

  const attendanceChart = [
    { name: 'Present', value: present },
    { name: 'Absent', value: absent },
    { name: 'Late', value: late },
  ];

  const performanceData = [
    { grade: 'Grade 7', score: 76 },
    { grade: 'Grade 8', score: 81 },
    { grade: 'Grade 9', score: 74 },
    { grade: 'Grade 10', score: 88 },
    { grade: 'Grade 11', score: 79 },
    { grade: 'Grade 12', score: 91 },
  ];

  const stats = [
    {
      title: 'Students',
      value: studentsQuery.data?.length || 0,
      icon: Users,
      color: 'bg-blue-600',
    },
    {
      title: 'Teachers',
      value: teachersQuery.data?.length || 0,
      icon: UserCheck,
      color: 'bg-emerald-600',
    },
    {
      title: 'Subjects',
      value: subjectsQuery.data?.length || 0,
      icon: BookOpen,
      color: 'bg-violet-600',
    },
    {
      title: 'Exams',
      value: examsQuery.data?.length || 0,
      icon: ClipboardList,
      color: 'bg-amber-600',
    },
  ];

  const COLORS = ['#10B981', '#EF4444', '#F59E0B'];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 lg:p-8">

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Dashboard Overview
          </h1>
          <p className="text-slate-500 mt-2">
            Welcome back {user?.name || 'Admin'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border flex items-center justify-center">
            <Bell size={20} />
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        {stats.map((item) => (
          <div key={item.title} className="bg-white rounded-3xl p-6 border shadow-sm">
            <p className="text-sm text-slate-500">{item.title}</p>
            <h2 className="text-4xl font-bold mt-2">{item.value}</h2>
          </div>
        ))}
      </div>

    </div>
  );
};

export default SchoolDashboard;