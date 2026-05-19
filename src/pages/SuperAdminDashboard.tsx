import React, { useMemo } from 'react';
import {
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  UserCheck,
  Search,
  Bell,
  Activity,
  ShieldCheck,
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

/* ---------------- BRAND ---------------- */
const BRAND = {
  navy: '#0B1F4D',
  electric: '#2563EB',
  cyan: '#22D3EE',
  emerald: '#10B981',
  amber: '#F59E0B',
  rose: '#EF4444',
  violet: '#8B5CF6',
};

/* ---------------- UTIL ---------------- */
const safeArray = (data: any) => (Array.isArray(data) ? data : []);

/* ---------------- MAIN ---------------- */
const SuperAdminDashboard: React.FC = () => {
  const { user, sessionReady } = useAuth();

  const isSuperAdmin =
    user?.role?.toLowerCase?.() === 'superadmin' ||
    user?.role?.toLowerCase?.() === 'super_admin';

  const enabled = sessionReady && (isSuperAdmin || !!user?.school_id);

  const schoolFilter = isSuperAdmin ? undefined : { school_id: user?.school_id };

  /* ---------------- DATA QUERIES ---------------- */
  const studentsQuery = useData(
    'sa-students',
    'students',
    { filters: schoolFilter },
    enabled
  );

  const teachersQuery = useData(
    'sa-teachers',
    'teachers',
    { filters: schoolFilter },
    enabled
  );

  const subjectsQuery = useData(
    'sa-subjects',
    'subjects',
    { filters: schoolFilter },
    enabled
  );

  const gradesQuery = useData(
    'sa-grades',
    'grades',
    { filters: schoolFilter },
    enabled
  );

  const examsQuery = useData(
    'sa-exams',
    'exams',
    {
      filters: schoolFilter,
      orderBy: { column: 'year', ascending: false },
    },
    enabled
  );

  const today = new Date().toISOString().slice(0, 10);

  const attendanceQuery = useData(
    'sa-attendance',
    'attendance',
    {
      select: 'student_id, status, date',
      filters: isSuperAdmin
        ? { date: today }
        : { school_id: user?.school_id, date: today },
    },
    enabled
  );

  /* ---------------- SAFE DATA ---------------- */
  const students = safeArray(studentsQuery.data);
  const teachers = safeArray(teachersQuery.data);
  const subjects = safeArray(subjectsQuery.data);
  const exams = safeArray(examsQuery.data);
  const attendance = safeArray(attendanceQuery.data);

  /* ---------------- STATS ---------------- */
  const present = attendance.filter((a) => a.status === 'present').length;
  const absent = attendance.filter((a) => a.status === 'absent').length;
  const late = attendance.filter((a) => a.status === 'late').length;

  const total = present + absent + late;
  const rate = total ? Math.round((present / total) * 100) : 0;

  const attendancePie = [
    { name: 'Present', value: present, fill: BRAND.emerald },
    { name: 'Absent', value: absent, fill: BRAND.rose },
    { name: 'Late', value: late, fill: BRAND.amber },
  ];

  const kpis = [
    { title: 'Students', value: students.length, icon: Users, color: BRAND.electric },
    { title: 'Teachers', value: teachers.length, icon: UserCheck, color: BRAND.emerald },
    { title: 'Subjects', value: subjects.length, icon: BookOpen, color: BRAND.violet },
    { title: 'Exams', value: exams.length, icon: ClipboardList, color: BRAND.amber },
  ];

  const spark = (n: number) =>
    Array.from({ length: 10 }, (_, i) => ({
      v: Math.max(1, Math.round(n * (0.6 + i * 0.1))),
    }));

  /* ---------------- LOADING ---------------- */
  if (!sessionReady) {
    return (
      <div className="h-screen flex items-center justify-center">
        Loading dashboard...
      </div>
    );
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">
            Super Admin Dashboard
          </h1>
          <p className="text-slate-500">
            Global system overview
          </p>
        </div>

        <div className="flex gap-3 items-center">
          <Bell />
          <div className="px-3 py-2 bg-blue-600 text-white rounded-lg">
            <ShieldCheck size={16} /> {user?.role}
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.title} className="bg-white p-4 rounded-xl shadow">
            <div className="flex justify-between">
              <p className="text-sm text-slate-500">{k.title}</p>
              <k.icon size={18} />
            </div>
            <h2 className="text-2xl font-bold mt-2">
              {k.value}
            </h2>
          </div>
        ))}
      </div>

      {/* CHART */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h3 className="font-bold mb-4">Attendance Today</h3>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={attendancePie}
                dataKey="value"
                outerRadius={100}
              >
                {attendancePie.map((e, i) => (
                  <Cell key={i} fill={e.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="text-center mt-2 text-lg font-bold">
          {rate}% Attendance Rate
        </div>
      </div>

    </div>
  );
};

export default SuperAdminDashboard;