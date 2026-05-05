'use client';
// src/app/register/page.tsx

import { useState } from 'react';
import Link from 'next/link';
import {
  School, User, Mail, Lock, Phone,
  Eye, EyeOff, CheckCircle2, AlertCircle,
} from 'lucide-react';

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

export default function RegisterPage() {
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
      const res = await fetch('/api/register-school', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName:    form.schoolName,
          adminFullName: form.adminFullName,
          email:         form.email,
          password:      form.password,
          phone:         form.phone,
        }),
      });

      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Registration failed. Please try again.'); return; }
      setSuccess(true);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Success ────────────────────────────────────────────── */
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
        <div className="w-full max-w-md animate-fadeIn">
          <div className="glass-card rounded-2xl p-10 text-center">
            <div className="w-20 h-20 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="font-display text-2xl font-bold text-white mb-3">
              Registration Submitted!
            </h2>
            <p className="text-slate-400 leading-relaxed mb-6">
              <span className="text-slate-200 font-medium">{form.schoolName}</span> has
              been registered. Our team will review your application and notify you at{' '}
              <span className="text-slate-200">{form.email}</span> once approved.
            </p>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-8">
              <p className="text-amber-400 text-sm">
                ⏳ Review typically takes 1–2 business days.
              </p>
            </div>
            <Link href="/login" className="edu-btn-primary inline-flex justify-center">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Form ───────────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex bg-slate-950">

      {/* Left branding panel — desktop only */}
      <aside className="hidden lg:flex flex-col justify-between w-2/5 p-12
                        bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/30
                        border-r border-slate-800">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="text-slate-900 font-bold text-lg">E</span>
            </div>
            <span className="font-display text-2xl font-bold text-white">EduNexa</span>
          </div>
          <h1 className="font-display text-4xl font-bold text-white leading-tight mb-6">
            Bring your school<br />
            <span className="text-gold-gradient">into the future.</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Join schools already using EduNexa to manage students, staff, exams,
            and communications — all in one place.
          </p>
        </div>
        <div className="space-y-3">
          {[
            { icon: '🎓', label: 'Student Management', desc: 'Enrol, track, and report' },
            { icon: '📊', label: 'Analytics Dashboard', desc: 'Real-time insights' },
            { icon: '💳', label: 'Flexible Billing',    desc: 'Pay per term or annually' },
          ].map(item => (
            <div key={item.label}
              className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <span className="text-2xl">{item.icon}</span>
              <div>
                <p className="text-slate-200 font-medium text-sm">{item.label}</p>
                <p className="text-slate-500 text-xs">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Right form panel */}
      <main className="flex-1 flex items-start justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-md py-8 animate-fadeIn">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center">
              <span className="text-slate-900 font-bold">E</span>
            </div>
            <span className="font-display text-xl font-bold text-white">EduNexa</span>
          </div>

          <div className="mb-8">
            <h2 className="font-display text-3xl font-bold text-white mb-2">
              Register Your School
            </h2>
            <p className="text-slate-400">
              Start your 30-day free trial — no credit card required.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20
                            rounded-xl p-4 mb-6">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5" noValidate>

            {/* School Name */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                School Name <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <School className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input type="text" name="schoolName" value={form.schoolName}
                  onChange={onChange} placeholder="Westfield Academy"
                  className="edu-input pl-10" disabled={loading} required />
              </div>
            </div>

            {/* Admin Name */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Admin Full Name <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input type="text" name="adminFullName" value={form.adminFullName}
                  onChange={onChange} placeholder="Jane Doe"
                  className="edu-input pl-10" disabled={loading} required />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Email Address <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input type="email" name="email" value={form.email}
                  onChange={onChange} placeholder="admin@school.edu"
                  className="edu-input pl-10" disabled={loading} required autoComplete="email" />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input type="tel" name="phone" value={form.phone}
                  onChange={onChange} placeholder="+254 712 345 678"
                  className="edu-input pl-10" disabled={loading} />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Password <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input type={showPwd ? 'text' : 'password'} name="password"
                  value={form.password} onChange={onChange}
                  placeholder="Min. 8 characters" className="edu-input pl-10 pr-12"
                  disabled={loading} required autoComplete="new-password" />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Confirm Password <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input type={showConf ? 'text' : 'password'} name="confirmPassword"
                  value={form.confirmPassword} onChange={onChange}
                  placeholder="Repeat password" className="edu-input pl-10 pr-12"
                  disabled={loading} required autoComplete="new-password" />
                <button type="button" onClick={() => setShowConf(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-red-400 text-xs mt-1.5 ml-1">Passwords do not match</p>
              )}
            </div>

            <button type="submit" className="edu-btn-primary !mt-6" disabled={loading}>
              {loading
                ? <><span className="spinner" /> Registering school…</>
                : 'Register School'
              }
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-6">
            Already have an account?{' '}
            <Link href="/login"
              className="text-amber-400 hover:text-amber-300 transition-colors font-medium">
              Sign in
            </Link>
          </p>
          <p className="text-center text-slate-600 text-xs mt-3">
            By registering you agree to EduNexa&apos;s Terms of Service and Privacy Policy.
          </p>
        </div>
      </main>
    </div>
  );
}
