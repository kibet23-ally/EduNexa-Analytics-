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
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
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

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const userLocal = JSON.parse(localStorage.getItem('edunexa_user') || '{}');
        const schoolId = userLocal.school_id;
        const userEmail = userLocal.email;
        
        if (!userEmail) {
          setLoading(false);
          return;
        }

        const [
          { data: userData, error: userError },
          { data: schoolDataResp }
        ] = await Promise.all([
          supabase.from('users').select('*').eq('email', userEmail).single(),
          schoolId ? supabase.from('schools').select('*').eq('id', schoolId).single() : Promise.resolve({ data: null, error: null })
        ]);

        if (userError) throw userError;

        setFormData({
          name: userData?.name || '',
          email: userData?.email || '',
          avatar_url: userData?.avatar_url || '',
          theme_preference: userData?.theme_preference || 'light',
          notifications_enabled: userData?.notifications_enabled ?? true
        });

        if (schoolDataResp) {
          setSchoolData({
            name: schoolDataResp.name || '',
            logo_url: schoolDataResp.logo_url || '',
            motto: schoolDataResp.motto || ''
          });
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const userLocal = JSON.parse(localStorage.getItem('edunexa_user') || '{}');
      const userEmail = userLocal.email;
      if (!userEmail) throw new Error("No user email found");

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
        .single();
      
      if (error) throw error;
      
      // Update local auth context
      const updatedUser = { ...user!, ...data };
      localStorage.setItem('edunexa_user', JSON.stringify(updatedUser));
      login(token!, updatedUser);
      
      setFeedback({ type: 'success', message: 'Profile updated successfully!' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      setFeedback({ type: 'error', message: message });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleAvatarClick = () => {
    const url = window.prompt("Please enter the direct URL to your profile photo:", formData.avatar_url);
    if (url !== null) {
      setFormData({...formData, avatar_url: url});
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setFeedback({ type: 'error', message: 'Passwords do not match' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });
      
      if (error) throw error;

      setFeedback({ type: 'success', message: 'Password changed successfully!' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to change password';
      setFeedback({ type: 'error', message: message });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleSchoolUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const userLocal = JSON.parse(localStorage.getItem('edunexa_user') || '{}');
    const schoolId = userLocal.school_id;
    if (!schoolId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('schools')
        .update({
          name: schoolData.name,
          logo_url: schoolData.logo_url,
          motto: schoolData.motto
        })
        .eq('id', schoolId);
        
      if (error) throw error;

      setFeedback({ type: 'success', message: 'School profile updated successfully!' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update school profile';
      setFeedback({ type: 'error', message: message });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto">
      <header>
        <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Manage your personal preferences and account security.</p>
      </header>

      <AnimatePresence>
        {feedback && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "p-4 rounded-2xl flex items-center gap-3 font-bold text-sm",
              feedback.type === 'success' ? "bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/30" : "bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/20 dark:border-red-900/30"
            )}
          >
            {feedback.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
            {feedback.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Navigation / Shortcuts */}
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
              <h2 className="mt-4 font-bold text-slate-900 dark:text-white text-lg">{formData.name}</h2>
              <p className="text-xs font-black uppercase tracking-widest text-primary mt-1">{user?.role}</p>
            </div>

            <nav className="space-y-1">
              {['Profile', 'Security', 'Preferences'].map((tab) => (
                <button 
                  key={tab}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {tab}
                </button>
              ))}
              {user?.role === 'Admin' && (
                <button className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  School Profile
                </button>
              )}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Profile Section */}
          <section className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600">
                <User size={20} />
              </div>
              <h3 className="text-xl font-bold dark:text-white">Profile Information</h3>
            </div>

            <form onSubmit={handleProfileUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Full Name</label>
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Email Address</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white"
                  />
                </div>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Profile Photo URL</label>
                <input 
                  value={formData.avatar_url}
                  onChange={(e) => setFormData({...formData, avatar_url: e.target.value})}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white"
                />
              </div>

              <div className="md:col-span-2 pt-4">
                <button 
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  <Save size={20} />
                  {saving ? 'Updating...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </section>

          {/* School Profile Section (Only for Admin) */}
          {user?.role === 'Admin' && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-600">
                  <Building2 size={20} />
                </div>
                <h3 className="text-xl font-bold dark:text-white">School Profile</h3>
              </div>

              <form onSubmit={handleSchoolUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">School Name</label>
                  <input 
                    required
                    value={schoolData.name}
                    onChange={(e) => setSchoolData({...schoolData, name: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">School Logo URL</label>
                  <input 
                    value={schoolData.logo_url}
                    onChange={(e) => setSchoolData({...schoolData, logo_url: e.target.value})}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Motto / Slogan</label>
                  <input 
                    value={schoolData.motto}
                    onChange={(e) => setSchoolData({...schoolData, motto: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white"
                  />
                </div>

                <div className="md:col-span-2 pt-4">
                  <button 
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 bg-amber-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-amber-600/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  >
                    <Save size={20} />
                    {saving ? 'Updating...' : 'Update School Info'}
                  </button>
                </div>
              </form>
            </motion.section>
          )}

          {/* Preferences Section */}
          <section className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-purple-600">
                <Shield size={20} />
              </div>
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
                  <button 
                    onClick={() => {
                      setFormData({...formData, theme_preference: 'light'});
                      setTheme('light');
                    }}
                    className={cn(
                      "px-4 py-2 rounded-lg text-xs font-medium transition-all",
                      theme === 'light' ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    Light
                  </button>
                  <button 
                    onClick={() => {
                      setFormData({...formData, theme_preference: 'dark'});
                      setTheme('dark');
                    }}
                    className={cn(
                      "px-4 py-2 rounded-lg text-xs font-medium transition-all",
                      theme === 'dark' ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    Dark
                  </button>
                </div>
              </div>

              {/* Notifications Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
                    <Bell size={20} className="text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">Email Notifications</h4>
                    <p className="text-xs text-slate-500 font-medium">Receive weekly summarized reports.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setFormData({...formData, notifications_enabled: !formData.notifications_enabled})}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative",
                    formData.notifications_enabled ? "bg-primary" : "bg-slate-200 dark:bg-slate-700"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                    formData.notifications_enabled ? "left-7" : "left-1"
                  )} />
                </button>
              </div>
            </div>
          </section>

          {/* Password Security */}
          <section className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600">
                <Lock size={20} />
              </div>
              <h3 className="text-xl font-bold dark:text-white">Security & Password</h3>
            </div>

            <form onSubmit={handlePasswordUpdate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Current Password</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="password"
                      required
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">New Password</label>
                    <input 
                      type="password"
                      required
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Confirm New Password</label>
                    <input 
                      type="password"
                      required
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-slate-900 dark:bg-primary text-white px-8 py-3 rounded-2xl font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  <Shield size={20} />
                  {saving ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
