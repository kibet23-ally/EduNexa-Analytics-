import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { School } from '../types';
import { Building2, Plus, Globe, Image as ImageIcon, X, Check, Trash2, Users, BookOpen, FileText, Settings, LayoutDashboard, AlertTriangle, Key, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchWithProxy, writeWithProxy } from '../lib/fetchProxy';

const Schools = () => {
  const { user } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{email: string, password: string, name: string} | null>(null);
  const [resetModalSchool, setResetModalSchool] = useState<School | null>(null);
  const [resetModalEmail, setResetModalEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    admin_password: '',
    admin_confirm_password: '',
    subscription_tier: 'Basic'
  });
  
  const [editFormData, setEditFormData] = useState({
    name: '',
    logo_url: '',
    address: '',
    phone: '',
    email: '',
    motto: '',
    subscription_tier: 'Basic' as 'Basic' | 'Standard' | 'Premium',
    subscription_plan: 'Basic',
    subscription_status: 'Active' as 'Active' | 'Expired' | 'Trial',
    subscription_activation_date: '',
    subscription_expiry_date: '',
    expiry_date: '',
    subscription_end_date: ''
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Initialization logic removed, using useAuth directly
  }, [user]);

  const fetchSchools = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { data } = await fetchWithProxy('schools', {
        orderBy: { column: 'name', ascending: true }
      });
      
      if (data) {
        setSchools(data as School[]);
        console.log('Fetched schools via proxy:', data);
      } else {
        setSchools([]);
      }
    } catch (err: unknown) {
      console.error('Fetch schools error:', err);
      setError(err instanceof Error ? err.message : 'Could not fetch schools via proxy');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => fetchSchools());
  }, [fetchSchools]);

  const handleDeleteSchool = async (id: number | null) => {
    if (!id) return;
    
    const schoolToDelete = schools.find(s => s.id === id);
    if (!schoolToDelete) return;

    setLoadingAction(true);
    setError(null);

    try {
      // 1. Close modal immediately
      setConfirmDeleteId(null);
      
      // 2. Perform the deletion
      await writeWithProxy('schools', 'delete', null, { id });

      // 3. FORCE REMOVAL FROM UI IMMEDIATELY
      setSchools(current => current.filter(s => s.id !== id));
      setSuccess(`"${schoolToDelete.name}" successfully removed from system`);
      
      // 4. Wait longer before re-fetching
      setTimeout(() => {
        fetchSchools(true); // Silent re-sync
        setSuccess(null);
      }, 3000);
    } catch (err: unknown) {
      console.error('Unexpected error:', err);
      alert('Delete operation failed.');
      fetchSchools();
    } finally {
      setLoadingAction(false);
    }
  };

  const openStats = async (school: School) => {
    setLoadingAction(true);
    try {
      const [studentsRes, teachersRes, subjectsRes, marksRes] = await Promise.all([
        fetchWithProxy('students', { countOnly: true, filters: { school_id: school.id } }),
        fetchWithProxy('teachers', { countOnly: true, filters: { school_id: school.id } }),
        fetchWithProxy('subjects', { countOnly: true, filters: { school_id: school.id } }),
        fetchWithProxy('marks', { countOnly: true, filters: { school_id: school.id } }),
      ]);

      const stats = { 
        students: studentsRes.count || 0, 
        teachers: teachersRes.count || 0, 
        subjects: subjectsRes.count || 0, 
        marks: marksRes.count || 0 
      };
      setViewingStats({ school, stats });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch school statistics');
    } finally {
      setLoadingAction(false);
    }
  };

  const openSettings = (school: School) => {
    setEditingSchool(school);
    setEditFormData({
      name: school.name,
      logo_url: school.logo_url || '',
      address: school.address || '',
      phone: school.phone || '',
      email: school.email || '',
      motto: school.motto || '',
      subscription_tier: school.subscription_tier || 'Basic',
      subscription_plan: school.subscription_plan || school.subscription_tier || 'Basic',
      subscription_status: school.subscription_status || 'Active',
      subscription_activation_date: (school as Record<string, string | undefined>).subscription_activation_date ? (school as Record<string, string | undefined>).subscription_activation_date!.split('T')[0] : (school as Record<string, string | undefined>).created_at?.split('T')[0] || '',
      subscription_expiry_date: (school as Record<string, string | undefined>).subscription_expiry_date ? (school as Record<string, string | undefined>).subscription_expiry_date!.split('T')[0] : (school as Record<string, string | undefined>).expiry_date?.split('T')[0] || (school as Record<string, string | undefined>).subscription_end_date?.split('T')[0] || '',
      expiry_date: (school as Record<string, string | undefined>).expiry_date ? (school as Record<string, string | undefined>).expiry_date!.split('T')[0] : (school as Record<string, string | undefined>).subscription_end_date?.split('T')[0] || '',
      subscription_end_date: (school as Record<string, string | undefined>).subscription_end_date ? (school as Record<string, string | undefined>).subscription_end_date!.split('T')[0] : (school as Record<string, string | undefined>).expiry_date?.split('T')[0] || ''
    });
  };

  const handleUpdateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchool) return;
    setLoadingAction(true);
    setError(null);
    try {
      await writeWithProxy('schools', 'update', {
        name: editFormData.name,
        logo_url: editFormData.logo_url,
        subscription_plan: editFormData.subscription_plan,
        subscription_status: editFormData.subscription_status,
        expiry_date: editFormData.expiry_date || editFormData.subscription_expiry_date || editFormData.subscription_end_date || null
      }, { id: editingSchool.id });
      
      setEditingSchool(null);
      setSuccess('School settings updated');
      fetchSchools();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      console.error('School update caught error:', err);
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSuspendSchool = async (schoolId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended'
    
    setLoadingAction(true);
    try {
      await writeWithProxy('schools', 'update', { subscription_status: newStatus }, { id: schoolId });

      setSchools(schools.map(s => 
        s.id === schoolId 
          ? { ...s, subscription_status: newStatus }
          : s
      ))
      setSuccess(`School status updated to ${newStatus}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      console.error('Suspend/Activate failure:', err);
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoadingAction(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.admin_password !== formData.admin_confirm_password) {
      setError("Admin passwords do not match.");
      return;
    }
    if (formData.admin_password.length < 6) {
      setError("Admin password must be at least 6 characters.");
      return;
    }

    setLoadingAction(true);
    try {
      // 1. Create the school first to get its ID
      const { data: createdArr } = await writeWithProxy('schools', 'insert', [{
        name: formData.name,
        slug: formData.slug,
        logo_url: formData.logo_url,
        subscription_tier: formData.subscription_tier,
        subscription_status: 'Active'
      }]);

      const schoolData = Array.isArray(createdArr) ? createdArr[0] : createdArr;
      if (!schoolData) throw new Error('Failed to retrieve created school data');

      // 2. Create the school admin user via the high-privilege server proxy
      // This ensures they are created in Auth + users + teachers tables correctly
      const adminResponse = await fetch('/api/admin/create-school-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.admin_email,
          password: formData.admin_password,
          name: formData.admin_name,
          schoolId: schoolData.id,
          role: 'Admin'
        })
      });

      const adminResult = await adminResponse.json();
      if (!adminResponse.ok) {
        // If admin creation fails, we might want to warn the user but the school is already created.
        // Or we could delete the school, but usually it's better to just show an error.
        console.error('Admin provision error:', adminResult.error);
        throw new Error(`School created, but Admin account failed: ${adminResult.error}. Please go to User Directory to fix.`);
      }
      
      // Store credentials for the success modal
      setCreatedCredentials({
        email: formData.admin_email,
        password: formData.admin_password,
        name: formData.admin_name
      });
      
      setFormData({ 
        name: '', 
        slug: '', 
        logo_url: '',
        admin_name: '',
        admin_email: '',
        admin_password: '',
        admin_confirm_password: '',
        subscription_tier: 'Basic'
      });
      setShowAddModal(false);
      fetchSchools();
    } catch (err: unknown) {
      console.error('Submission caught error:', err);
      setError(err instanceof Error ? err.message : 'Failed to add school');
    } finally {
      setLoadingAction(false);
    }
  };

  const isSuperAdmin = user?.role === 'SuperAdmin' || user?.role?.toLowerCase().includes('super');

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalEmail) return;
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoadingAction(true);
    setError(null);
    setSuccess(null);

    try {
      // Then update password using the new server proxy (bypasses browser CORS/network restrictions and RLS)
      setLoadingAction(true);
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetModalEmail, newPassword: newPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password via server');
      }

      setSuccess(`Password reset successfully for ${resetModalEmail}. New password: ${newPassword}`);
      setNewPassword('');
      setConfirmPassword('');
      alert('Password reset successfully!');
      setResetModalSchool(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoadingAction(false);
    }
  };

  const openResetModal = async (school: School) => {
    setLoadingAction(true);
    setError(null);
    try {
      // Find the admin for this school
      const { data: adminArr } = await fetchWithProxy('teachers', {
        select: 'email',
        filters: { school_id: school.id, role: 'Admin' },
        limit: 1,
        single: true
      });
      
      const adminUser = Array.isArray(adminArr) ? adminArr[0] : adminArr;
      
      setResetModalEmail(adminUser?.email || school.email || '');
      setResetModalSchool(school);
    } catch (err: unknown) {
      console.warn('Could not find school admin email:', err);
      setResetModalEmail(school.email || '');
      setResetModalSchool(school);
    } finally {
      setLoadingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-display">
            {isSuperAdmin ? 'EduNexa Tenants' : 'My Institution'}
          </h1>
          <p className="text-slate-500 mt-2">
            {isSuperAdmin ? 'Manage all school instances on the EduNexa platform.' : 'Overview of your educational institution.'}
          </p>
        </div>
        {isSuperAdmin && (
          <div className="flex gap-2">
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
            >
              <Plus size={20} />
              + Onboard New School
            </button>
          </div>
        )}
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-6 rounded-xl flex flex-col gap-4 animate-shake relative">
          <div className="flex items-center gap-3 font-bold text-lg">
            <AlertTriangle className="shrink-0 text-red-600" size={24} />
            {error}
          </div>
          
          <button 
            onClick={() => setError(null)} 
            className="absolute top-4 right-4 text-red-400 hover:text-red-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-accent/10 border border-accent/20 text-accent-dark p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 font-bold text-sm">
          <Check size={20} />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {schools.map((school) => (
          <div key={school.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group hover:shadow-xl hover:shadow-slate-200 transition-all duration-300">
            <div className="h-24 bg-gradient-to-r from-primary to-primary-dark relative">
              {school.logo_url && (
                <img 
                  src={school.logo_url} 
                  alt={school.name} 
                  className="absolute -bottom-6 left-6 w-16 h-16 rounded-2xl border-4 border-white bg-white object-contain shadow-md"
                  referrerPolicy="no-referrer"
                />
              )}
              {isSuperAdmin && (
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
              )}
            </div>
            <div className="p-6 pt-10">
                <div className="flex flex-col items-start gap-1">
                  <h3 className="text-xl font-display font-bold text-slate-900">{school.name}</h3>
                  <div className="flex gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      school.subscription_status === 'suspended' ? 'bg-red-100 text-red-700 border border-red-200' :
                      (school.subscription_status === 'active' || school.subscription_status === 'Active') ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {school.subscription_status === 'suspended' ? 'SUSPENDED' : 'ACTIVE'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      school.subscription_status === 'Active' || school.subscription_status === 'active' ? 'bg-accent/10 text-accent-dark' : 
                      school.subscription_status === 'Trial' ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {school.subscription_tier || 'Basic'}
                    </span>
                  </div>
                </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Globe size={14} className="text-primary" />
                  <span className="font-mono">{school.slug}.edunexa.cloud</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Building2 size={14} className="text-slate-400" />
                  <span>Tenant ID: {school.id}</span>
                </div>
                {school.subscription_expiry_date && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2 p-2 bg-slate-50 rounded-lg">
                    Expires: {new Date(school.subscription_expiry_date).toLocaleDateString()}
                  </div>
                )}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button 
                  onClick={() => openStats(school)}
                  className="flex-1 min-w-[100px] bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <LayoutDashboard size={14} className="text-slate-400" />
                  Dashboard
                </button>
                <button 
                  onClick={() => openSettings(school)}
                  className="flex-1 min-w-[100px] bg-primary/5 hover:bg-primary/10 text-primary py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <Settings size={14} className="text-primary" />
                  Edit
                </button>
                {isSuperAdmin && (
                  <>
                    <button 
                      onClick={() => openResetModal(school)}
                      className="flex-1 min-w-[100px] bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
                      title="Reset Admin Password"
                    >
                      <Key size={14} />
                      Reset PWD
                    </button>
                    <button 
                      onClick={() => handleSuspendSchool(school.id, school.subscription_status || 'active')}
                      className={`flex-1 min-w-[100px] py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 ${
                        school.subscription_status === 'suspended' 
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200' 
                          : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                      }`}
                    >
                      <Check size={14} className={school.subscription_status === 'suspended' ? 'visible' : 'hidden'} />
                      <AlertTriangle size={14} className={school.subscription_status === 'suspended' ? 'hidden' : 'visible'} />
                      {school.subscription_status === 'suspended' ? 'Activate' : 'Suspend'}
                    </button>
                    <button 
                      onClick={() => setConfirmDeleteId(school.id)}
                      className="bg-red-50 hover:bg-red-100 text-red-600 p-2.5 rounded-xl transition-all active:scale-90"
                      title="Delete Institution"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
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
              <div className="bg-primary p-8 text-white relative">
                <h3 className="text-2xl font-display font-bold">Onboard Tenant</h3>
                <p className="text-white/60 text-sm mt-1">Configure a new school environment.</p>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">School Name</label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        required 
                        value={formData.name} 
                        onChange={(e) => setFormData({...formData, name: e.target.value})} 
                        placeholder="Greenhill Academy"
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Slug</label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        required 
                        value={formData.slug} 
                        onChange={(e) => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})} 
                        placeholder="greenhill"
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-mono text-sm" 
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">School Admin Name</label>
                  <input 
                    required 
                    value={formData.admin_name} 
                    onChange={(e) => setFormData({...formData, admin_name: e.target.value})} 
                    placeholder="Principal Name"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Admin Email</label>
                    <input 
                      required 
                      type="email"
                      value={formData.admin_email} 
                      onChange={(e) => setFormData({...formData, admin_email: e.target.value})} 
                      placeholder="admin@school.com"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Admin Password</label>
                    <input 
                      required 
                      type="password"
                      value={formData.admin_password} 
                      onChange={(e) => setFormData({...formData, admin_password: e.target.value})} 
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Confirm Password</label>
                    <input 
                      required 
                      type="password"
                      value={formData.admin_confirm_password} 
                      onChange={(e) => setFormData({...formData, admin_confirm_password: e.target.value})} 
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Subscription Plan</label>
                  <select 
                    value={formData.subscription_tier}
                    onChange={(e) => setFormData({...formData, subscription_tier: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5"
                  >
                    <option value="Basic">Basic Plan</option>
                    <option value="Standard">Standard Plan</option>
                    <option value="Premium">Premium Plan</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Logo URL (Optional)</label>
                  <div className="relative">
                    <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      value={formData.logo_url} 
                      onChange={(e) => setFormData({...formData, logo_url: e.target.value})} 
                      placeholder="https://example.com/logo.png"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all placeholder:text-slate-300" 
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
                    className="flex-1 py-4 bg-accent text-white rounded-2xl font-bold hover:bg-accent-dark transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-2 active:scale-95"
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
        {confirmDeleteId !== null && (
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
              <h3 className="text-2xl font-bold text-slate-900 text-center font-display">Confirm Deletion</h3>
              <p className="text-slate-500 text-center mt-3 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-slate-900">{schools.find(s => s.id === confirmDeleteId)?.name}</span>? 
                This cannot be undone and will permanently wipe all students, teachers, and marks.
              </p>
              <div className="flex gap-4 mt-8">
                <button 
                  disabled={loadingAction}
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all font-display disabled:opacity-50"
                >
                  No, Keep it
                </button>
                <button 
                  disabled={loadingAction}
                  onClick={() => handleDeleteSchool(confirmDeleteId)}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-xl shadow-red-200 flex items-center justify-center gap-2 font-display disabled:opacity-50 disabled:bg-red-400"
                >
                  {loadingAction ? (
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
              <div className="bg-primary p-8 text-white flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                    <LayoutDashboard size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-bold">{viewingStats.school.name}</h3>
                    <p className="text-white/50 text-sm">Real-time tenant analytics</p>
                  </div>
                </div>
                <button onClick={() => setViewingStats(null)} className="text-white/40 hover:text-white transition-colors">
                  <X size={28} />
                </button>
              </div>
              <div className="p-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <Users className="text-primary mb-3" size={24} />
                  <div className="text-2xl font-display font-bold text-slate-900">{viewingStats.stats.students}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Students</div>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <Building2 className="text-accent mb-3" size={24} />
                  <div className="text-2xl font-display font-bold text-slate-900">{viewingStats.stats.teachers}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Teachers</div>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <BookOpen className="text-primary mb-3" size={24} />
                  <div className="text-2xl font-display font-bold text-slate-900">{viewingStats.stats.subjects}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Subjects</div>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <FileText className="text-accent mb-3" size={24} />
                  <div className="text-2xl font-display font-bold text-slate-900">{viewingStats.stats.marks}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total Marks</div>
                </div>
              </div>
              <div className="p-8 pt-0 flex justify-end">
                <button 
                  onClick={() => setViewingStats(null)}
                  className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all active:scale-95"
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
              <div className="bg-primary p-8 text-white flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Settings size={22} />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-bold">Tenant Settings</h3>
                    <p className="text-white/60 text-xs">Modify school configurations</p>
                  </div>
                </div>
                <button onClick={() => setEditingSchool(null)} className="text-white/40 hover:text-white transition-colors">
                  <X size={28} />
                </button>
              </div>
              <form onSubmit={handleUpdateSchool} className="p-8 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Display Name</label>
                  <input 
                    required 
                    value={editFormData.name} 
                    onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Motto / Tagline</label>
                  <input 
                    value={editFormData.motto} 
                    onChange={(e) => setEditFormData({...editFormData, motto: e.target.value})}
                    placeholder="Education for Excellence"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Address</label>
                    <input 
                      value={editFormData.address} 
                      onChange={(e) => setEditFormData({...editFormData, address: e.target.value})}
                      placeholder="123 Education St, City"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Phone Number</label>
                    <input 
                      value={editFormData.phone} 
                      onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                      placeholder="+1 234 567 890"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Public Email</label>
                  <input 
                    type="email"
                    value={editFormData.email} 
                    onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                    placeholder="contact@school.com"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Logo URL</label>
                  <input 
                    value={editFormData.logo_url} 
                    onChange={(e) => setEditFormData({...editFormData, logo_url: e.target.value})}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all" 
                  />
                </div>

                {isSuperAdmin && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Subscription Plan</label>
                      <select 
                        value={editFormData.subscription_plan}
                        onChange={(e) => setEditFormData({...editFormData, subscription_plan: e.target.value, subscription_tier: e.target.value as 'Basic' | 'Standard' | 'Premium'})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5"
                      >
                        <option value="Basic">Basic</option>
                        <option value="Standard">Standard</option>
                        <option value="Premium">Premium</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Status (Plan Status)</label>
                      <select 
                        value={editFormData.subscription_status}
                        onChange={(e) => setEditFormData({...editFormData, subscription_status: e.target.value as 'Active' | 'Expired' | 'Trial'})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-accent/5"
                      >
                        <option value="Active">Active</option>
                        <option value="Expired">Expired</option>
                        <option value="Trial">Trial</option>
                      </select>
                    </div>
                  </div>
                )}

                {isSuperAdmin && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Activation Date</label>
                      <input 
                        type="date"
                        value={editFormData.subscription_activation_date}
                        onChange={(e) => setEditFormData({...editFormData, subscription_activation_date: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Expiry Date</label>
                      <input 
                        type="date"
                        value={editFormData.expiry_date || editFormData.subscription_expiry_date || editFormData.subscription_end_date}
                        onChange={(e) => setEditFormData({
                          ...editFormData, 
                          expiry_date: e.target.value, 
                          subscription_expiry_date: e.target.value,
                          subscription_end_date: e.target.value
                        })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5"
                      />
                    </div>
                  </div>
                )}
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
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary-dark transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2"
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

      <AnimatePresence>
        {createdCredentials && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="bg-green-500 p-8 text-white text-center space-y-3">
                <div className="bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto backdrop-blur-sm">
                  <Check size={40} className="text-white" strokeWidth={3} />
                </div>
                <div>
                  <h2 className="text-2xl font-black">School Onboarded!</h2>
                  <p className="text-sm font-medium opacity-90">Admin account provisioned successfully</p>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Admin Access Credentials</p>
                  
                  <div className="space-y-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Name</span>
                      <span className="text-slate-900 font-bold">{createdCredentials.name}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Email <span className="text-red-500">*</span></span>
                      <div className="bg-white p-3 rounded-xl border border-slate-200 text-primary font-mono text-sm break-all font-bold">
                        {createdCredentials.email}
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Password <span className="text-red-500">*</span></span>
                      <div className="bg-white p-3 rounded-xl border border-slate-200 text-slate-900 font-mono text-sm font-bold tracking-wider">
                        {createdCredentials.password}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-700 text-xs font-medium">
                  <AlertTriangle className="shrink-0" size={16} />
                  <p>Please copy these credentials now. The password will not be shown again for security reasons.</p>
                </div>

                <button
                  onClick={() => setCreatedCredentials(null)}
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-slate-900/20 active:scale-[0.98]"
                >
                  Confirm & Go to Dashboard
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {resetModalSchool && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3 text-blue-600">
                  <div className="p-3 bg-blue-100 rounded-2xl">
                    <Key size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Reset Password</h2>
                    <p className="text-xs text-slate-500 font-medium">Bypass school admin security</p>
                  </div>
                </div>
                <button 
                  onClick={() => setResetModalSchool(null)}
                  className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <form onSubmit={handleResetPassword} className="space-y-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Target School</label>
                        <div className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-600 text-sm font-bold flex items-center gap-2">
                          <Building2 size={14} className="text-slate-400" />
                          <span className="truncate">{resetModalSchool.name}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Admin Email</label>
                        <div className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-600 text-sm font-bold flex items-center gap-2">
                          <Users size={14} className="text-slate-400" />
                          <span className="truncate">{resetModalEmail}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">New Password</label>
                      <div className="relative group">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min. 8 characters"
                          className="w-full pl-5 pr-12 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/20 outline-none transition-all text-slate-900 font-bold placeholder:text-slate-300"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Confirm New Password</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Must match exactly"
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/20 outline-none transition-all text-slate-900 font-bold placeholder:text-slate-300"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loadingAction}
                    className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-slate-900/20 active:scale-[0.98] disabled:opacity-50"
                  >
                    {loadingAction ? 'Processing...' : 'Override & Reset Password'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Schools;
