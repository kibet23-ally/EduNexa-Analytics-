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

  /**
   * ✅ CRITICAL FIX:
   * Only enable queries when BOTH are valid
   */
  const enabled = sessionReady && typeof user?.school_id === 'number';

  const schoolFilter = user?.school_id
    ? { school_id: user.school_id }
    : undefined;

  // =============================
  // COUNTS
  // =============================
  const studentsQuery = useData<number>(
    'dashboard-students',
    'students',
    {
      countOnly: true,
      filters: schoolFilter,
    },
    enabled
  );

  const teachersQuery = useData<number>(
    'dashboard-teachers',
    'teachers',
    {
      countOnly: true,
      filters: schoolFilter,
    },
    enabled
  );

  const gradesQuery = useData<number>(
    'dashboard-grades',
    'grades',
    {
      countOnly: true,
      filters: schoolFilter,
    },
    enabled
  );

  const subjectsQuery = useData<number>(
    'dashboard-subjects',
    'subjects',
    {
      countOnly: true,
      filters: schoolFilter,
    },
    enabled
  );

  const examsQuery = useData<number>(
    'dashboard-exams',
    'exams',
    {
      countOnly: true,
      filters: schoolFilter,
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
      filters: {
        ...(schoolFilter || {}),
        date: today,
      },
    },
    enabled
  );

  // =============================
  // LOADING
  // =============================
  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold">Loading Dashboard...</h2>
        </div>
      </div>
    );
  }

  // =============================
  // DATA SAFETY
  // =============================
  const attendanceData = attendanceQuery.data || [];

  const present = attendanceData.filter(
    (a: any) => a.status?.toLowerCase() === 'present'
  ).length;

  const absent = attendanceData.filter(
    (a: any) => a.status?.toLowerCase() === 'absent'
  ).length;

  const late = attendanceData.filter(
    (a: any) => a.status?.toLowerCase() === 'late'
  ).length;

  const attendanceChart = [
    { name: 'Present', value: present },
    { name: 'Absent', value: absent },
    { name: 'Late', value: late },
  ];

  const COLORS = ['#10B981', '#EF4444', '#F59E0B'];

  const performanceData = [
    { grade: 'Grade 7', score: 76 },
    { grade: 'Grade 8', score: 81 },
    { grade: 'Grade 9', score: 74 },
    { grade: 'Grade 10', score: 88 },
    { grade: 'Grade 11', score: 79 },
    { grade: 'Grade 12', score: 91 },
  ];

  const stats = [
    { title: 'Students', value: studentsQuery.data || 0, icon: Users, color: 'bg-blue-600' },
    { title: 'Teachers', value: teachersQuery.data || 0, icon: UserCheck, color: 'bg-emerald-600' },
    { title: 'Subjects', value: subjectsQuery.data || 0, icon: BookOpen, color: 'bg-violet-600' },
    { title: 'Exams', value: examsQuery.data || 0, icon: ClipboardList, color: 'bg-amber-600' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 lg:p-8">

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Overview</h1>
          <p className="text-slate-500">Welcome back {user?.name}</p>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        {stats.map((item, index) => (
          <motion.div
            key={item.title}
            className="bg-white dark:bg-slate-900 p-6 rounded-3xl border"
          >
            <p className="text-sm text-slate-500">{item.title}</p>
            <h2 className="text-3xl font-bold">{item.value}</h2>
          </motion.div>
        ))}
      </div>

      {/* rest unchanged UI */}
    </div>
  );
};

export default SchoolDashboard;