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
  AlertTriangle,
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
  Legend,
} from 'recharts';

/* ---------- BRAND ---------- */
const BRAND = {
  navy: '#0B1F4D',
  electric: '#2563EB',
  cyan: '#22D3EE',
  emerald: '#10B981',
  amber: '#F59E0B',
  rose: '#EF4444',
  violet: '#8B5CF6',
};

/* ---------- SAFE ---------- */
const safeArray = (data: any) => (Array.isArray(data) ? data : []);

/* =====================================================
   SUPER ADMIN DASHBOARD (SCHOOL DASHBOARD BASED)
   ===================================================== */
const SuperAdminDashboard: React.FC = () => {
  const { user, sessionReady } = useAuth();

  const isSuperAdmin =
    user?.role?.toLowerCase?.() === 'superadmin' ||
    user?.role?.toLowerCase?.() === 'super_admin';

  const enabled = sessionReady && (isSuperAdmin || !!user?.school_id);

  /* 🔥 CRITICAL FIX: remove school restriction for super admin */
  const schoolFilter = isSuperAdmin ? undefined : { school_id: user?.school_id };

  // ---------- DATA QUERIES (UNCHANGED STRUCTURE) ----------
  const studentsQuery = useData(
    'dashboard-students',
    'students',
    { filters: schoolFilter },
    enabled,
  );

  const teachersQuery = useData(
    'dashboard-teachers',
    'teachers',
    { filters: schoolFilter },
    enabled,
  );

  const gradesQuery = useData(
    'dashboard-grades',
    'grades',
    { filters: schoolFilter },
    enabled,
  );

  const subjectsQuery = useData(
    'dashboard-subjects',
    'subjects',
    { filters: schoolFilter },
    enabled,
  );

  const examsQuery = useData(
    'dashboard-exams',
    'exams',
    {
      filters: schoolFilter,
      orderBy: { column: 'year', ascending: false },
    },
    enabled,
  );

  const today = new Date().toISOString().slice(0, 10);

  const attendanceQuery = useData(
    'dashboard-attendance',
    'attendance',
    {
      select: 'student_id, status, date',
      filters: isSuperAdmin
        ? { date: today }
        : { school_id: user?.school_id, date: today },
    },
    enabled,
  );

  // ---------- SAFE DATA ----------
  const students = safeArray(studentsQuery.data);
  const teachers = safeArray(teachersQuery.data);
  const grades = safeArray(gradesQuery.data);
  const subjects = safeArray(subjectsQuery.data);
  const exams = safeArray(examsQuery.data);
  const attendance = safeArray(attendanceQuery.data);

  // ---------- ATTENDANCE ----------
  const present = attendance.filter((a: any) => a.status === 'present').length;
  const absent = attendance.filter((a: any) => a.status === 'absent').length;
  const late = attendance.filter((a: any) => a.status === 'late').length;

  const total = present + absent + late;
  const attendanceRate = total ? Math.round((present / total) * 100) : 0;

  const attendancePie = [
    { name: 'Present', value: present, fill: BRAND.emerald },
    { name: 'Absent', value: absent, fill: BRAND.rose },
    { name: 'Late', value: late, fill: BRAND.amber },
  ];

  const attendanceRadial = [
    { name: 'Attendance', value: attendanceRate, fill: BRAND.electric },
  ];

  // ---------- KPI VALUES ----------
  const studentsCount = students.length;
  const teachersCount = teachers.length;
  const subjectsCount = subjects.length;
  const examsCount = exams.length;

  // ---------- TREND DATA ----------
  const enrollmentTrend = useMemo(
    () => [
      { month: 'Jan', students: studentsCount * 0.6, target: studentsCount * 0.8 },
      { month: 'Feb', students: studentsCount * 0.65, target: studentsCount * 0.85 },
      { month: 'Mar', students: studentsCount * 0.7, target: studentsCount * 0.9 },
      { month: 'Apr', students: studentsCount * 0.8, target: studentsCount * 0.95 },
      { month: 'May', students: studentsCount * 0.9, target: studentsCount },
      { month: 'Jun', students: studentsCount, target: studentsCount * 1.05 },
    ],
    [studentsCount],
  );

  const performanceData = [
    { grade: 'Grade 7', score: 76, last: 71 },
    { grade: 'Grade 8', score: 81, last: 78 },
    { grade: 'Grade 9', score: 74, last: 75 },
    { grade: 'Grade 10', score: 88, last: 82 },
    { grade: 'Grade 11', score: 79, last: 77 },
    { grade: 'Grade 12', score: 91, last: 86 },
  ];

  const subjectPerformance = [
    { subject: 'Math', score: 82 },
    { subject: 'English', score: 88 },
    { subject: 'Science', score: 79 },
    { subject: 'History', score: 74 },
    { subject: 'ICT', score: 91 },
    { subject: 'Kiswahili', score: 85 },
  ];

  const upcomingEvents = [
    { title: 'Term 2 Exams', date: 'Mon, 25 May', tag: 'Academics', tone: 'bg-blue-500/10 text-blue-600' },
    { title: 'Parents Day', date: 'Sat, 30 May', tag: 'Engagement', tone: 'bg-violet-500/10 text-violet-600' },
    { title: 'Sports Day', date: 'Wed, 03 Jun', tag: 'Sports', tone: 'bg-emerald-500/10 text-emerald-600' },
  ];

  // ---------- LOADING ----------
  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading dashboard...
      </div>
    );
  }

  // =====================================================
  // UI (UNCHANGED FROM YOUR SCHOOL DASHBOARD)
  // =====================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-cyan-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 p-4 md:p-6 lg:p-8">

      {/* HEADER */}
      <motion.div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-3">
            <Sparkles size={12} /> Super Admin Overview
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
            Welcome back, {user?.name || 'Super Admin'} 👋
          </h1>
          <p className="text-slate-500 mt-2">
            System-wide analytics across all schools
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Bell />
          <div className="h-12 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white flex items-center gap-2">
            <ShieldCheck size={16} />
            {user?.role}
          </div>
        </div>
      </motion.div>

      {/* KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <div className="bg-white p-5 rounded-xl shadow">
          <Users />
          <h2 className="text-2xl font-bold">{studentsCount}</h2>
          <p className="text-sm text-slate-500">Students</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow">
          <UserCheck />
          <h2 className="text-2xl font-bold">{teachersCount}</h2>
          <p className="text-sm text-slate-500">Teachers</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow">
          <BookOpen />
          <h2 className="text-2xl font-bold">{subjectsCount}</h2>
          <p className="text-sm text-slate-500">Subjects</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow">
          <ClipboardList />
          <h2 className="text-2xl font-bold">{examsCount}</h2>
          <p className="text-sm text-slate-500">Exams</p>
        </div>
      </div>

    </div>
  );
};

export default SuperAdminDashboard;