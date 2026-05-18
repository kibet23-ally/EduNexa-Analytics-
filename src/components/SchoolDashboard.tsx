/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { useAuth } from '../useAuth';
import { useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useData';
import { Skeleton } from './ui/Skeleton';
import {
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  TrendingUp,
  UserCheck,
} from 'lucide-react';

const SchoolDashboard = () => {
  const { user, sessionReady } = useAuth();
  const navigate = useNavigate();

  const schoolId = user?.school_id;

  /**
   * ✅ CRITICAL FIX:
   * Never fetch without BOTH sessionReady AND schoolId
   */
  const canFetch = sessionReady && !!schoolId;

  // =========================
  // COUNTS (SCHOOL FILTERED)
  // =========================
  const studentCount = useData(
    'students-count',
    'students',
    { countOnly: true, filters: { school_id: schoolId } },
    canFetch
  );

  const teacherCount = useData(
    'teachers-count',
    'teachers',
    { countOnly: true, filters: { school_id: schoolId } },
    canFetch
  );

  const gradeCount = useData(
    'grades-count',
    'grades',
    { countOnly: true, filters: { school_id: schoolId } },
    canFetch
  );

  const subjectCount = useData(
    'subjects-count',
    'subjects',
    { countOnly: true, filters: { school_id: schoolId } },
    canFetch
  );

  const examCount = useData(
    'exams-count',
    'exams',
    { countOnly: true, filters: { school_id: schoolId } },
    canFetch
  );

  // =========================
  // ATTENDANCE (TODAY)
  // =========================
  const today = new Date().toISOString().slice(0, 10);

  const attendance = useData<any>(
    'attendance-today',
    'attendance',
    {
      select: 'student_id, status',
      filters: {
        school_id: schoolId,
        date: today,
      },
    },
    canFetch
  );

  // =========================
  // SAFE LOADING STATE
  // =========================
  const isLoading =
    !canFetch ||
    studentCount.isLoading ||
    teacherCount.isLoading ||
    gradeCount.isLoading ||
    subjectCount.isLoading ||
    examCount.isLoading;

  // =========================
  // ATTENDANCE SUMMARY
  // =========================
  const attendanceSummary = React.useMemo(() => {
    const data = attendance.data || [];

    const present = new Set(
      data
        .filter((a: any) => a.status?.toLowerCase() === 'present')
        .map((a: any) => a.student_id)
    ).size;

    const late = new Set(
      data
        .filter((a: any) => a.status?.toLowerCase() === 'late')
        .map((a: any) => a.student_id)
    ).size;

    const excused = new Set(
      data
        .filter((a: any) => a.status?.toLowerCase() === 'excused')
        .map((a: any) => a.student_id)
    ).size;

    const total = Number(studentCount.data ?? 0);

    const absent = Math.max(total - present - late - excused, 0);

    return { present, late, excused, absent, total };
  }, [attendance.data, studentCount.data]);

  // =========================
  // KPI CARDS
  // =========================
  const cards = [
    { label: 'Students', value: studentCount.data ?? 0, icon: Users, color: 'bg-blue-600' },
    { label: 'Teachers', value: teacherCount.data ?? 0, icon: UserCheck, color: 'bg-emerald-600' },
    { label: 'Grades', value: gradeCount.data ?? 0, icon: GraduationCap, color: 'bg-purple-600' },
    { label: 'Subjects', value: subjectCount.data ?? 0, icon: BookOpen, color: 'bg-orange-500' },
    { label: 'Exams', value: examCount.data ?? 0, icon: ClipboardList, color: 'bg-pink-600' },
  ];

  // =========================
  // UI GUARD
  // =========================
  if (!sessionReady) {
    return (
      <div className="p-8 text-gray-600">
        Loading session...
      </div>
    );
  }

  if (!schoolId) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 text-red-700 rounded-xl">
        No school linked to this account.
      </div>
    );
  }

  // =========================
  // RENDER
  // =========================
  return (
    <div className="space-y-8 p-6">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome, {user?.name}
        </h1>
        <p className="text-gray-500">
          School Dashboard Overview
        </p>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))
          : cards.map((card, i) => (
              <div
                key={i}
                className="bg-white border rounded-xl p-4 flex items-center gap-4"
              >
                <div className={`${card.color} p-3 rounded-lg text-white`}>
                  <card.icon size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold">{card.value}</p>
                </div>
              </div>
            ))}
      </div>

      {/* ATTENDANCE */}
      <div className="bg-white border rounded-xl p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <UserCheck /> Today’s Attendance
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total', value: attendanceSummary.total },
            { label: 'Present', value: attendanceSummary.present },
            { label: 'Absent', value: attendanceSummary.absent },
            { label: 'Late', value: attendanceSummary.late },
            { label: 'Excused', value: attendanceSummary.excused },
          ].map((item) => (
            <div key={item.label} className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="text-xl font-bold">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* QUICK NAV */}
      <div className="flex gap-4">
        <button
          onClick={() => navigate('/students')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Manage Students
        </button>

        <button
          onClick={() => navigate('/attendance')}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg"
        >
          Attendance
        </button>
      </div>

    </div>
  );
};

export default SchoolDashboard;