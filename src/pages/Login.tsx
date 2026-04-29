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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanEmail = email.toLowerCase().trim();

    try {
      // 1. Try standard Supabase Auth first
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password
      });

      if (!authError && data.session && data.user) {
        console.log("LOGIN: Auth success, fetching profile...");
        const session = data.session;
        const user = data.user;

        // Fetch the user role from users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role, name, school_id')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (userError) throw userError;
        
        let profile = userData;

        // Check if school is suspended (DIRECT QUERY for reliability)
        if (profile?.school_id) {
          const { data: schoolData } = await supabase
            .from('schools')
            .select('subscription_status')
            .eq('id', profile.school_id)
            .maybeSingle();

          const schoolStatus = (schoolData?.subscription_status || '').toLowerCase();
          
          if (schoolStatus === 'suspended') {
            await supabase.auth.signOut();
            throw new Error('Your school account is currently suspended. Please contact your administrator.');
          }
        }

        // FALLBACK: Auto-provision if missing from users table
        if (!profile) {
          const { data: teacherData } = await supabase
            .from('teachers')
            .select('role, name, school_id')
            .ilike('email', cleanEmail)
            .maybeSingle();

          const role = teacherData?.role || user.user_metadata?.role || 'Admin';
          const name = teacherData?.name || user.user_metadata?.name || email.split('@')[0];
          const school_id = teacherData?.school_id || user.user_metadata?.school_id || null;

          // Check if school is suspended here too
          if (school_id) {
            const { data: schoolData } = await supabase
              .from('schools')
              .select('subscription_status')
              .eq('id', school_id)
              .maybeSingle();

            const schoolStatus = (schoolData?.subscription_status || '').toLowerCase();
            
            if (schoolStatus === 'suspended') {
              await supabase.auth.signOut();
              throw new Error('Your school account is currently suspended. Please contact your administrator.');
            }
          }

          const { data: newProfile } = await supabase
            .from('users')
            .insert([{ id: user.id, email: cleanEmail, role, name, school_id }])
            .select()
            .maybeSingle();

          profile = newProfile || { role, name, school_id };
        }

        const fullUser = { ...user, ...profile, role: profile.role, name: profile.name, school_id: profile.school_id };
        login(session.access_token, fullUser);
        redirectBasedOnRole(profile.role);
        return;
      }

      // 2. Fallback: Check server-side for 'teachers' table (bypasses direct RLS issues)
      console.log("LOGIN: Auth failed or skipped, checking via server proxy...");
      const response = await fetch('/api/auth/teacher-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log("LOGIN: Teacher authenticated via server!");
        login(result.token, result.user);
        redirectBasedOnRole(result.user.role);
      } else {
        throw new Error(result.error || authError?.message || 'Invalid email or password');
      }
    } catch (err: unknown) {
      console.error("Login catch block:", err);
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const redirectBasedOnRole = (rawRole: string) => {
    const role = (rawRole || '').toLowerCase();
    if (role === 'super_admin' || role === 'superadmin') {
      navigate('/super-admin');
    } else if (role === 'admin' || role === 'school_admin' || role === 'schooladmin') {
      navigate('/school-admin');
    } else if (role === 'teacher') {
      navigate('/teacher');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen login-gradient flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Branding & Welcome */}
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

          {/* Feature Highlights */}
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
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 space-y-3 animate-shake">
                <p className="font-bold">{error}</p>
                {(error.includes("API key") || error.includes("configured")) && (
                  <button 
                    type="button"
                    onClick={() => navigate('/status')}
                    className="w-full bg-red-100 hover:bg-red-200 text-red-700 py-2 rounded-lg font-bold transition-all text-xs"
                  >
                    View System Diagnostic Page
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Email Address</label>
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
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Password</label>
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

        {/* Footer */}
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
