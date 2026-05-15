import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { GraduationCap, Lock, Mail, Phone, ArrowLeft, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';

const ForgotPassword = () => {
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('phone');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'request' | 'otp' | 'success'>('request');
  const [error, setError] = useState('');
  const [otp, setOtp] = useState('');

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (authMethod === 'email') {
        if (!email) throw new Error('Please enter your email address');
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) throw resetError;
        setStep('success');
        toast.success('Reset link sent to your email!');
      } else {
        if (!phone) throw new Error('Please enter your phone number');
        
        let cleanPhone = phone.replace(/\s+/g, '');
        if (cleanPhone.startsWith('0')) {
          cleanPhone = '+254' + cleanPhone.substring(1);
        } else if (!cleanPhone.startsWith('+')) {
          cleanPhone = '+254' + cleanPhone;
        }

        const { error: otpError } = await supabase.auth.signInWithOtp({
          phone: cleanPhone,
        });

        if (otpError) throw otpError;

        setStep('otp');
        toast.success('OTP sent! Please verify to reset your password.');
      }
    } catch (err: any) {
      console.error('Reset password error:', err);
      setError(err.message || 'Failed to process reset request');
      toast.error('Reset request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let cleanPhone = phone.replace(/\s+/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '+254' + cleanPhone.substring(1);
      } else if (!cleanPhone.startsWith('+')) {
        cleanPhone = '+254' + cleanPhone;
      }

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: cleanPhone,
        token: otp,
        type: 'sms',
      });

      if (verifyError || !data.session) throw verifyError || new Error('Verification failed');

      // Once verified, they are signed in. Redirect to reset-password page
      // which will allow them to update their password since they now have a session.
      window.location.href = '/reset-password';
    } catch (err: any) {
      console.error('OTP verify error:', err);
      setError(err.message || 'Invalid verification code');
      toast.error('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen login-gradient flex flex-col items-center justify-center p-4 font-inter">
      <Toaster position="top-right" />
      
      <div className="absolute top-6 left-6">
        <Link to="/login" className="flex items-center gap-2 text-primary font-bold hover:text-primary-dark transition">
          <ArrowLeft size={20} />
          Back to Login
        </Link>
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold tracking-widest text-[10px] uppercase bg-emerald-50 backdrop-blur px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm">
            <Sparkles size={12} />
            Secure Account Recovery
          </span>
          <div className="flex items-center justify-center gap-2 text-primary font-poppins">
            <GraduationCap size={40} strokeWidth={2.5} />
            <h1 className="text-4xl font-black tracking-tight">EduNexa</h1>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Forgot Password?</h2>
          <p className="text-slate-500 text-sm">
            {step === 'otp' 
              ? `We've sent a 6-digit code to your phone. Please enter it below.`
              : authMethod === 'email' 
                ? "Enter your email and we'll send you a link to reset your password."
                : "Enter your phone number and we'll send you an OTP to reset your password."}
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-white p-8 md:p-10">
          {step === 'success' ? (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">Check your Email</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  We've sent a password reset link to <span className="font-bold">{email}</span>. Please check your inbox and spam folder.
                </p>
              </div>
              <Link 
                to="/login"
                className="block w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-primary/20"
              >
                Back to Login
              </Link>
            </div>
          ) : step === 'otp' ? (
            <div className="space-y-6">
              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4 mb-6 animate-shake">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handleVerifyOTP} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 text-center block">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center text-3xl tracking-[1rem] py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all text-primary font-black placeholder:text-slate-200"
                    placeholder="000000"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-[0.98]"
                >
                  {loading ? 'Verifying...' : 'Verify & Continue'}
                </button>

                <button 
                  type="button"
                  onClick={() => setStep('request')}
                  className="w-full text-slate-500 font-bold text-sm hover:text-slate-700 transition"
                >
                  Back to Request
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
                <button 
                  onClick={() => setAuthMethod('phone')}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${authMethod === 'phone' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Phone Number
                </button>
                <button 
                  onClick={() => setAuthMethod('email')}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${authMethod === 'email' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Email Address
                </button>
              </div>

              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4 mb-6 animate-shake">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handleResetRequest} className="space-y-6">
                {authMethod === 'phone' ? (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                      Phone Number
                    </label>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1.5 px-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-600 font-bold text-sm">
                        <span className="text-lg">🇰🇪</span>
                        <span>+254</span>
                      </div>
                      <div className="relative flex-1 group">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={20} />
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all text-slate-700 font-medium"
                          placeholder="712 345 678"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
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
                        placeholder="admin@school.edu"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-[0.98]"
                >
                  {loading ? 'Processing...' : 'Send Reset Instructions'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
