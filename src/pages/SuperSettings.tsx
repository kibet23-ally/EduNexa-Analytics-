import React, { useState } from 'react';
import { useAuth } from '../useAuth';
import { User as UserIcon, Mail, Shield, Save, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const SuperSettings = () => {
  const { user, token, login } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/super/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        const updatedUser = await res.json();
        login(token!, updatedUser);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-2xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">System Preferences</h1>
        <p className="text-slate-500 mt-2">Manage your platform level administrator credentials.</p>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="bg-blue-900 p-8 text-white relative">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center text-3xl font-bold">
              {user?.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{user?.name}</h2>
              <div className="flex items-center gap-2 text-blue-300 text-sm font-medium mt-1 uppercase tracking-widest">
                <Shield size={14} />
                {user?.role}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Display Name</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Official Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                required
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <AnimatePresence>
              {success && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-emerald-600 text-sm font-bold"
                >
                  <Check size={18} className="bg-emerald-50 rounded-full p-0.5" />
                  Successfully updated platform credentials!
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              disabled={saving}
              className="ml-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-bold transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-blue-200"
            >
              <Save size={20} />
              {saving ? 'Saving...' : 'Update Records'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SuperSettings;
