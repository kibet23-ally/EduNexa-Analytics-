import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import {
  User,
  Mail,
  Lock,
  Bell,
  Moon,
  Sun,
  Camera,
  Save,
  Shield,
  Building2,
  Check,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

const SettingsPage = () => {
  const { user, token, theme, setTheme, login } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    avatar_url: '',
    theme_preference: 'light',
    notifications_enabled: true
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [schoolData, setSchoolData] = useState({
    name: '',
    logo_url: '',
    motto: ''
  });

  // Determine role safely
  const userRole = (user?.role || '').toLowerCase();
  const isSuperAdmin = userRole === 'super_admin' || userRole === 'superadmin' || userRole.includes('super');
  const isAdmin = userRole === 'admin' || userRole === 'school_admin' || user?.role === 'Admin';

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Use auth session user as primary source
        const { data: { session } } = await supabase.auth.getSession();
        const userEmail = session?.user?.email || user?.email;
        const schoolId = user?.school_id;

        if (!userEmail) {
          setLoading(false);
          return;
        }

        // Fetch user profile — use maybeSingle to avoid crash if no row found
        const { data: userData } = await supabase
          .from('users')
          .select('id, name, email, avatar_url, theme_preference, notifications_enabled')
          .eq('email', userEmail)
          .maybeSingle();

        // Set form data with safe fallbacks
        setFormData({
          name: userData?.name || user?.name || '',
          email: userData?.email || userEmail,
          avatar_url: userData?.avatar_url || '',
          theme_preference: userData?.theme_preference || theme || 'light',
          notifications_enabled: userData?.notifications_enabled ?? true
        });

        // Only fetch school data if admin with a school
        if (schoolId && isAdmin) {
          const { data: schoolDataResp } = await supabase
            .from('schools')
            .select('name, logo_url, motto')
            .eq('id', schoolId)
            .maybeSingle();

          if (schoolDataResp) {
            setSchoolData({
              name: schoolDataResp.name || '',
              logo_url: schoolDataResp.logo_url || '',
              motto: schoolDataResp.motto || ''
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err);
        // Still set basic data from auth context so page doesn't crash
        setFormData(prev => ({
          ...prev,
          name: user?.name || '',
          email: user?.email || ''
        }));
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const userEmail = user?.email;
      if (!userEmail) throw new Error('No user email found');

      const { data, error } = await supabase
        .from('users')
        .update({
          name: formData.name,
          avatar_url: formData.avatar_url,
          theme_preference: formData.theme_preference,
          notifications_enabled: formData.notifications_enabled
        })
        .eq('email', userEmail)
        .select()
        .maybeSingle();

      if (error) throw error;

      if (data && token) {
        const updatedUser = { ...user!, ...data };
        localStorage.setItem('edunexa_user', JSON.stringify(updatedUser));
        login(token, updatedUser);
      }

      setFeedback({ type: 'success', message: 'Profile updated successfully!' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      setFeedback({ type: 'error', message });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleAvatarClick = () => {
    const url = window.prompt('Enter the URL to your profile photo:', formData.avatar_url);
    if (url !== null) setFormData({ ...formData, avatar_url: url });
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setFeedback({ type: 'error', message: 'Passwords do not match' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setFeedback({ type: 'error', message: 'Password must be at least 6 characters' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (error) throw error;
      setFeedback({ type: 'success', message: 'Password changed successfully!' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to change password';
      setFeedback({ type: 'error', message });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleSchoolUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const schoolId = user?.school_id;
    if (!schoolId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('schools')
        .update({ name: schoolData.name, logo_url: schoolData.logo_url, motto: schoolData.motto })
        .eq('id', schoolId);
      if (error) throw error;
      setFeedback({ type: 'success', message: 'School profile updated successfully!' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update school profile';
      setFeedback({ type: 'error', message });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto">
      <header>
        <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
          Manage your personal preferences and account security.
        </p>
      </header>

      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              'p-4 rounded-2xl flex items-center gap-3 font-bold text-sm',
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                : 'bg-red-50 text-red-600 border border-red-100'
            )}
          >
            {feedback.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
            {feedback.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4 sticky top-8">
            <div className="flex flex-col items-center py-4 border-b border-slate-50 dark:border-slate-800/50 mb-4">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-primary/20">
                  {formData.avatar_url ? (
                    <img src={formData.avatar_url} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User size={40} className="text-slate-400" />
                  )}
                </div>
                <button
                  onClick={handleAvatarClick}
                  className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                >
                  <Camera size={16} />
                </button>
              </div>
              <h2 className="mt-4 font-bold text-slate-900 dark:text-white text-lg">{formData.name || 'User'}</h2>
              <p className="text-xs font-black uppercase tracking-widest text-primary mt-1">{user?.role}</p>
            </div>
            <nav className="space-y-1">
              {['Profile', 'Security', 'Preferences'].map((tab) => (
                <button key={tab} className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  {tab}
                </button>
              ))}
              {isAdmin && (
                <button className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  School Profile
                </button>
              )}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Profile Section */}
          <section className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600"><User size={20} /></div>
              <h3 className="text-xl font-bold dark:text-white">Profile Information</h3>
            </div>
            <form onSubmit={handleProfileUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Full Name</label>
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Email Address</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input required type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white" />
                </div>
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Profile Photo URL</label>
                <input value={formData.avatar_url} onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white" />
              </div>
              <div className="md:col-span-2 pt-4">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                  <Save size={20} /> {saving ? 'Updating...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </section>

          {/* Security Section */}
          <section className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600"><Lock size={20} /></div>
              <h3 className="text-xl font-bold dark:text-white">Change Password</h3>
            </div>
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">New Password</label>
                <input type="password" required value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Min. 6 characters"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Confirm New Password</label>
                <input type="password" required value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Must match exactly"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white" />
              </div>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 bg-red-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-red-600/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                <Lock size={20} /> {saving ? 'Updating...' : 'Change Password'}
              </button>
            </form>
          </section>

          {/* School Profile — only for school admins */}
          {isAdmin && !isSuperAdmin && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-600"><Building2 size={20} /></div>
                <h3 className="text-xl font-bold dark:text-white">School Profile</h3>
              </div>
              <form onSubmit={handleSchoolUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">School Name</label>
                  <input required value={schoolData.name} onChange={(e) => setSchoolData({ ...schoolData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white" />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">School Logo URL</label>
                  <input value={schoolData.logo_url} onChange={(e) => setSchoolData({ ...schoolData, logo_url: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white" />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Motto / Slogan</label>
                  <input value={schoolData.motto} onChange={(e) => setSchoolData({ ...schoolData, motto: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white" />
                </div>
                <div className="md:col-span-2 pt-4">
                  <button type="submit" disabled={saving}
                    className="flex items-center gap-2 bg-amber-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-amber-600/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                    <Save size={20} /> {saving ? 'Updating...' : 'Update School Info'}
                  </button>
                </div>
              </form>
            </motion.section>
          )}

          {/* Preferences Section */}
          <section className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-purple-600"><Shield size={20} /></div>
              <h3 className="text-xl font-bold dark:text-white">App Preferences</h3>
            </div>
            <div className="space-y-6">
              {/* Theme Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
                    {formData.theme_preference === 'dark' ? <Moon size={20} className="text-primary" /> : <Sun size={20} className="text-amber-500" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">Theme Appearance</h4>
                    <p className="text-xs text-slate-500 font-medium">Switch between light and dark mode.</p>
                  </div>
                </div>
                <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                  <button onClick={() => { setFormData({ ...formData, theme_preference: 'light' }); setTheme('light'); }}
                    cl