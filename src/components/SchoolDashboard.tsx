/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { useAuth } from '../useAuth';
import { useNavigate } from 'react-router-dom';
import { useData } from '../hooks/useData';
import { Skeleton } from './ui/Skeleton';
import { Users, GraduationCap, BookOpen, ClipboardList, TrendingUp, Award, UserCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const SchoolDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Optimized parallel fetching with 5-minute caching (300,000ms)
  const studentCount = useData('count', 'students', { countOnly: true }, !!user?.school_id, 300000);
  const gradeCount = useData('count', 'grades', { countOnly: true }, !!user?.school_id, 300000);
  const subjectCount = useData('count', 'subjects', { countOnly: true }, !!user?.school_id, 300000);
  const examCount = useData('count', 'exams', { countOnly: true }, !!user?.school_id, 300000);

  const today = new Date().toISOString().split('T')[0];
  const attendance = useData<any>('attendance-today', 'attendance', { 
    select: 'status',
    filters: { date: today } 
  }, !!user?.school_id, 300000);

  const isLoading = studentCount.isLoading || gradeCount.isLoading || subjectCount.isLoading || examCount.isLoading;

  const attendanceSummary = React.useMemo(() => {
    if (!attendance.data) return { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
    const attData = attendance.data;
    return {
      present: attData.filter((a: any) => a.status.toLowerCase() === 'present').length,
      absent: attData.filter((a: any) => a.status.toLowerCase() === 'absent').length,
      late: attData.filter((a: any) => a.status.toLowerCase() === 'late').length,
      excused: attData.filter((a: any) => a.status.toLowerCase() === 'excused').length,
      total: attData.length
    };
  }, [attendance.data]);

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

  if (!user?.school_id) {
    return (
      <div className="p-8 bg-amber-50 border border-amber-200 rounded-3xl text-amber-800">
        <h2 className="text-xl font-bold">Incomplete Profile</h2>
        <p>No school association found for your account. Please contact your administrator.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">
          {user?.role === 'Principal' ? 'The Principal' : `Welcome back, ${user?.name}`}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium">Here's what's happening at {user?.school_name || 'your school'} today.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
        ) : (
          cards.map((card, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4 group hover:shadow-lg hover:shadow-slate-200 dark:hover:shadow-slate-950 transition-all cursor-default">
              <div className={`${card.color} p-4 rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform`}>
                <card.icon size={26} />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{card.label}</p>
                <p className="text-3xl font-display font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                  {card.value}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Today's Attendance Widget */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden relative">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <UserCheck size={24} className="text-emerald-500" />
              Today's Attendance Overview
            </h3>
            <button 
              onClick={() => navigate('/attendance')}
              className="text-xs font-black uppercase text-primary tracking-widest hover:underline"
            >
              Manage &rarr;
            </button>
          </div>
          
          {attendance.isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-8">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-8">
              <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-1">Total Expected</p>
                <p className="text-3xl font-display font-bold text-slate-900 dark:text-white">{attendanceSummary.total}</p>
              </div>
              <div className="text-center p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest mb-1">Present</p>
                <p className="text-3xl font-display font-bold text-emerald-700 dark:text-emerald-400">{attendanceSummary.present}</p>
              </div>
              <div className="text-center p-6 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-900/30">
                <p className="text-[10px] font-black uppercase text-red-600 dark:text-red-400 tracking-widest mb-1">Absent</p>
                <p className="text-3xl font-display font-bold text-red-700 dark:text-red-400">{attendanceSummary.absent}</p>
              </div>
              <div className="text-center p-6 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                <p className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-widest mb-1">Late</p>
                <p className="text-3xl font-display font-bold text-amber-700 dark:text-amber-400">{attendanceSummary.late}</p>
              </div>
              <div className="text-center p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30 hidden lg:block">
                <p className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-widest mb-1">Excused</p>
                <p className="text-3xl font-display font-bold text-blue-700 dark:text-blue-400">{attendanceSummary.excused}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <TrendingUp size={24} className="text-primary" />
              Overall Performance Distribution
            </h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', 
                    padding: '12px',
                    backgroundColor: '#1e293b',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40}>
                  {performanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
          <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-3">
            <Award size={24} className="text-accent" />
            Quick Actions
          </h3>
          <div className="space-y-4">
            <button onClick={() => navigate('/marks')} className="w-full text-left px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-primary/5 dark:hover:bg-primary/10 text-slate-700 dark:text-slate-300 hover:text-primary transition-all text-sm font-bold border border-transparent hover:border-primary/10">
              Enter Student Marks
            </button>
            <button onClick={() => navigate('/reports')} className="w-full text-left px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-primary/5 dark:hover:bg-primary/10 text-slate-700 dark:text-slate-300 hover:text-primary transition-all text-sm font-bold border border-transparent hover:border-primary/10">
              Generate Term Reports
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchoolDashboard;
