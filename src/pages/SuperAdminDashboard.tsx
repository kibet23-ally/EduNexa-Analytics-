import React, { useMemo } from 'react';
import { 
  Building2, 
  Users, 
  CreditCard, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { School } from '../types';
import { useData } from '../hooks/useData';
import { Skeleton } from '../components/ui/Skeleton';

const SuperAdminDashboard = () => {
  // Use cached data hooks
  const schoolsQuery = useData<School>('all-schools-stats', 'schools', { 
    select: 'id, subscription_status, created_at, name, logo_url, subscription_end_date' 
  }, true, 300000);

  const studentsCountQuery = useData<number>('total-students-platform', 'students', { 
    countOnly: true 
  }, true, 300000);

  const stats = useMemo(() => {
    if (!schoolsQuery.data) return null;
    const schools = schoolsQuery.data;
    return {
      totalSchools: schools.length,
      activeSubscriptions: schools.filter(s => s.subscription_status?.toLowerCase() === 'active').length,
      expiredSchools: schools.filter(s => s.subscription_status?.toLowerCase() === 'expired').length,
      totalStudents: typeof studentsCountQuery.data === 'number' ? studentsCountQuery.data : 0
    };
  }, [schoolsQuery.data, studentsCountQuery.data]);

  const recentSchools = useMemo(() => {
    if (!schoolsQuery.data) return [];
    return [...schoolsQuery.data]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [schoolsQuery.data]);

  const growthData = useMemo(() => {
    if (!schoolsQuery.data) return [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const countsByMonth: Record<string, number> = {};
    
    schoolsQuery.data.forEach(s => {
      const date = new Date(s.created_at);
      const month = months[date.getMonth()];
      countsByMonth[month] = (countsByMonth[month] || 0) + 1;
    });

    return months.map(m => ({ month: m, schools: countsByMonth[m] || 0 }));
  }, [schoolsQuery.data]);

  const loading = schoolsQuery.isLoading || studentsCountQuery.isLoading;

  if (loading) {
    return (
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-1/3 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}
        </div>
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }

  const alerts = [
    { type: 'warning', message: '3 School subscriptions expiring this week', icon: Clock },
    { type: 'error', message: '5 Schools have expired subscriptions', icon: AlertTriangle },
    { type: 'info', message: 'New deployment successful in Cluster 2', icon: CheckCircle2 }
  ];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">EduNexa Platform Overview</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Operational intelligence for the entire network.</p>
      </header>

      {/* 1. Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Total Schools" 
          value={stats?.totalSchools || 0} 
          icon={Building2} 
          color="bg-primary" 
          trend="+12% from last month"
        />
        <StatCard 
          label="Total Students" 
          value={stats?.totalStudents || 0} 
          icon={Users} 
          color="bg-accent" 
          trend="+8.4% from last month"
        />
        <StatCard 
          label="Active Subs" 
          value={stats?.activeSubscriptions || 0} 
          icon={CreditCard} 
          color="bg-primary" 
          trend="92% retention rate"
        />
        <StatCard 
          label="Expired/Risk" 
          value={stats?.expiredSchools || 0} 
          icon={AlertTriangle} 
          color="bg-red-600" 
          trend="Action required"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 2. Growth Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <TrendingUp className="text-primary" size={24} />
              Platform Growth
            </h3>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    backgroundColor: '#1e293b',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="schools" fill="#1E3A8A" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Alerts & Items needing attention */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
            <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-3">
              <AlertTriangle className="text-accent" size={24} />
              System Alerts
            </h3>
            <div className="space-y-4">
              {alerts.map((alert, idx) => (
                <div key={idx} className={`p-5 rounded-2xl flex items-start gap-4 ${
                  alert.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400' : 
                  alert.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400' : 'bg-primary/5 dark:bg-primary/10 text-primary'
                }`}>
                  <alert.icon size={20} className="mt-0.5 shrink-0" />
                  <p className="text-sm font-bold leading-tight">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary to-primary-dark p-8 rounded-3xl text-white shadow-xl shadow-primary/20">
            <h4 className="font-display font-bold text-lg mb-2">Platform Health</h4>
            <div className="flex items-center gap-4 mt-6">
              <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white w-[98.7%]"></div>
              </div>
              <span className="font-mono text-sm font-bold text-accent">99.9%</span>
            </div>
            <p className="text-[10px] uppercase font-bold text-white/40 mt-4 tracking-widest">Region: europe-west1</p>
          </div>
        </div>
      </div>

      {/* 4. Recent Schools */}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white">Recently Activated Tenants</h3>
          <button onClick={() => window.location.href='/super/schools'} className="text-primary text-xs font-black uppercase tracking-wider flex items-center gap-2 hover:gap-3 transition-all">
            View All Schools <ArrowUpRight size={18} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest font-black border-b border-slate-50 dark:border-slate-800">
                <th className="px-4 py-4">School Name</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Sub Ends</th>
                <th className="px-4 py-4">Onboarding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {recentSchools.map((school) => (
                <tr key={school.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-4 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-300 dark:text-slate-600 group-hover:scale-110 transition-transform">
                        {school.logo_url ? <img src={school.logo_url} className="w-full h-full object-contain rounded-2xl" /> : <Building2 size={24} />}
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white text-base">{school.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      school.subscription_status?.toLowerCase() === 'active' ? 'bg-accent/10 text-accent-dark' : 
                      school.subscription_status?.toLowerCase() === 'expired' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                    }`}>
                      {school.subscription_status}
                    </span>
                  </td>
                  <td className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400 font-mono font-bold">
                    {school.subscription_end_date ? new Date(school.subscription_end_date).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-4 py-6 text-sm text-slate-400 dark:text-slate-500 font-bold">
                    {new Date(school.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


const StatCard = ({ label, value, icon: Icon, color, trend }: { 
  label: string, 
  value: number, 
  icon: React.ElementType, 
  color: string, 
  trend: string 
}) => (
  <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden group hover:shadow-xl hover:shadow-slate-200 dark:hover:shadow-slate-950 transition-all cursor-default">
    <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 ${color} opacity-[0.05] rounded-full group-hover:scale-125 transition-transform duration-500`}></div>
    <div className="flex items-center gap-6">
      <div className={`${color} text-white p-5 rounded-2xl shadow-lg relative z-10 group-hover:rotate-12 transition-transform`}>
        <Icon size={26} />
      </div>
      <div className="relative z-10">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</p>
        <h4 className="text-3xl font-display font-bold text-slate-900 dark:text-white mt-1">{value}</h4>
      </div>
    </div>
    <div className="mt-6 flex items-center gap-2 text-xs font-bold text-accent">
      <div className="bg-accent/10 p-1.5 rounded-lg">
        <TrendingUp size={14} />
      </div>
      {trend}
    </div>
  </div>
);

export default SuperAdminDashboard;
