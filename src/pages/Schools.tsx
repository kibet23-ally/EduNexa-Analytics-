import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { School } from '../types';
import { Building2, Plus, Globe, Image as ImageIcon, X, Check, Trash2, Users, BookOpen, FileText, Settings, LayoutDashboard, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Schools = () => {
  const { token } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [viewingStats, setViewingStats] = useState<{school: School, stats: { students: number, teachers: number, subjects: number, marks: number }} | null>(null);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  
  const [formData, setFormData] = useState({ 
    name: '', 
    slug: '', 
    logo_url: '',
    admin_name: '',
    admin_email: '',
    admin_password: ''
  });
  
  const [editFormData, setEditFormData] = useState({
    name: '',
    logo_url: '',
    subscription_tier: 'Basic' as 'Basic' | 'Standard' | 'Premium',
    subscription_status: 'Active' as 'Active' | 'Expired' | 'Trial'
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSchools = React.useCallback(async () => {
    try {
      const res = await fetch('/api/schools', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setSchools(data);
      } else {
        setError(data.error || 'Failed to load schools');
      }
    } catch {
      setError('Could not connect to server');
    }
  }, [token]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/schools/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('School deleted successfully');
        setConfirmDeleteId(null);
        fetchSchools();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to delete school');
      }
    } catch {
      setError('Could not connect to server');
    } finally {
      setDeletingId(null);
    }
  };

  const openStats = async (school: School) => {
    setLoadingAction(true);
    try {
      const res = await fetch(`/api/schools/${school.id}/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const stats = await res.json();
      setViewingStats({ school, stats });
    } catch {
      setError('Failed to fetch school statistics');
    } finally {
      setLoadingAction(false);
    }
  };

  const openSettings = (school: School) => {
    setEditingSchool(school);
    setEditFormData({
      name: school.name,
      logo_url: school.logo_url || '',
      subscription_tier: school.subscription_tier || 'Basic',
      subscription_status: school.subscription_status || 'Active'
    });
  };

  const handleUpdateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchool) return;
    setLoadingAction(true);
    try {
      const res = await fetch(`/api/schools/${editingSchool.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(editFormData)
      });
      if (res.ok) {
        setEditingSchool(null);
        setSuccess('School settings updated');
        fetchSchools();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Update failed');
      }
    } catch {
      setError('Connection failed');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/schools', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(formData),
    });
    if (res.ok) {
      setFormData({ 
        name: '', 
        slug: '', 
        logo_url: '',
        admin_name: '',
        admin_email: '',
        admin_password: ''
      });
      setShowAddModal(false);
      fetchSchools();
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to add school');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-sans">EduNexa Tenants</h1>
          <p className="text-slate-500 mt-2">Manage all school instances on the EduNexa platform.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-200 active:scale-95"
        >
          <Plus size={20} />
          Onboard New School
        </button>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl flex items-center justify-between gap-3 animate-shake">
          <div className="flex items-center gap-3">
            <X size={20} />
            {error}
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <Check size={20} />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {schools.map((school) => (
          <div key={school.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group hover:shadow-xl hover:shadow-slate-200 transition-all duration-300">
            <div className="h-24 bg-gradient-to-r from-blue-900 to-indigo-900 relative">
              {school.logo_url && (
                <img 
                  src={school.logo_url} 
                  alt={school.name} 
                  className="absolute -bottom-6 left-6 w-16 h-16 rounded-2xl border-4 border-white bg-white object-contain shadow-md"
                  referrerPolicy="no-referrer"
                />
              )}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteId(school.id);
                }}
                className="absolute top-4 right-4 bg-slate-900/40 hover:bg-red-600 text-white p-3 rounded-2xl backdrop-blur-xl transition-all shadow-xl active:scale-90 z-20 group-hover:scale-110"
                title="Delete Institution"
              >
                <Trash2 size={20} />
              </button>
            </div>
            <div className="p-6 pt-10">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-bold text-slate-900">{school.name}</h3>
                <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                  school.subscription_status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 
                  school.subscription_status === 'Trial' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {school.subscription_tier || 'Basic'}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Globe size={14} className="text-blue-500" />
                  <span className="font-mono">{school.slug}.edunexa.cloud</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Building2 size={14} className="text-slate-400" />
                  <span>Tenant ID: {school.id}</span>
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                <button 
                  onClick={() => openStats(school)}
                  className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <LayoutDashboard size={16} className="text-slate-400" />
                  Dashboard
                </button>
                <button 
                  onClick={() => openSettings(school)}
                  className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <Settings size={16} className="text-blue-500" />
                  Settings
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="bg-blue-900 p-8 text-white relative">
                <h3 className="text-2xl font-bold">Onboard Tenant</h3>
                <p className="text-blue-200 text-sm mt-1">Configure a new school environment.</p>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="absolute top-8 right-8 text-blue-300 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">School Name</label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        required 
                        value={formData.name} 
                        onChange={(e) => setFormData({...formData, name: e.target.value})} 
                        placeholder="Greenhill Academy"
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Slug</label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        required 
                        value={formData.slug} 
                        onChange={(e) => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})} 
                        placeholder="greenhill"
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-mono" 
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">School Admin Name</label>
                  <input 
                    required 
                    value={formData.admin_name} 
                    onChange={(e) => setFormData({...formData, admin_name: e.target.value})} 
                    placeholder="Principal Name"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Admin Email</label>
                    <input 
                      required 
                      type="email"
                      value={formData.admin_email} 
                      onChange={(e) => setFormData({...formData, admin_email: e.target.value})} 
                      placeholder="admin@school.com"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Admin Password</label>
                    <input 
                      required 
                      type="password"
                      value={formData.admin_password} 
                      onChange={(e) => setFormData({...formData, admin_password: e.target.value})} 
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Logo URL (Optional)</label>
                  <div className="relative">
                    <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      value={formData.logo_url} 
                      onChange={(e) => setFormData({...formData, logo_url: e.target.value})} 
                      placeholder="https://example.com/logo.png"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300" 
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowAddModal(false)} 
                    className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all active:scale-95"
                  >
                    Discard
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Check size={20} />
                    Activate Tenant
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDeleteId && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-8"
            >
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="text-red-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 text-center">Confirm Deletion</h3>
              <p className="text-slate-500 text-center mt-3 leading-relaxed">
                You are about to delete <span className="font-bold text-slate-900">{schools.find(s => s.id === confirmDeleteId)?.name}</span>. 
                This will permanently wipe all students, teachers, and marks. This action <span className="text-red-600 font-bold underline">cannot be undone</span>.
              </p>
              <div className="flex gap-4 mt-8">
                <button 
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all"
                >
                  No, Keep it
                </button>
                <button 
                  disabled={deletingId !== null}
                  onClick={() => handleDelete(confirmDeleteId)}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-xl shadow-red-200 flex items-center justify-center gap-2"
                >
                  {deletingId !== null ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Delete Everything</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingStats && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                    <LayoutDashboard size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{viewingStats.school.name}</h3>
                    <p className="text-slate-400 text-sm">Real-time tenant analytics</p>
                  </div>
                </div>
                <button onClick={() => setViewingStats(null)} className="text-slate-400 hover:text-white transition-colors">
                  <X size={28} />
                </button>
              </div>
              <div className="p-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <Users className="text-blue-600 mb-3" size={24} />
                  <div className="text-2xl font-bold text-slate-900">{viewingStats.stats.students}</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Students</div>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <Building2 className="text-indigo-600 mb-3" size={24} />
                  <div className="text-2xl font-bold text-slate-900">{viewingStats.stats.teachers}</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Teachers</div>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <BookOpen className="text-emerald-600 mb-3" size={24} />
                  <div className="text-2xl font-bold text-slate-900">{viewingStats.stats.subjects}</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Subjects</div>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <FileText className="text-amber-600 mb-3" size={24} />
                  <div className="text-2xl font-bold text-slate-900">{viewingStats.stats.marks}</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Total Marks</div>
                </div>
              </div>
              <div className="p-8 pt-0 flex justify-end">
                <button 
                  onClick={() => setViewingStats(null)}
                  className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all active:scale-95"
                >
                  Close Overview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingSchool && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="bg-blue-600 p-8 text-white flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Settings size={22} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Tenant Settings</h3>
                    <p className="text-blue-200 text-xs">Modify school configurations</p>
                  </div>
                </div>
                <button onClick={() => setEditingSchool(null)} className="text-blue-200 hover:text-white transition-colors">
                  <X size={28} />
                </button>
              </div>
              <form onSubmit={handleUpdateSchool} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Display Name</label>
                  <input 
                    required 
                    value={editFormData.name} 
                    onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Subscription Tier</label>
                  <select 
                    value={editFormData.subscription_tier}
                    onChange={(e) => setEditFormData({...editFormData, subscription_tier: e.target.value as 'Basic' | 'Standard' | 'Premium'})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none"
                  >
                    <option value="Basic">Basic</option>
                    <option value="Standard">Standard</option>
                    <option value="Premium">Premium</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Network Status</label>
                  <select 
                    value={editFormData.subscription_status}
                    onChange={(e) => setEditFormData({...editFormData, subscription_status: e.target.value as 'Active' | 'Expired' | 'Trial'})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Expired">Expired</option>
                    <option value="Trial">Trial</option>
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setEditingSchool(null)} 
                    className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={loadingAction}
                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 flex items-center justify-center gap-2"
                  >
                    {loadingAction ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Save Changes</>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Schools;
