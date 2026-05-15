import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../useAuth';
import { toast, Toaster } from 'react-hot-toast';
import { Mail, Phone, Lock, ArrowLeft } from 'lucide-react';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'login' | 'otp'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const redirect = (role: string) => {
    if (role === 'teacher') navigate('/teacher');
    else if (role === 'school_admin') navigate('/school-admin');
    else navigate('/dashboard');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const value = identifier.trim();

      // 📧 EMAIL LOGIN
      if (value.includes('@')) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: value.toLowerCase(),
          password,
        });

        if (error) throw error;

        const user = data.user;

        login(data.session.access_token, user);
        toast.success('Welcome back!');
        navigate('/dashboard');
        return;
      }

      // 📱 PHONE LOGIN (OTP)
      let phone = value.replace(/\s+/g, '');

      if (phone.startsWith('0')) {
        phone = '+254' + phone.substring(1);
      } else if (!phone.startsWith('+')) {
        phone = '+254' + phone;
      }

      const { error } = await supabase.auth.signInWithOtp({
        phone,
      });

      if (error) throw error;

      setStep('otp');
      toast.success('OTP sent to your phone');
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let phone = identifier.trim();

      if (phone.startsWith('0')) {
        phone = '+254' + phone.substring(1);
      } else if (!phone.startsWith('+')) {
        phone = '+254' + phone;
      }

      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });

      if (error) throw error;

      const user = data.user;

      login(data.session.access_token, user);
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
      toast.error('Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Toaster />

      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg">

        {/* Back */}
        <Link to="/" className="flex items-center gap-2 text-sm mb-4">
          <ArrowLeft size={16} /> Back
        </Link>

        <h1 className="text-2xl font-bold mb-6">Login</h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={step === 'login' ? handleLogin : handleVerifyOtp} className="space-y-4">

          {step === 'login' && (
            <>
              {/* Email or Phone */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Email or Phone (e.g. admin@school.com or 0712345678)"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                  required
                />
              </div>

              {/* Password only for email */}
              {identifier.includes('@') && (
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-3 border rounded-lg"
                    required
                  />
                </div>
              )}
            </>
          )}

          {step === 'otp' && (
            <input
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full p-3 border rounded-lg text-center tracking-widest text-xl"
              maxLength={6}
              required
            />
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg"
          >
            {step === 'login' ? (loading ? 'Logging in...' : 'Login') : 'Verify OTP'}
          </button>

        </form>

        {step === 'otp' && (
          <button
            onClick={() => setStep('login')}
            className="mt-4 text-sm text-blue-600"
          >
            Change phone number
          </button>
        )}

      </div>
    </div>
  );
};

export default Login;