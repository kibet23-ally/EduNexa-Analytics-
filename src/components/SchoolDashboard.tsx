/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { useAuth } from '../useAuth';
import { useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useData';
import { Skeleton } from './ui/Skeleton';
import { Users, GraduationCap, BookOpen, ClipboardList, TrendingUp, Award, UserCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const SchoolDashboard = () => {
  const { user, sessionReady } = useAuth();
  const navigate = useNavigate();

  /**
   * ✅ FIX: Only depend on sessionReady
   * DO NOT block dashboard on school_id (it can load after session)
   */
  const canFetch = sessionReady;

  const studentCount = useData('count', 'students', { countOnly: true }, canFetch, 300000);
  const gradeCount = useData('count', 'grades', { countOnly: true }, canFetch, 300000);
  const subjectCount = useData('count', 'subjects', { countOnly: true }, canFetch, 300000);
  const examCount = useData('count', 'exams', { countOnly: true }, canFetch, 300000);

  /**
   * ✅ FIX: safe date format (prevents empty attendance results)
   */
  const today = new Date().toISOString().slice(0, 10);

  const attendance = useData<any>(
    'attendance-today',
    'attendance',
    {
      select: 'student_id, status',
      filters: { date: today },
    },
    canFetch,
    300000
  );

  const isLoading =
    !sessionReady ||
    studentCount.isLoading ||
    gradeCount.isLoading ||
    subjectCount.isLoading ||
    examCount.isLoading;

  const attendanceSummary = React.useMemo(() => {
    if (!attendance.data) {
      return { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
    }

    const attData = attendance.data;

    const present = new Set(
      attData
        .filter((a: any) => a.status.toLowerCase() === 'present')
        .map((a: any) => a.student_id)
    ).size;

    const late = new Set(
      attData
        .filter((a: any) => a.status.toLowerCase() === 'late')
        .map((a: any) => a.student_id)
    ).size;

    const excused = new Set(
      attData
        .filter((a: any) => a.status.toLowerCase() === 'excused')
        .map((a: any) => a.student_id)
    ).size;

    const totalStudents = Number(studentCount.data ?? 0);

    const absent = totalStudents - present - late - excused;

    return {
      present,
      absent: absent < 0 ? 0 : absent,
      late,
      excused,
      total: totalStudents,
    };
  }, [attendance.data, studentCount.data]);

  const performanceData = [
    { name: 'EE1', count: 5, color: '#1E3A8A' },
    { name: 'EE2', count: 12, color: '#3B82F6' },
    { name: 'ME1', count: 25, color: '#10B981' },
    { name: 'ME2', count: 35, color: '#6EE7B7' },
    { name: 'AE1', count: 15, color: '#F59E0B' },
    { name: 'AE2', count: 8, color: '#FCD34D' },
    { name: 'BE1', count: 4, color: '#EF4444' },
    { name: 'BE2', count: 2, color: '#F87171' },
  ];

  const cards = [
    { label: 'Total Students', value: studentCount.data ?? 0, icon: Users, color: 'bg-primary' },
    { label: 'Grades', value: gradeCount.data ?? 0, icon: GraduationCap, color: 'bg-accent' },
    { label: 'Subjects', value: subjectCount.data ?? 0, icon: BookOpen, color: 'bg-primary/80' },
    { label: 'Exams', value: examCount.data ?? 0, icon: ClipboardList, color: 'bg-accent/80' },
  ];

  /**
   * ⚠️ FIX: only UI warning, NOT blocking dashboard
   */
  if (!sessionReady) {
    return (
      <div className="p-8 bg-amber-50 border border-amber-200 rounded-3xl text-amber-800">
        <h2 className="text-xl font-bold">Loading session...</h2>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">
          {user?.role === 'Principal' ? 'The Principal' : `Welcome back, ${user?.name}`}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium">
          Here's what's happening at {user?.school_name || 'your school'} today.
        </p>
      </header>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))
        ) : (
          cards.map((card, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4 group hover:shadow-lg transition-all"
            >
              <div className={`${card.color} p-4 rounded-2xl text-white shadow-lg`}>
                <card.icon size={26} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {card.label}
                </p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {card.value}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Attendance */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
          <UserCheck className="text-emerald-500" />
          Today's Attendance Overview
        </h3>

        {attendance.isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
            {[
              { label: 'Total', value: studentCount.data ?? 0 },
              { label: 'Present', value: attendanceSummary.present },
              { label: 'Absent', value: attendanceSummary.absent },
              { label: 'Late', value: attendanceSummary.late },
              { label: 'Excused', value: attendanceSummary.excused },
            ].map((item) => (
              <div
                key={item.label}
                className="text-center p-6 rounded-2xl border bg-slate-50"
              >
                <p className="text-xs font-bold text-slate-400 uppercase">
                  {item.label}
                </p>
                <p className="text-3xl font-bold">{item.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Performance chart */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
          <TrendingUp className="text-primary" />
          Performance Distribution
        </h3>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count">
                {performanceData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default SchoolDashboard;