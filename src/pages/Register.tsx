import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { School, User, Mail, Lock, Phone, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';

interface Form {
  schoolName: string;
  adminFullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
}

const EMPTY: Form = {
  schoolName: '', adminFullName: '', email: '',
  password: '', confirmPassword: '', phone: '',
};

function validate(f: Form): string | null {
  if (!f.schoolName.trim())    return 'School name is required.';
  if (!f.adminFullName.trim()) return 'Admin full name is required.';
  if (!f.email.trim())         return 'Email is required.';
  if (!/\S+@\S+\.\S+/.test(f.email)) return 'Please enter a valid email address.';
  if (f.password.length < 8)   return 'Password must be at least 8 characters.';
  if (f.password !== f.confirmPassword) return 'Passwords do not match.';
  return null;
}

export default function Register() {
  const navigate  = useNavigate();
  const [form,     setForm]     = useState<Form>(EMPTY);
  const [showPwd,  setShowPwd]  = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    if (error) setError(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const vErr = validate(form);
    if (vErr) { setError(vErr); return; }

    setLoading(true);
    setError(null);

    try {
      const cleanEmail = form.email.trim().toLowerCase();

      // Step 1: Create auth user
      // emailRedirectTo is not set so email confirmation is not required
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email:    cleanEmail,
        password: form.password,
        options: {
          data: {
            full_name: form.adminFullName.trim(),
            role:      'school_admin',
          },
        },
      });

      if (authError) {
        if (authError.message.toLowerCase().includes('already registered')) {
          setError('An account with this email already exists.');
        } else {
          setError(authError.message);
        }
        return;
      }

      if (!authData.user) {
        setError('Failed to create account. Please try again.');
        return;
      }

      const userId = authData.user.id;

      // Step 2: Insert school — anon INSERT policy allows this
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      const { data: schoolData, error: schoolError } = await supabase
        .from('schools')
        .insert({
          name:                form.schoolName.trim(),
          email:               cleanEmail,
          phone:               form.phone.trim() || null,
          status:              'pending',
          subscription_status: 'trial',
          expiry_date:         expiryDate.toISOString(),
          admin_name:          form.adminFullName.trim(),
          admin_id:            userId,
        })
        .select('id')
        .single();

      if (schoolError) {
        if (schoolError.message.includes('unique') || schoolError.message.includes('duplicate')) {
          setError('A school with this email is already registered.');
        } else {
          setError(schoolError.message);
        }
        return;
      }

      // Step 3: Insert user row — uses anon INSERT policy
      // (auth.uid() may be null before email confirmation, policy allows it)
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id:        userId,
          auth_id:   userId,
          name:      form.adminFullName.trim(),
          email:     cleanEmail,
          role:      'school_admin',
          school_id: schoolData.id,
        });

      if (userError && !userError.message.includes('duplicate')) {
        // Non-fatal — the handle_new_user trigger may have already
        // created the row. We'll update it instead.
        await supabase
          .from('users')
          .update({
            name:      form.adminFullName.trim(),
            role:      'school_admin',
            school_id: schoolData.id,
          })
          .eq('id', userId);
      }

      // Step 4: Notify super admin (fire and forget)
      fetch('/api/notify-registration', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: form.schoolName,
          adminName:  form.adminFullName,
          email:      cleanEmail,
          phone:      form.phone,
        }),
      }).catch(console.error);

      setSuccess(true);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Success screen ───────────────────────────────────── */
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-10 text-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-100">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Registration Submitted!</h2>
            <p className="text-slate-500 leading-relaxed mb-6">
              <span className="text-slate-800 font-semibold">{form.schoolName}</span> has been
              registered. Our team will review your application and notify you at{' '}
              <span className="text-slate-800">{form.email}</span> once approved.
            </p>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-8">
              <p className="text-amber-700 text-sm">
                ⏳ Review typically takes 1–2 business days.
              </p>
            </div>
            <Link to="/login"
              className="flex items-center justify-center w-full py-3 px-6 rounded-xl bg-primary text-white font-bold hover:bg-primary-dark transition-all">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Registration form ────────────────────────────────── */
  return (
    <div className="min-h-screen login-gradient flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-black text-slate-900">Register Your School</h1>
          <p className="text-slate-500 mt-1 text-sm">Start your 30-day free trial — no credit card required.</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-white p-8">

          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4 mb-6">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4" noValidate>

            {/* School Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">School Name *</label>
              <div className="relative group">
                <School className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={18} />
                <input type="text" name="schoolName" value={form.schoolName} onChange={onChange}
                  placeholder="Westfield Academy" disabled={loading} required
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all text-slate-700 font-medium" />
              </div>
            </div>

            {/* Admin Full Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Admin Full Name *</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={18} />
                <input type="text" name="adminFullName" value={form.adminFullName} onChange={onChange}
                  placeholder="Jane Doe" disabled={loading} required
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all text-slate-700 font-medium" />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Email Address *</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={18} />
                <input type="email" name="email" value={form.email} onChange={onChange}
                  placeholder="admin@school.edu" disabled={loading} required autoComplete="email"
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all text-slate-700 font-medium" />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Phone Number</label>
              <div className="relative group">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={18} />
                <input type="tel" name="phone" value={form.phone} onChange={onChange}
                  placeholder="+254 712 345 678" disabled={loading}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all text-slate-700 font-medium" />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Password *</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={18} />
                <input type={showPwd ? 'text' : 'password'} name="password" value={form.password}
                  onChange={onChange} placeholder="Min. 8 characters" disabled={loading} required autoComplete="new-password"
                  className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all text-slate-700 font-medium" />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Confirm Password *</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={18} />
                <input type={showConf ? 'text' : 'password'} name="confirmPassword" value={form.confirmPassword}
                  onChange={onChange} placeholder="Repeat password" disabled={loading} required autoComplete="new-password"
                  className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all text-slate-700 font-medium" />
                <button type="button" onClick={() => setShowConf(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showConf ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-red-500 text-xs mt-1 ml-1">Passwords do not match</p>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-[0.98] mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Registering school…
                </span>
              ) : 'Register School'}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:text-primary-dark font-bold transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-slate-400 text-xs">
          By registering you agree to EduNexa's Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
