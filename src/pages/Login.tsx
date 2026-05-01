import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../useAuth';
import { GraduationCap, Lock, Mail, BarChart3, Building, Zap, Dot } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

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
      // Step 1: Sign in with Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

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

      // Step 5: Check if school is suspended
      if (profile.school_id) {
        const { data: schoolData } = await supabase
          .from('schools')
          .select('subscription_status')
          .eq('id', profile.school_id)
          .maybeSingle();

        const status = (schoolData?.subscription_status || '').toLowerCase();
        if (status === 'suspended') {
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

  return (
    <div className="min-h-screen login-gradient flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <span className="text-accent font-bold tracking-widest text-xs uppercase bg-white/50 backdrop-blur px-3 py-1 rounded-full border border-white/50">
            Welcome Back! 👋
          </span>
          <div className="flex items-center justify-center gap-2 text-primary font-display">
            <GraduationCap size={40} strokeWidth={2.5} />
            <h1 className="text-4xl font-black tracking-tight">EduNexa</h1>
          </div>
          <p className="text-slate-500 font-medium text-sm">Multi-School Management System</p>
          <p className="text-slate-500 text-xs mt-4 max-w-xs mx-auto leading-relaxed">
            Empowering schools with <span className="text-primary font-semibold">smart analytics</span>, seamless management and <span className="text-accent font-semibold">data-driven insights</span> — all in one place.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-white/30 px-2 py-1 rounded-md">
              <BarChart3 size={12} className="text-primary" />
              SMART ANALYTICS
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-white/30 px-2 py-1 rounded-md">
              <Building size={12} className="text-primary" />
              MULTI-SCHOOL
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-white/30 px-2 py-1 rounded-md">
              <Zap size={12} className="text-primary" />
              REAL-TIME DATA
            </div>
          </div>
        </div>

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
