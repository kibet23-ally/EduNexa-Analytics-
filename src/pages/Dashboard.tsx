import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { Subject } from '../types';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, BookOpen, ClipboardList, TrendingUp, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const Dashboard = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    students: 0,
    grades: 0,
    subjects: 0,
    exams: 0
  });

  useEffect(() => {
    if (user?.role === 'SuperAdmin') {
      navigate('/super/dashboard');
    }
  }, [user, navigate]);
  const [performanceData, setPerformanceData] = useState<{ name: string; count: number; color: string }[]>([]);

  const fetchData = React.useCallback(async () => {
    const headers = { 'Authorization': `Bearer ${token}` };
    try {
      const [s, g, sub, e] = await Promise.all([
        fetch('/api/students', { headers }).then(r => r.json()),
        fetch('/api/grades', { headers }).then(r => r.json()),
        fetch('/api/subjects', { headers }).then(r => r.json()),
        fetch('/api/exams', { headers }).then(r => r.json())
      ]);
      setStats({
        students: s.length,
        grades: g.length,
        subjects: sub.filter((su: Subject) => {
          const name = su.subject_name.toLowerCase().trim();
          return !['science & technology', 'science and technology', 'music', 'art & craft', 'art and craft', 'physical education'].includes(name);
        }).length,
        exams: e.length
      });

      // Mock chart data for now
      setPerformanceData([
        { name: 'EE1', count: 5, color: '#1d4ed8' },
        { name: 'EE2', count: 12, color: '#2563eb' },
        { name: 'ME1', count: 25, color: '#3b82f6' },
        { name: 'ME2', count: 35, color: '#60a5fa' },
        { name: 'AE1', count: 15, color: '#93c5fd' },
        { name: 'AE2', count: 8, color: '#bfdbfe' },
        { name: 'BE1', count: 4, color: '#dbeafe' },
        { name: 'BE2', count: 2, color: '#eff6ff' },
      ]);
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  useEffect(() => {
    Promise.resolve().then(() => fetchData());
  }, [fetchData]);

  const cards = [
    { label: 'Total Students', value: stats.students, icon: Users, color: 'bg-blue-500' },
    { label: 'Grades', value: stats.grades, icon: GraduationCap, color: 'bg-indigo-500' },
    { label: 'Subjects', value: stats.subjects, icon: BookOpen, color: 'bg-cyan-500' },
    { label: 'Exams', value: stats.exams, icon: ClipboardList, color: 'bg-blue-600' },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Welcome back, {user?.name}</h1>
        <p className="text-slate-500">Here's what's happening at {user?.school_name || 'your school'} today.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className={`${card.color} p-3 rounded-lg text-white`}>
              <card.icon size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{card.label}</p>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-600" />
              Overall Performance Distribution
            </h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {performanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Award size={20} className="text-blue-600" />
            Quick Actions
          </h3>
          <div className="space-y-3">
            <button onClick={() => window.location.href='/marks'} className="w-full text-left px-4 py-3 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors text-sm font-medium border border-slate-100">
              Enter Marks
            </button>
            <button onClick={() => window.location.href='/reports'} className="w-full text-left px-4 py-3 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors text-sm font-medium border border-slate-100">
              Generate Reports
            </button>
            {user?.role === 'Admin' && (
              <>
                <button onClick={() => window.location.href='/subjects'} className="w-full text-left px-4 py-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors text-sm font-bold border border-blue-100">
                  + Add New Subjects
                </button>
                <button onClick={() => window.location.href='/exams'} className="w-full text-left px-4 py-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors text-sm font-bold border border-blue-100">
                  + Create New Exams
                </button>
                <button onClick={() => window.location.href='/students'} className="w-full text-left px-4 py-3 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors text-sm font-medium border border-slate-100">
                  Enroll New Student
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
