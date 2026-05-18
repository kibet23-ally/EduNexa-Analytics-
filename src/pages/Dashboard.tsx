'use client';

import React from 'react';
import { useAuth } from '../useAuth';
import { useData } from '../hooks/useData';
import {
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  UserCheck,
  TrendingUp,
  Award,
  Calendar,
  Activity
} from 'lucide-react';
import { motion } from 'framer-motion';

const DashboardOverview = () => {
  const { user, sessionReady } = useAuth();

  const canFetch = sessionReady && !!user?.school_id;
  const schoolId = user?.school_id;

  // =========================
  // REAL DATA QUERIES
  // =========================
  const students = useData('students-count', 'students',
    { countOnly: true, filters: { school_id: schoolId } },
    canFetch
  );

  const teachers = useData('teachers-count', 'teachers',
    { countOnly: true, filters: { school_id: schoolId } },
    canFetch
  );

  const subjects = useData('subjects-count', 'subjects',
    { countOnly: true, filters: { school_id: schoolId } },
    canFetch
  );

  const grades = useData('grades-count', 'grades',
    { countOnly: true, filters: { school_id: schoolId } },
    canFetch
  );

  const attendance = useData('attendance-today', 'attendance',
    {
      filters: {
        school_id: schoolId,
        date: new Date().toISOString().slice(0, 10)
      }
    },
    canFetch
  );

  // =========================
  // SAFE DATA HANDLING
  // =========================
  const totalStudents = typeof students.data === 'number' ? students.data : 0;
  const totalTeachers = typeof teachers.data === 'number' ? teachers.data : 0;
  const totalSubjects = typeof subjects.data === 'number' ? subjects.data : 0;
  const totalGrades = typeof grades.data === 'number' ? grades.data : 0;

  // =========================
  // ATTENDANCE CALCULATION
  // =========================
  const attendanceSummary = React.useMemo(() => {
    const data = attendance.data || [];

    const present = new Set(
      data.filter((a: any) => a.status?.toLowerCase() === 'present')
        .map((a: any) => a.student_id)
    ).size;

    const late = new Set(
      data.filter((a: any) => a.status?.toLowerCase() === 'late')
        .map((a: any) => a.student_id)
    ).size;

    const excused = new Set(
      data.filter((a: any) => a.status?.toLowerCase() === 'excused')
        .map((a: any) => a.student_id)
    ).size;

    const absent = Math.max(0, totalStudents - present - late - excused);

    return { present, late, excused, absent };
  }, [attendance.data, totalStudents]);

  if (!sessionReady) {
    return (
      <div className="p-6 text-gray-500">
        Loading dashboard...
      </div>
    );
  }

  // =========================
  // KPI CARDS DATA
  // =========================
  const kpis = [
    { label: 'Students', value: totalStudents, icon: Users, color: 'blue' },
    { label: 'Teachers', value: totalTeachers, icon: GraduationCap, color: 'emerald' },
    { label: 'Subjects', value: totalSubjects, icon: BookOpen, color: 'violet' },
    { label: 'Grades', value: totalGrades, icon: ClipboardList, color: 'amber' },
  ];

  const colorMap: any = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="space-y-8">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome, {user?.name}
        </h1>
        <p className="text-gray-500">
          School analytics overview for {user?.school_name || 'your institution'}
        </p>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition"
          >
            <div className={`p-3 w-fit rounded-xl ${colorMap[kpi.color]}`}>
              <kpi.icon className="w-6 h-6" />
            </div>

            <p className="text-sm text-gray-500 mt-4">{kpi.label}</p>
            <p className="text-3xl font-bold">{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* ATTENDANCE SECTION */}
      <div className="bg-white border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <UserCheck className="text-emerald-500" />
          <h2 className="text-lg font-semibold">Today's Attendance</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Present" value={attendanceSummary.present} color="emerald" />
          <Stat label="Absent" value={attendanceSummary.absent} color="red" />
          <Stat label="Late" value={attendanceSummary.late} color="amber" />
          <Stat label="Excused" value={attendanceSummary.excused} color="blue" />
        </div>
      </div>

      {/* ACTIVITY + INSIGHTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="bg-white border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="text-blue-500" />
            <h2 className="font-semibold">System Overview</h2>
          </div>

          <p className="text-gray-500 text-sm">
            Real-time school analytics including students, teachers, subjects, and attendance tracking.
            All data is filtered by school ID and secured using RBAC policies.
          </p>
        </div>

        <div className="bg-white border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="text-violet-500" />
            <h2 className="font-semibold">Performance Insight</h2>
          </div>

          <p className="text-gray-500 text-sm">
            Track academic performance trends, attendance consistency, and subject engagement
            across all grades in your institution.
          </p>
        </div>

      </div>

    </div>
  );
};

// =========================
// SMALL STAT COMPONENT
// =========================
const Stat = ({ label, value, color }: any) => {
  const colors: any = {
    emerald: 'text-emerald-600 bg-emerald-50',
    red: 'text-red-600 bg-red-50',
    amber: 'text-amber-600 bg-amber-50',
    blue: 'text-blue-600 bg-blue-50',
  };

  return (
    <div className={`p-4 rounded-xl ${colors[color]}`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
};

export default DashboardOverview;