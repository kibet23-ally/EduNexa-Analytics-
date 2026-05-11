'use client';
// src/app/login/page.tsx

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw new Error(signInError.message);
      if (!data.user) throw new Error('Login failed. Please try again.');

      // Fetch user row to determine where to redirect
      const { data: userRow } = await supabase
        .from('users')
        .select('role, school_id')
        .eq('auth_id', data.user.id)
        .single();

      if (userRow?.role === 'super_admin') {
        router.push('/admin');
        return;
      }

      if (!userRow?.school_id) {
        router.push('/awaiting-approval');
        return;
      }

      // Fetch school status
      const { data: school } = await supabase
        .from('schools')
        .select('status')
        .eq('id', userRow.school_id)
        .single();

      if (school?.status === 'pending')        router.push('/awaiting-approval');
      else if (school?.status === 'suspended') router.push('/account-suspended');
      else                                     router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative animate-fadeIn">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
            <span className="text-slate-900 font-display font-bold text-2xl">E</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-white">EduNexa</h1>
          <p className="text-slate-400 mt-1">School Management Platform</p>
        </div>

        <div className="glass-card rounded-2xl p-8">
          <h2 className="font-display text-xl font-bold text-white mb-6">Welcome back</h2>

          {error && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-5">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(null); }}
                  placeholder="admin@school.edu"
                  className="edu-input pl-10"
                  disabled={loading}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  placeholder="Your password"
                  className="edu-input pl-10 pr-12"
                  disabled={loading}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" className="edu-btn-primary mt-2" disabled={loading}>
              {loading ? (
                <><span className="spinner" /> Signing in...</>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-slate-800/70 px-3 text-slate-500 text-xs uppercase tracking-wider">
                New to EduNexa?
              </span>
            </div>
          </div>

          <Link
            href="/register"
            className="flex items-center justify-center w-full py-3 px-6 rounded-xl
                       border border-amber-500/40 text-amber-400 font-semibold text-sm
                       hover:bg-amber-500/10 hover:border-amber-500/70
                       transition-all duration-200"
          >
            Register Your School
          </Link>
        </div>
      </div>
    </div>
  );
}