import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../useAuth';
import { GraduationCap, Lock, Mail, BarChart3, Building, Zap, Dot, Building2, Users, CreditCard, AlertTriangle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { School } from '../types';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // System details state
  const [systemStats, setSystemStats] = useState<{
    totalSchools: number;
    totalStudents: number;
    activeSubscriptions: number;
    expiredSchools: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch system statistics for the landing page
  useEffect(() => {
    const fetchSystemStats = async () => {
      try {
        // Fetch all schools
        const { data: schoolsData, error: schoolsError } = await supabase
          .from('schools')
          .select('id, subscription_status, created_at');

        if (schoolsError) throw schoolsError;

        // Fetch total students count
        const { count: studentsCount, error: studentsError } = await supabase
          .from('students')
          .select('id', { count: 'exact', head: true });

        if (studentsError) throw studentsError;

        const schools = schoolsData as School[] || [];
        setSystemStats({
          totalSchools: schools.length,
          totalStudents: studentsCount || 0,
          activeSubscriptions: schools.filter(s => s.subscription_status?.toLowerCase() === 'active').length,
          expiredSchools: schools.filter(s => s.subscription_status?.toLowerCase() === 'expired').length,
        });
      } catch (err) {
        console.error('Error fetching system stats:', err);
        // Set default stats if fetch fails
        setSystemStats({
          totalSchools: 0,
          totalStudents: 0,
          activeSubscriptions: 0,
          expiredSchools: 0,
        });
      } finally {
        setStatsLoading(false);
      }
    };

    fetchSystemStats();
  }, []);

  const redirectBasedOnRole = (rawRole: string) => {
    const role = (rawRole || '').toLowerCase().replace(/_/g, '');
    if (role === 'superadmin') {
      navigate('/super-admin');
    } else if (role === 'admin' || role === 'schooladmin') {
      navigate('/school-admin');
    } else if (role === 'teacher') {
      navigate('/teacher');
    } else {
      navigate('/');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanEmail = email.toLowerCase().trim();

    try {
      // Step 1: Sign in with timeout to prevent hanging on mobile
      const authPromise = supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Login timed out. Please check your connection and try again.')), 10000)
      );

      const { data, error: authError } = await Promise.race([
        authPromise,
        timeoutPromise
      ]) as Awaited<typeof authPromise>;

      if (authError || !data.session || !data.user) {
        throw new Error(authError?.message || 'Invalid email or password');
      }

      const session = data.session;
      const authUser = data.user;

      // Step 2: Fetch user profile from users table
      let profile = null;
      const { data: userData } = await supabase
        .from('users')
        .select('id, role, name, school_id, email')
        .eq('id', authUser.id)
        .maybeSingle();

      profile = userData;

      // Step 3: Fallback to teachers table if not in users
      if (!profile) {
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('id, role, name, school_id, email')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (teacherData) {
          // Auto-provision into users table
          const role = teacherData.role === 'Admin' ? 'school_admin'
            : teacherData.role === 'SuperAdmin' ? 'super_admin'
            : 'teacher';

          const { data: newProfile } = await supabase
            .from('users')
            .upsert({
              id: authUser.id,
              email: cleanEmail,
              name: teacherData.name,
              role,
              school_id: teacherData.school_id,
            })
            .select()
            .maybeSingle();

          profile = newProfile || {
            id: authUser.id,
            email: cleanEmail,
            name: teacherData.name,
            role,
            school_id: teacherData.school_id,
          };
        }
      }

      // Step 4: Final fallback to auth metadata
      if (!profile) {
        profile = {
          id: authUser.id,
          email: cleanEmail,
          name: authUser.user_metadata?.name || cleanEmail.split('@')[0],
          role: authUser.user_metadata?.role || 'school_admin',
          school_id: authUser.user_metadata?.school_id || null,
        };
      }

      // Step 5: Check school status (pending / suspended)
      if (profile.school_id) {
        const { data: schoolData } = await supabase
          .from('schools')
          .select('status, subscription_status')
          .eq('id', profile.school_id)
          .maybeSingle();

        // Pending approval — redirect without logging in
        if (schoolData?.status === 'pending') {
          await supabase.auth.signOut();
          navigate('/awaiting-approval');
          return;
        }

        // Suspended
        const subStatus = (schoolData?.subscription_status || '').toLowerCase();
        if (schoolData?.status === 'suspended' || subStatus === 'suspended') {
          await supabase.auth.signOut();
          throw new Error('Your school account is currently suspended. Please contact your administrator.');
        }
      }

      // Step 6: Login and redirect
      const fullUser = {
        ...authUser,
        ...profile,
        role: profile.role,
        name: profile.name,
        school_id: profile.school_id,
      };

      login(session.access_token, fullUser);
      redirectBasedOnRole(profile.role);

    } catch (err: unknown) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const alerts = [
    { type: 'info', message: 'Platform running at 99.9% uptime', icon: CheckCircle2 },
    { type: 'warning', message: 'System optimized for peak performance', icon: Zap },
    { type: 'info', message: 'Serving schools across Kenya 🇰🇪', icon: Building },
  ];

  const StatCard = ({ label, value, icon: Icon, color, trend }: {
    label: string; value: number; icon: React.ElementType; color: string; trend: string;
  }) => (
    <div className="bg-white/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/50 relative overflow-hidden group hover:shadow-xl transition-all">
      <div className={`absolute top-0 right-0 w-24 h-24 -mr-6 -mt-6 ${color} opacity-[0.08] rounded-full group-hover:scale-125 transition-transform duration-500`} />
      <div className="flex items-center gap-4 relative z-10">
        <div className={`${color} text-white p-3 rounded-xl shadow-lg`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
          <h4 className="text-2xl font-display font-bold text-slate-900 mt-1">{value}</h4>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs font-bold text-accent">
        <div className="bg-accent/10 p-1 rounded-lg"><TrendingUp size={12} /></div>
        {trend}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen login-gradient flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-6xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <span className="text-accent font-bold tracking-widest text-xs uppercase bg-white/50 backdrop-blur px-3 py-1 rounded-full border border-white/50">
            Welcome to EduNexa 👋
          </span>
          <div className="flex items-center justify-center gap-2 text-primary font-display">
            <GraduationCap size={40} strokeWidth={2.5} />
            <h1 className="text-4xl font-black tracking-tight">EduNexa</h1>
          </div>
          <p className="text-slate-500 font-medium text-sm">Multi-School Management System</p>
          <p className="text-slate-500 text-xs mt-4 max-w-2xl mx-auto leading-relaxed">
            Empowering schools with <span className="text-primary font-semibold">smart analytics</span>, seamless management and <span className="text-accent font-semibold">data-driven insights</span> — all in one place.
          </p>
        </div>

        {/* System Details Section */}
        {!statsLoading && systemStats && (
          <div className="space-y-6 animate-in fade-in duration-700">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard 
                label="Active Schools" 
                value={systemStats.totalSchools} 
                icon={Building2} 
                color="bg-primary" 
                trend="Growing network" 
              />
              <StatCard 
                label="Total Students" 
                value={systemStats.totalStudents} 
                icon={Users} 
                color="bg-accent" 
                trend="Across platform" 
              />
              <StatCard 
                label="Active Subscriptions" 
                value={systemStats.activeSubscriptions} 
                icon={CreditCard} 
                color="bg-primary" 
                trend="Premium tier" 
              />
              <StatCard 
                label="System Health" 
                value={99} 
                icon={CheckCircle2} 
                color="bg-green-600" 
                trend="Uptime %" 
              />
            </div>

            {/* Platform Alerts */}
            <div className="bg-white/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/50">
              <h3 className="text-sm font-display font-bold text-slate-900 mb-4 flex items-center gap-2">
                <AlertTriangle size={18} className="text-accent" /> Platform Status
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {alerts.map((alert, idx) => (
                  <div key={idx} className={`p-4 rounded-xl flex items-start gap-3 ${
                    alert.type === 'warning' ? 'bg-amber-50 text-amber-800' :
                    alert.type === 'error' ? 'bg-red-50 text-red-800' :
                    'bg-primary/5 text-primary'
                  }`}>
                    <alert.icon size={16} className="mt-0.5 shrink-0" />
                    <p className="text-xs font-bold leading-tight">{alert.message}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Features Highlight */}
            <div className="bg-white/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/50">
              <h3 className="text-sm font-display font-bold text-slate-900 mb-4">Why Choose EduNexa?</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg shrink-0"><BarChart3 size={18} className="text-primary" /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Smart Analytics</p>
                    <p className="text-[11px] text-slate-600 mt-1">Data-driven insights for better decision making</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-accent/10 p-2 rounded-lg shrink-0"><Building size={18} className="text-accent" /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Multi-School Support</p>
                    <p className="text-[11px] text-slate-600 mt-1">Manage multiple institutions seamlessly</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-green-600/10 p-2 rounded-lg shrink-0"><Zap size={18} className="text-green-600" /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Real-Time Data</p>
                    <p className="text-[11px] text-slate-600 mt-1">Live updates and instant synchronization</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Login Form Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-white p-8 md:p-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 animate-shake">
                <p className="font-bold">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                Email Address
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={20} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all text-slate-700 font-medium"
                  placeholder="teacher@school.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={20} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all text-slate-700 font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white/80 px-3 text-slate-400 text-xs font-bold uppercase tracking-wider">
                New to EduNexa?
              </span>
            </div>
          </div>

          {/* Register button */}
          <Link
            to="/register"
            className="flex items-center justify-center w-full py-4 px-6 rounded-2xl
                       border-2 border-primary/20 text-primary font-bold text-sm
                       hover:bg-primary/5 hover:border-primary/40
                       transition-all duration-200 active:scale-[0.98]"
          >
            Register Your School
          </Link>
        </div>

        <div className="text-center space-y-4">
          <p className="text-[10px] items-center justify-center gap-1 font-bold text-slate-400 uppercase tracking-widest flex">
            Trusted by schools across Kenya 🇰🇪
          </p>
          <div className="text-[10px] text-slate-400/50 flex items-center justify-center gap-2">
            <span>v1.5.0</span>
            <Dot size={8} />
            <span>EduNexa Platform Services</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;