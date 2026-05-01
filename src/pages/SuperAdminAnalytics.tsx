import React, { useMemo } from 'react';
import { useData } from './hooks/useData';
import { School, Student } from './types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Building2, Users, TrendingUp, CreditCard, Skeleton } from './components/ui/Skeleton';
import { Building2 as B2, Users as U, TrendingUp as T, CreditCard as CC } from 'lucide-react';

const COLORS = ['#1d4ed8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const SuperAdminAnalytics = () => {
  const schoolsQuery = useData<School>('sa-analytics-schools', 'schools', {
    select: 'id, name, subscription_status, subscription_tier, subscription_plan, created_at, expiry_date, subscription_end_date'
  }, true, 300000);

  const studentsQuery = useData<Student>('sa-analytics-students', 'students', {
    select: 'id, school_id, gender, grade_id'
  }, true, 300000);

  const schools = useMemo(() => schoolsQuery.data || [], [schoolsQuery.data]);
  const students = useMemo(() => studentsQuery.data || [], [studentsQuery.data]);

  // Subscription breakdown
  const subscriptionData = useMemo(() => {
    const map: Record<string, number> = {};
    schools.forEach(s => {
      const plan = s.subscription_plan || s.subscription_tier || 'Basic';
      map[plan] = (map[plan] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [schools]);

  // Status breakdown
  const statusData = useMemo(() => {
    const active = schools.filter(s => s.subscription_status?.toLowerCase() === 'active').length;
    const expired = schools.filter(s => s.subscription_status?.toLowerCase() === 'expired').length;
    const suspended = schools.filter(s => s.subscription_status?.toLowerCase() === 'suspended').length;
    const trial = schools.filter(s => s.subscription_status?.toLowerCase() === 'trial').length;
    return [
      { name: 'Active', value: active },
      { name: 'Expired', value: expired },
      { name: 'Suspended', value: suspended },
      { name: 'Trial', value: trial },
    ].filter(d => d.value > 0);
  }, [schools]);

  // Students per school
  const studentsPerSchool = useMemo(() => {
    return schools.map(s => ({
      name: s.name.length > 15 ? s.name.slice(0, 15) + '...' : s.name,
      students: students.filter(st => st.school_id === s.id).length
    })).sort((a, b) => b.students - a.students);
  }, [schools, students]);

  // Growth by month
  const growthData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const map: Record<string, number> = {};
    schools.forEach(s => {
      const month = months[new Date(s.created_at).getMonth()];
      map[month] = (map[month] || 0) + 1;
    });
    return months.map(m => ({ month: m, schools: map[m] || 0 }));
  }, [schools]);

  // Expiring soon (within 30 days)
  const expiringSoon = useMemo(() => {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return schools.filter(s => {
      const expiry = s.subscription_end_date || s.expiry_date;
      if (!expiry) return false;
      const d = new Date(expiry);
      return d >= now && d <= in30;
    });
  }, [schools]);

  const loading = schoolsQuery.isLoading || studentsQuery.isLoading;

  if (loading) {
    return (
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Platform Analytics</h1>
        <p className="text-slate-500 mt-1">Network-wide intelligence across all EduNexa schools.</p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Schools', value: schools.length, icon: B2, color: 'bg-blue-600' },
          { label: 'Total Students', value: students.length, icon: U, color: 'bg-emerald-600' },
          { label: 'Active Schools', value: schools.filter(s => s.subscription_status?.toLowerCase() === 'active').length, icon: T, color: 'bg-indigo-600' },
          { label: 'Expiring Soon', value: expiringSoon.length, icon: CC, color: 'bg-amber-500' },
        ].map((card, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <div className={`${card.color} text-white p-3 rounded-xl`}>
                <card.icon size={22} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{card.label}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* School Growth */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">School Onboarding by Month</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="schools" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subscription Status */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Subscription Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {statusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Subscription Plans</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={subscriptionData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {subscriptionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Students per School */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Students per School</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={studentsPerSchool} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Bar dataKey="students" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Expiring Soon Table */}
      {expiringSoon.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-amber-100 dark:border-amber-900/30">
          <h3 className="text-lg font-bold text-amber-700 dark:text-amber-400 mb-4">
            ⚠️ Subscriptions Expiring Within 30 Days
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs uppercase tracking-widest border-b border-slate-100">
                  <th className="px-4 py-3 text-left">School</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-left">Expires</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {expiringSoon.map(s => (
                  <tr key={s.id} className="hover:bg-amber-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{s.name}</td>
                    <td className="px-4 py-3 text-slate-600">{s.subscription_plan || s.subscription_tier || 'Basic'}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono">
                      {new Date(s.subscription_end_date || s.expiry_date || '').toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-xs font-bold uppercase">
                        {s.subscription_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminAnalytics;
