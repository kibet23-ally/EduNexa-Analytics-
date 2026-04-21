import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
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

interface PlatformStats {
  totalSchools: number;
  activeSubscriptions: number;
  expiredSchools: number;
  totalStudents: number;
}

interface MonthlyGrowth {
  month: string;
  schools: number;
}

const SuperAdminDashboard = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentSchools, setRecentSchools] = useState<School[]>([]);
  const [growthData, setGrowthData] = useState<MonthlyGrowth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const headers = { 'Authorization': `Bearer ${token}` };
      try {
        const [statsRes, recentRes, growthRes] = await Promise.all([
          fetch('/api/super/stats', { headers }).then(r => r.json()),
          fetch('/api/super/recent-schools', { headers }).then(r => r.json()),
          fetch('/api/super/growth-data', { headers }).then(r => r.json())
        ]);

        setStats(statsRes);
        setRecentSchools(recentRes);
        setGrowthData(growthRes);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const alerts = [
    { type: 'warning', message: '3 School subscriptions expiring this week', icon: Clock },
    { type: 'error', message: '5 Schools have expired subscriptions', icon: AlertTriangle },
    { type: 'info', message: 'New deployment successful in Cluster 2', icon: CheckCircle2 }
  ];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">EduNexa Platform Overview</h1>
        <p className="text-slate-500 mt-2">Operational intelligence for the entire network.</p>
      </header>

      {/* 1. Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Total Schools" 
          value={stats?.totalSchools || 0} 
          icon={Building2} 
          color="bg-blue-500" 
          trend="+12% from last month"
        />
        <StatCard 
          label="Total Students" 
          value={stats?.totalStudents || 0} 
          icon={Users} 
          color="bg-indigo-500" 
          trend="+8.4% from last month"
        />
        <StatCard 
          label="Active Subs" 
          value={stats?.activeSubscriptions || 0} 
          icon={CreditCard} 
          color="bg-emerald-500" 
          trend="92% retention rate"
        />
        <StatCard 
          label="Expired/Risk" 
          value={stats?.expiredSchools || 0} 
          icon={AlertTriangle} 
          color="bg-amber-500" 
          trend="Action required"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 2. Growth Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="text-blue-600" size={24} />
              Platform Growth
            </h3>
            <select className="bg-slate-50 border-none rounded-lg text-sm px-3 py-1 outline-none font-medium">
              <option>Last 12 Months</option>
              <option>Year to Date</option>
            </select>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="schools" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Alerts & Items needing attention */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={24} />
              System Alerts
            </h3>
            <div className="space-y-4">
              {alerts.map((alert, idx) => (
                <div key={idx} className={`p-4 rounded-2xl flex items-start gap-4 ${
                  alert.type === 'warning' ? 'bg-amber-50 text-amber-800' : 
                  alert.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'
                }`}>
                  <alert.icon size={20} className="mt-0.5 shrink-0" />
                  <p className="text-sm font-medium leading-relaxed">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-3xl text-white shadow-xl shadow-blue-200">
            <h4 className="font-bold text-lg mb-2">Platform Health</h4>
            <div className="flex items-center gap-4 mt-6">
              <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white w-[98.7%]"></div>
              </div>
              <span className="font-mono text-sm">99.9%</span>
            </div>
            <p className="text-xs text-blue-200 mt-4 italic">Running optimized in Region: europe-west1</p>
          </div>
        </div>
      </div>

      {/* 4. Recent Schools */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-bold text-slate-900">Recently Activated Tenants</h3>
          <button className="text-blue-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all">
            View All Schools <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 text-xs uppercase tracking-widest font-bold border-b border-slate-50">
                <th className="px-4 py-4">School Name</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Sub Ends</th>
                <th className="px-4 py-4">Onboarding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentSchools.map((school) => (
                <tr key={school.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                        {school.logo_url ? <img src={school.logo_url} className="w-full h-full object-contain rounded-xl" /> : <Building2 size={24} />}
                      </div>
                      <span className="font-bold text-slate-900">{school.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      school.subscription_status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 
                      school.subscription_status === 'Expired' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {school.subscription_status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-500 font-mono">
                    {school.subscription_end_date ? new Date(school.subscription_end_date).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-500">
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
  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group">
    <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 ${color} opacity-[0.03] rounded-full group-hover:scale-110 transition-transform`}></div>
    <div className="flex items-center gap-4">
      <div className={`${color} text-white p-4 rounded-2xl`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{label}</p>
        <h4 className="text-2xl font-black text-slate-900 mt-1">{value}</h4>
      </div>
    </div>
    <div className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-500">
      <div className="bg-emerald-50 p-1 rounded-md">
        <TrendingUp size={14} />
      </div>
      {trend}
    </div>
  </div>
);

export default SuperAdminDashboard;
