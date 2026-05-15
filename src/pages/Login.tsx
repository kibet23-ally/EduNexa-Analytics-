import React, { useState, useEffect } from 'react';  
import { useNavigate, Link } from 'react-router-dom';  
import { useAuth } from '../useAuth';  
import { GraduationCap, Lock, Mail, Dot, ArrowLeft, Phone, ChevronDown, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';  
import { supabase } from '../lib/supabase';  
import { toast, Toaster } from 'react-hot-toast';  
  
const Login = () => {  
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('phone');  
  const [email, setEmail] = useState('');  
  const [password, setPassword] = useState('');  
  const [phone, setPhone] = useState('');  
  const [otp, setOtp] = useState('');  
  const [step, setStep] = useState<'login' | 'otp' | 'forgot'>('login');  
  const [error, setError] = useState('');  
  const [loading, setLoading] = useState(false);  
  const [forgotEmail, setForgotEmail] = useState('');  
  const [forgotSent, setForgotSent] = useState(false);  
  const [resendTimer, setResendTimer] = useState(0);  
  
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
      navigate('/dashboard');  
    }  
  };  
  
  const handleEmailLogin = async (e: React.FormEvent) => {  
    e.preventDefault();  
    setLoading(true);  
    setError('');  
  
    try {  
      const cleanEmail = email.toLowerCase().trim();  
      const { data, error: authError } = await supabase.auth.signInWithPassword({  
        email: cleanEmail,  
        password,  
      });  
  
      if (authError || !data.session || !data.user) {  
        throw new Error(authError?.message || 'Invalid email or password');  
      }  
  
      await completeLogin(data.session, data.user);  
    } catch (err: any) {  
      console.error('Login error:', err);  
      setError(err.message || 'Login failed. Please try again.');  
      toast.error(err.message || 'Login failed');  
    } finally {  
      setLoading(false);  
    }  
  };  
  
  const handlePhoneLogin = async (e: React.FormEvent) => {  
    e.preventDefault();  
    setLoading(true);  
    setError('');  
  
    try {  
      // Validate phone format (Kenya +254)  
      let cleanPhone = phone.replace(/\s+/g, '');  
      if (cleanPhone.startsWith('0')) {  
        cleanPhone = '+254' + cleanPhone.substring(1);  
      } else if (!cleanPhone.startsWith('+')) {  
        cleanPhone = '+254' + cleanPhone;  
      }  
  
      const { data, error: authError } = await supabase.auth.signInWithPassword({  
        phone: cleanPhone,  
        password,  
      });  
  
      if (authError || !data.session || !data.user) {  
        throw new Error(authError?.message || 'Invalid phone number or password');  
      }  
  
      await completeLogin(data.session, data.user);  
    } catch (err: any) {  
      console.error('Phone login error:', err);  
      setError(err.message || 'Login failed. Please try again.');  
      toast.error(err.message || 'Login failed');  
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
  
      if (verifyError || !data.session || !data.user) {  
        throw new Error(verifyError?.message || 'Invalid OTP. Please try again.');  
      }  
  
      await completeLogin(data.session, data.user);  
    } catch (err: any) {  
      console.error('OTP verify error:', err);  
      setError(err.message || 'Invalid OTP');  
      toast.error('Invalid OTP');  
    } finally {  
      setLoading(false);  
    }  
  };  
  
  const handleForgotPassword = async (e: React.FormEvent) => {  
    e.preventDefault();  
    setLoading(true);  
    setError('');  
  
    try {  
      if (authMethod === 'email') {  
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail, {  
          redirectTo: `${window.location.origin}/reset-password`,  
        });  
        if (resetError) throw resetError;  
        setForgotSent(true);  
        toast.success('Reset link sent to your email!');  
      } else {  
        // Phone reset: Supabase doesn't have a direct "resetPasswordForPhone"   
        // that works like email. Usually, we use OTP to sign in, then they   
        // can change password in settings. For a full "Forgot Password"   
        // with phone, we send OTP and then redirect to reset.  
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
        setResendTimer(60);  
        toast.success('OTP sent! Verify to reset your password.');  
      }  
    } catch (err: any) {  
      console.error('Reset password error:', err);  
      setError(err.message || 'Failed to process reset request');  
      toast.error('Reset request failed');  
    } finally {  
      setLoading(false);  
    }  
  };  
  
  const completeLogin = async (session: any, authUser: any) => {  
    // 1. Try to get profile from users table  
    const { data: profile } = await supabase  
      .from('users')  
      .select('id, role, name, school_id, email, phone')  
      .or(`id.eq.${authUser.id},phone.eq.${authUser.phone || 'none'}`)  
      .maybeSingle();  
  
    let finalProfile = profile;  
  
    // 2. If not found, check if it's a teacher/admin from the teachers table  
    if (!finalProfile) {  
      const emailToSearch = authUser.email || '';  
      const phoneToSearch = authUser.phone || '';  
  
      let query = supabase.from('teachers').select('id, role, name, school_id, email, phone');  
      if (emailToSearch && phoneToSearch) {  
        query = query.or(`email.ilike.${emailToSearch},phone.eq.${phoneToSearch}`);  
      } else if (emailToSearch) {  
        query = query.ilike('email', emailToSearch);  
      } else if (phoneToSearch) {  
        query = query.eq('phone', phoneToSearch);  
      } else {  
        // No identifiers available  
        query = query.eq('id', '00000000-0000-0000-0000-000000000000');  
      }  
  
      const { data: teacherData } = await query.maybeSingle();  
  
      if (teacherData) {  
        const role = teacherData.role === 'Admin' ? 'school_admin'   
                   : teacherData.role === 'SuperAdmin' ? 'super_admin'   
                   : 'teacher';  
  
        const { data: newProfile } = await supabase  
          .from('users')  
          .upsert({  
            id: authUser.id,  
            email: emailToSearch || null,  
            phone: phoneToSearch || null,  
            name: teacherData.name,  
            role,  
            school_id: teacherData.school_id,  
          })  
          .select()  
          .maybeSingle();  
  
        finalProfile = newProfile || {  
          id: authUser.id,  
          email: emailToSearch,  
          phone: phoneToSearch,  
          name: teacherData.name,  
          role,  
          school_id: teacherData.school_id,  
        };  
      }  
    }  
  
    // 3. Fallback for new signups  
    if (!finalProfile) {  
      finalProfile = {  
        id: authUser.id,  
        email: authUser.email || '',  
        name: authUser.user_metadata?.name || 'User',  
        role: authUser.user_metadata?.role || 'school_admin',  
        school_id: authUser.user_metadata?.school_id || null,  
      };  
    }  
  
    // 4. Check school status if applicable  
    if (finalProfile.school_id) {  
      const { data: schoolData } = await supabase  
        .from('schools')  
        .select('status, subscription_status')  
        .eq('id', finalProfile.school_id)  
        .maybeSingle();  
  
      if (schoolData?.status === 'pending') {  
        await supabase.auth.signOut();  
        navigate('/awaiting-approval');  
        return;  
      }  
  
      if (schoolData?.status === 'suspended' || schoolData?.subscription_status === 'suspended') {  
        await supabase.auth.signOut();  
        throw new Error('Your school account is currently suspended. Please contact your administrator.');  
      }  
    }  
  
    const fullUser = {  
      ...authUser,  
      ...finalProfile,  
      role: finalProfile.role as any,  
    };  
  
    login(session.access_token, fullUser);  
    toast.success(`Welcome back, ${finalProfile.name}!`);  
    redirectBasedOnRole(finalProfile.role);  
  };  
  
  return (  
    <div className="min-h-screen login-gradient flex flex-col items-center justify-center p-4 font-inter">  
      <Toaster position="top-right" />  
  
      {/* Back to Home Button */}  
      <div className="absolute top-6 left-6">  
        <Link to="/" className="flex items-center gap-2 text-primary font-bold hover:text-primary-dark transition">  
          <ArrowLeft size={20} />  
          Back to Home  
        </Link>  
      </div>  
  
      <div className="w-full max-w-md space-y-8">  
        {/* Header */}  
        <div className="text-center space-y-2">  
          <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold tracking-widest text-[10px] uppercase bg-emerald-50 backdrop-blur px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm">  
            <Sparkles size={12} />  
            Enterprise Grade Platform  
          </span>  
          <div className="flex items-center justify-center gap-2 text-primary font-poppins">  
            <GraduationCap size={40} strokeWidth={2.5} />  
            <h1 className="text-4xl font-black tracking-tight">EduNexa</h1>  
          </div>  
          <p className="text-slate-500 font-medium text-sm">Multi-School Management System</p>  
        </div>  
  
        {/* Auth Card */}  
        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-white p-8 md:p-10 transition-all duration-500">  
  
          {step === 'login' && (  
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
                  Email & Password  
                </button>  
              </div>  
  
              {error && (  
                <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4 mb-6 animate-shake">  
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />  
                  <p className="text-red-700 text-sm font-medium">{error}</p>  
                </div>  
              )}  
  
              <form onSubmit={authMethod === 'phone' ? handlePhoneLogin : handleEmailLogin} className="space-y-6">  
                {authMethod === 'phone' ? (  
                  <div className="space-y-2">  
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">  
                      Phone Number  
                    </label>  
                    <div className="flex gap-2">  
                      <div className="flex items-center gap-1.5 px-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-600 font-bold text-sm">  
                        <span className="text-lg">🇰🇪</span>  
                        <span>+254</span>  
                        <ChevronDown size={14} className="text-slate-400" />  
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
  
                <div className="space-y-2">  
                  <div className="flex items-center justify-between ml-1">  
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">  
                      Password  
                    </label>  
                    <button   
                      type="button"  
                      onClick={() => setStep('forgot')}  
                      className="text-[10px] font-bold text-primary hover:text-primary-dark transition-colors uppercase tracking-widest"  
                    >  
                      Forgot Password?  
                    </button>  
                  </div>  
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
                  {loading ? 'Authenticating...' : 'Login'}  
                </button>  
              </form>  
            </>  
          )}  
  
          {step === 'otp' && (  
            <div className="space-y-6">  
              <div className="text-center space-y-2 mb-4">  
                <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/10">  
                  <Phone className="text-primary" size={28} />  
                </div>  
                <h3 className="text-xl font-bold text-slate-900">Verify Your Phone</h3>  
                <p className="text-slate-500 text-sm">We've sent a 6-digit code to <span className="text-slate-900 font-bold">{phone}</span></p>  
              </div>  
  
              {error && (  
                <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4 animate-shake">  
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
                  {loading ? 'Verifying...' : 'Verify & Login'}  
                </button>  
  
                <div className="flex flex-col gap-3">  
                  <button   
                    type="button"  
                    disabled={resendTimer > 0 || loading}  
                    onClick={handleSendOTP}  
                    className="w-full text-primary font-bold text-sm hover:text-primary-dark transition disabled:opacity-50"  
                  >  
                    {resendTimer > 0 ? `Resend Code in ${resendTimer}s` : "Didn't receive code? Resend"}  
                  </button>  
                  <button   
                    type="button"  
                    onClick={() => setStep('login')}  
                    className="w-full text-slate-500 font-bold text-sm hover:text-slate-700 transition"  
                  >  
                    Change Phone Number  
                  </button>  
                </div>  
              </form>  
            </div>  
          )}  
  
          {step === 'forgot' && (  
            <div className="space-y-6">  
              <div className="text-center space-y-2 mb-4">  
                <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/10">  
                  <Lock className="text-primary" size={28} />  
                </div>  
                <h3 className="text-xl font-bold text-slate-900">Forgot Password?</h3>  
                <p className="text-slate-500 text-sm">  
                  {authMethod === 'email'   
                    ? "Enter your email and we'll send you a link to reset your password."  
                    : "Enter your phone number and we'll send you an OTP to reset your password."}  
                </p>  
              </div>  
  
              {forgotSent ? (  
                               <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center space-y-4">  
                  <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-200">  
                    <CheckCircle2 className="text-white" size={24} />  
                  </div>  
                  <div className="space-y-1">  
                    <p className="text-emerald-900 font-bold">Check your inbox!</p>  
                    <p className="text-emerald-700 text-sm">We've sent a reset link to <span className="font-bold">{forgotEmail}</span></p>  
                  </div>  
                  <button   
                    onClick={() => setStep('login')}  
                    className="text-emerald-600 font-bold text-sm hover:underline"  
                  >  
                    Back to Sign In  
                  </button>  
                </div>  
              ) : (  
                <form onSubmit={handleForgotPassword} className="space-y-6">  
                  {error && (  
                    <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4 animate-shake">  
                      <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />  
                      <p className="text-red-700 text-sm font-medium">{error}</p>  
                    </div>  
                  )}  
  
                  {authMethod === 'email' ? (  
                    <div className="space-y-2">  
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">  
                        Email Address  
                      </label>  
                      <div className="relative group">  
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={20} />  
                        <input  
                          type="email"  
                          required  
                          value={forgotEmail}  
                          onChange={(e) => setForgotEmail(e.target.value)}  
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all text-slate-700 font-medium"  
                          placeholder="admin@school.edu"  
                        />  
                      </div>  
                    </div>  
                  ) : (  
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
                  )}  
  
                  <button  
                    type="submit"  
                    disabled={loading}  
                    className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-[0.98]"  
                  >  
                    {loading   
                      ? (authMethod === 'email' ? 'Sending Link...' : 'Sending OTP...')   
                      : (authMethod === 'email' ? 'Send Reset Link' : 'Send Reset OTP')}  
                  </button>  
  
                  <button   
                    type="button"  
                    onClick={() => setStep('login')}  
                    className="w-full text-slate-500 font-bold text-sm hover:text-slate-700 transition"  
                  >  
                    Wait, I remember it! Back to Login  
                  </button>  
                </form>  
              )}  
            </div>  
          )}  
  
          {/* Divider */}  
           <div className="relative my-8">  
            <div className="absolute inset-0 flex items-center">  
              <div className="w-full border-t border-slate-100" />  
            </div>  
            <div className="relative flex justify-center">  
              <span className="bg-white/80 px-4 text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">  
                New to EduNexa?  
              </span>  
            </div>  
          </div>  
  
          {/* Register button */}  
          <Link  
            to="/register"  
            className="flex items-center justify-center w-full py-4 px-6 rounded-2xl  
                       border-2 border-primary/10 text-primary font-bold text-sm  
                       hover:bg-primary/5 hover:border-primary/30  
                       transition-all duration-300 active:scale-[0.98]"  
          >  
            Register Your School  
          </Link>  
        </div>  
  
        {/* Footer */}  
        <div className="text-center space-y-4">  
          <p className="text-[10px] items-center justify-center gap-2 font-bold text-slate-400 uppercase tracking-[0.2em] flex">  
            <span>Trusted by schools across Kenya</span>  
            <span className="text-lg">🇰🇪</span>  
          </p>  
          <div className="text-[10px] text-slate-400/50 flex items-center justify-center gap-2 font-medium">  
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