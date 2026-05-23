import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { School } from '../types';
import { Building2, Plus, Globe, X, Check, Trash2, Settings, LayoutDashboard, AlertTriangle, Key, Eye, EyeOff, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchWithProxy, writeWithProxy } from '../lib/fetchProxy';
import { supabase } from '../lib/supabase';

// Extend School type to include status field
interface SchoolWithStatus extends School {
  status?: 'pending' | 'active' | 'suspended';
  admin_name?: string;
}

const Schools = () => {
  const { user } = useAuth();
  const [schools, setSchools] = useState<SchoolWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{email: string, password: string, name: string} | null>(null);
  const [resetModalSchool, setResetModalSchool] = useState<SchoolWithStatus | null>(null);
  const [resetModalEmail, setResetModalEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [viewingStats, setViewingStats] = useState<{school: SchoolWithStatus, stats: { students: number, teachers: number, subjects: number, marks: number }} | null>(null);
  const [editingSchool, setEditingSchool] = useState<SchoolWithStatus | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);

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

  const fetchSchools = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { data } = await fetchWithProxy('schools', {
        orderBy: { column: 'created_at', ascending: false }
      });
      setSchools((data as SchoolWithStatus[]) || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not fetch schools');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => fetchSchools());
  }, [fetchSchools]);

  // ── Approve school ──────────────────────────────────────────
  const handleApprove = async (school: SchoolWithStatus) => {
    setApprovingId(school.id);
    try {
      await writeWithProxy('schools', 'update', {
        status:                      'active',
        subscription_status:         'Active',
        subscription_activation_date: new Date().toISOString(),
        subscription_end_date:        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        expiry_date:                  new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      }, { id: school.id });

      setSchools(prev => prev.map(s =>
        s.id === school.id
          ? { ...s, status: 'active', subscription_status: 'Active' }
          : s
      ));
      setSuccess(`✓ ${school.name} has been approved and can now log in.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setApprovingId(null);
    }
  };

  // ── Reject / suspend school ─────────────────────────────────
  const handleReject = async (school: SchoolWithStatus) => {
    setApprovingId(school.id);
    try {
      await writeWithProxy('schools', 'update', {
        status: 'suspended',
        subscription_status: 'suspended',
      }, { id: school.id });

      setSchools(prev => prev.map(s =>
        s.id === school.id
          ? { ...s, status: 'suspended', subscription_status: 'suspended' }
          : s
      ));
      setSuccess(`${school.name} has been rejected/suspended.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setApprovingId(null);
    }
  };

  const handleDeleteSchool = async (id: number | null) => {
  if (!id) return;
  const schoolToDelete = schools.find(s => s.id === id);
  if (!schoolToDelete) return;
  setLoadingAction(true);
  setError(null);
  setConfirmDeleteId(null);
  try {
    // Delete child records first to avoid FK constraint errors
    await supabase.from('users').delete().eq('school_id', id);
    await supabase.from('teachers').delete().eq('school_id', id);
    await supabase.from('students').delete().eq('school_id', id);
    await supabase.from('grades').delete().eq('school_id', id);
    await supabase.from('subjects').delete().eq('school_id', id);
    await supabase.from('attendance').delete().eq('school_id', id);
    await supabase.from('results').delete().eq('school_id', id);
    await supabase.from('exams').delete().eq('school_id', id);
    await supabase.from('subscriptions').delete().eq('school_id', id);

    const { error: deleteError } = await supabase
      .from('schools')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    setSchools(current => current.filter(s => s.id !== id));
    setSuccess(`"${schoolToDelete.name}" successfully removed`);
    setTimeout(() => setSuccess(null), 3000);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Delete operation failed';
    setError(`Delete failed: ${msg}`);
  } finally {
    setLoadingAction(false);
  }
};

  const openStats = async (school: SchoolWithStatus) => {
    setLoadingAction(true);
    try {
      const [studentsRes, teachersRes, subjectsRes, marksRes] = await Promise.all([
        fetchWithProxy('students', { countOnly: true, filters: { school_id: school.id } }),
        fetchWithProxy('teachers', { countOnly: true, filters: { school_id: school.id } }),
        fetchWithProxy('subjects', { countOnly: true, filters: { school_id: school.id } }),
        fetchWithProxy('marks',    { countOnly: true, filters: { school_id: school.id } }),
      ]);
      setViewingStats({
        school,
        stats: {
          students: studentsRes.count || 0,
          teachers: teachersRes.count || 0,
          subjects: subjectsRes.count || 0,
          marks:    marksRes.count    || 0,
        }
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoadingAction(false);
    }
  };

  const openSettings = (school: SchoolWithStatus) => {
    setEditingSchool(school);
    setEditFormData({
      name:         school.name,
      logo_url:     school.logo_url || '',
      address:      school.address  || '',
      phone:        school.phone    || '',
      email:        school.email    || '',
      motto:        school.motto    || '',
      subscription_tier:   (school.subscription_tier as 'Basic' | 'Standard' | 'Premium') || 'Basic',
      subscription_plan:   school.subscription_plan || school.subscription_tier || 'Basic',
      subscription_status: (school.subscription_status as 'Active' | 'Expired' | 'Trial') || 'Active',
      subscription_activation_date: (school as Record<string, string | undefined>).subscription_activation_date?.split('T')[0] || (school as Record<string, string | undefined>).created_at?.split('T')[0] || '',
      subscription_expiry_date:     (school as Record<string, string | undefined>).subscription_expiry_date?.split('T')[0]     || (school as Record<string, string | undefined>).expiry_date?.split('T')[0] || '',
      expiry_date:          (school as Record<string, string | undefined>).expiry_date?.split('T')[0]          || (school as Record<string, string | undefined>).subscription_end_date?.split('T')[0] || '',
      subscription_end_date:(school as Record<string, string | undefined>).subscription_end_date?.split('T')[0] || (school as Record<string, string | undefined>).expiry_date?.split('T')[0] || '',
    });
  };

  const handleUpdateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchool) return;
    setLoadingAction(true);
    setError(null);
    try {
      await writeWithProxy('schools', 'update', {
        name:                editFormData.name,
        logo_url:            editFormData.logo_url,
        subscription_plan:   editFormData.subscription_plan,
        subscription_status: editFormData.subscription_status,
        expiry_date:         editFormData.expiry_date || editFormData.subscription_expiry_date || editFormData.subscription_end_date || null,
      }, { id: editingSchool.id });
      setEditingSchool(null);
      setSuccess('School settings updated');
      fetchSchools();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (formData.admin_password !== formData.admin_confirm_password) {
      setError('Admin passwords do not match.');
      return;
    }
    if (formData.admin_password.length < 6) {
      setError('Admin password must be at least 6 characters.');
      return;
    }
    setLoadingAction(true);
    let schoolIdCreated: number | null = null;
    try {
      const { data: createdArr } = await writeWithProxy('schools', 'insert', [{
        name: formData.name,
        slug: formData.slug,
        logo_url: formData.logo_url,
        subscription_tier: formData.subscription_tier,
        subscription_status: 'Active',
        status: 'active',
      }]);
      const schoolData = Array.isArray(createdArr) ? createdArr[0] : createdArr;
      if (!schoolData) throw new Error('Failed to retrieve created school data');
      schoolIdCreated = schoolData.id;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email:    formData.admin_email,
        password: formData.admin_password,
        options:  { data: { full_name: formData.admin_name, role: 'school_admin' } },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('Admin auth account creation failed');

      await writeWithProxy('users', 'insert', [{
        id:        authData.user.id,
        email:     formData.admin_email,
        name:      formData.admin_name,
        role:      'school_admin',
        school_id: schoolData.id,
      }]);
      await writeWithProxy('teachers', 'insert', [{
        name:      formData.admin_name,
        email:     formData.admin_email,
        role:      'Admin',
        school_id: schoolData.id,
      }]);

      setCreatedCredentials({
        email:    formData.admin_email,
        password: formData.admin_password,
        name:     formData.admin_name,
      });
      setFormData({ name: '', slug: '', logo_url: '', admin_name: '', admin_email: '', admin_password: '', admin_confirm_password: '', subscription_tier: 'Basic' });
      setShowAddModal(false);
      fetchSchools();
    } catch (err: unknown) {
      if (schoolIdCreated) {
        await writeWithProxy('schools', 'delete', null, { id: schoolIdCreated }).catch(() => {});
      }
      setError(err instanceof Error ? err.message : 'Failed to add school');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalEmail) return;
    setLoadingAction(true);
    setError(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetModalEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setSuccess(`Password reset email sent to ${resetModalEmail}`);
      setResetModalSchool(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoadingAction(false);
    }
  };

  const openResetModal = async (school: SchoolWithStatus) => {
    setLoadingAction(true);
    try {
      const { data: adminArr } = await fetchWithProxy('teachers', {
        select: 'email', filters: { school_id: school.id, role: 'Admin' }, limit: 1, single: true,
      });
      const adminUser = Array.isArray(adminArr) ? adminArr[0] : adminArr;
      setResetModalEmail(adminUser?.email || school.email || '');
      setResetModalSchool(school);
    } catch {
      setResetModalEmail(school.email || '');
      setResetModalSchool(school);
    } finally {
      setLoadingAction(false);
    }
  };

  const isSuperAdmin = user?.role === 'SuperAdmin' || user?.role?.toLowerCase().includes('super');

  // Separate pending from active/suspended
  const pendingSchools  = schools.filter(s => s.status === 'pending');
  const activeSchools   = schools.filter(s => s.status !== 'pending');

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
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
          >
            <Plus size={20} /> + Onboard New School
          </button>
        )}
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3 font-bold"><AlertTriangle size={20} />{error}</div>
          <button onClick={() => setError(null)}><X size={18} /></button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl flex items-center gap-3 font-bold text-sm">
          <Check size={20} />{success}
        </div>
      )}

      {/* ── PENDING SCHOOLS SECTION ───────────────────────── */}
      {isSuperAdmin && pendingSchools.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-200 flex items-center gap-3">
            <Clock size={20} className="text-amber-500" />
            <h2 className="font-bold text-amber-800 text-lg">
              Pending Approval ({pendingSchools.length})
            </h2>
            <span className="ml-auto text-amber-600 text-xs font-bold uppercase tracking-widest">
              Review & approve new school registrations
            </span>
          </div>
          <div className="divide-y divide-amber-100">
            {pendingSchools.map(school => (
              <div key={school.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-amber-100/50 transition-colors">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-amber-200 rounded-xl flex items-center justify-center shrink-0">
                    <Building2 size={20} className="text-amber-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800">{school.name}</p>
                    <p className="text-slate-500 text-sm truncate">{school.email}</p>
                    {school.admin_name && (
                      <p className="text-slate-400 text-xs">Admin: {school.admin_name}</p>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-400 font-medium shrink-0">
                  {new Date(school.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric'
                  })}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(school)}
                    disabled={approvingId === school.id}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 active:scale-95"
                  >
                    {approvingId === school.id ? (
                      <span className="animate-spin w-3 h-3 border-2 border-white/30 border-t-white rounded-full inline-block" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(school)}
                    disabled={approvingId === school.id}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 active:scale-95"
                  >
                    <XCircle size={16} />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ACTIVE/ALL SCHOOLS GRID ────────────────────────── */}
      {activeSchools.length === 0 && pendingSchools.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Building2 size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-bold">No schools found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeSchools.map((school) => (
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
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(school.id); }}
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
                  <div className="flex gap-2 flex-wrap">
                    {/* Status badge uses school.status (pending/active/suspended) */}
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      school.status === 'suspended' ? 'bg-red-100 text-red-700 border border-red-200' :
                      school.status === 'active'    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                      school.status === 'pending'   ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {school.status === 'suspended' ? 'SUSPENDED' :
                       school.status === 'active'    ? 'ACTIVE' :
                       school.status === 'pending'   ? 'PENDING' : 'ACTIVE'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      school.subscription_status === 'Active' || school.subscription_status === 'active' ? 'bg-accent/10 text-accent-dark' :
                      school.subscription_status === 'Trial'  ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-700'
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
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    onClick={() => openStats(school)}
                    className="flex-1 min-w-[80px] bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <LayoutDashboard size={14} className="text-slate-400" />
                    Stats
                  </button>
                  <button
                    onClick={() => openSettings(school)}
                    className="flex-1 min-w-[80px] bg-primary/5 hover:bg-primary/10 text-primary py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Settings size={14} />
                    Edit
                  </button>
                  {isSuperAdmin && (
                    <>
                      <button
                        onClick={() => openResetModal(school)}
                        className="flex-1 min-w-[80px] bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
                      >
                        <Key size={14} />
                        Reset
                      </button>
                      {/* Approve button for active schools that were manually set */}
                      {school.status === 'suspended' && (
                        <button
                          onClick={() => handleApprove(school)}
                          disabled={approvingId === school.id}
                          className="flex-1 min-w-[80px] bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                          <CheckCircle2 size={14} />
                          Activate
                        </button>
                      )}
                      {school.status === 'active' && (
                        <button
                          onClick={() => handleReject(school)}
                          disabled={approvingId === school.id}
                          className="flex-1 min-w-[80px] bg-red-50 hover:bg-red-100 text-red-600 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                          <XCircle size={14} />
                          Suspend
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Delete Confirm ─────────────────────────────────── */}
      <AnimatePresence>
        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirmDeleteId(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="relative bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
              <h3 className="text-lg font-black text-slate-900 mb-2">Delete School?</h3>
              <p className="text-slate-500 text-sm mb-6">This will permanently remove the school and all its data. This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-2 border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50">
                  Cancel
                </button>
                <button onClick={() => handleDeleteSchool(confirmDeleteId)}
                  disabled={loadingAction}
                  className="flex-1 py-2 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 disabled:opacity-50">
                  {loadingAction ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Stats Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {viewingStats && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setViewingStats(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="relative bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
              <button onClick={() => setViewingStats(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
              <h3 className="text-xl font-black text-slate-900 mb-6">{viewingStats.school.name}</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Students', value: viewingStats.stats.students, color: 'bg-blue-50 text-blue-700' },
                  { label: 'Teachers', value: viewingStats.stats.teachers, color: 'bg-emerald-50 text-emerald-700' },
                  { label: 'Subjects', value: viewingStats.stats.subjects, color: 'bg-purple-50 text-purple-700' },
                  { label: 'Marks',    value: viewingStats.stats.marks,    color: 'bg-amber-50 text-amber-700' },
                ].map(item => (
                  <div key={item.label} className={`${item.color} rounded-2xl p-6 text-center`}>
                    <p className="text-3xl font-black">{item.value}</p>
                    <p className="text-xs font-bold uppercase tracking-widest mt-1">{item.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Edit School Modal ──────────────────────────────── */}
      <AnimatePresence>
        {editingSchool && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditingSchool(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="relative bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
              <button onClick={() => setEditingSchool(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
              <h3 className="text-xl font-black text-slate-900 mb-6">Edit: {editingSchool.name}</h3>
              <form onSubmit={handleUpdateSchool} className="space-y-4">
                {[
                  { label: 'School Name', key: 'name', type: 'text' },
                  { label: 'Logo URL',    key: 'logo_url', type: 'url' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">{field.label}</label>
                    <input type={field.type} value={(editFormData as Record<string, string>)[field.key]}
                      onChange={e => setEditFormData(p => ({ ...p, [field.key]: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Subscription Status</label>
                  <select value={editFormData.subscription_status}
                    onChange={e => setEditFormData(p => ({ ...p, subscription_status: e.target.value as 'Active' | 'Expired' | 'Trial' }))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary">
                    <option value="Active">Active</option>
                    <option value="Trial">Trial</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Expiry Date</label>
                  <input type="date" value={editFormData.expiry_date}
                    onChange={e => setEditFormData(p => ({ ...p, expiry_date: e.target.value, subscription_end_date: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditingSchool(null)}
                    className="flex-1 py-2 border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={loadingAction}
                    className="flex-1 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-dark disabled:opacity-50">
                    {loadingAction ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
     {/* ── Add School Modal ───────────────────────────────── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="relative bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
              <button onClick={() => setShowAddModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
              <h3 className="text-xl font-black text-slate-900 mb-6">Onboard New School</h3>
              {error && <p className="text-red-600 text-sm mb-4 font-bold">{error}</p>}
              <form onSubmit={handleSubmit} className="space-y-4">
                {[
                  { label: 'School Name', key: 'name',        type: 'text',     placeholder: 'Westfield Academy' },
                  { label: 'Slug',        key: 'slug',        type: 'text',     placeholder: 'westfield' },
                  { label: 'Logo URL',    key: 'logo_url',    type: 'url',      placeholder: 'https://...' },
                  { label: 'Admin Name',  key: 'admin_name',  type: 'text',     placeholder: 'John Doe' },
                  { label: 'Admin Email', key: 'admin_email', type: 'email',    placeholder: 'admin@school.edu' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">{field.label}</label>
                    <input type={field.type} required value={(formData as Record<string, string>)[field.key]}
                      onChange={e => setFormData(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Admin Password</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} required value={formData.admin_password}
                      onChange={e => setFormData(p => ({ ...p, admin_password: e.target.value }))}
                      placeholder="Min. 6 characters"
                      className="w-full px-4 py-2 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Confirm Password</label>
                  <input type="password" required value={formData.admin_confirm_password}
                    onChange={e => setFormData(p => ({ ...p, admin_confirm_password: e.target.value }))}
                    placeholder="Repeat password"
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAddModal(false)}
                    className="flex-1 py-2 border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={loadingAction}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50">
                    {loadingAction ? 'Creating...' : 'Create School'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Credentials Modal ──────────────────────────────── */}
      <AnimatePresence>
        {createdCredentials && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="relative bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={32} className="text-emerald-600" />
                </div>
                <h3 className="text-xl font-black text-slate-900">School Created!</h3>
                <p className="text-slate-500 text-sm mt-1">Save these credentials for the school admin.</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 space-y-3 font-mono text-sm">
                <div><span className="text-slate-400">Admin:</span> <span className="font-bold">{createdCredentials.name}</span></div>
                <div><span className="text-slate-400">Email:</span> <span className="font-bold">{createdCredentials.email}</span></div>
                <div><span className="text-slate-400">Pass:</span> <span className="font-bold">{createdCredentials.password}</span></div>
              </div>
              <button onClick={() => setCreatedCredentials(null)}
                className="w-full mt-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all">
                Done
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Reset Password Modal ───────────────────────────── */}
      <AnimatePresence>
        {resetModalSchool && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setResetModalSchool(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="relative bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
              <button onClick={() => setResetModalSchool(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
              <h3 className="text-xl font-black text-slate-900 mb-2">Reset Admin Password</h3>
              <p className="text-slate-500 text-sm mb-6">Send a password reset email to the school admin.</p>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Admin Email</label>
                  <input type="email" value={resetModalEmail}
                    onChange={e => setResetModalEmail(e.target.value)} required
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setResetModalSchool(null)}
                    className="flex-1 py-2 border border-slate-200 rounded-xl font-bold text-sm">
                    Cancel
                  </button>
                  <button type="submit" disabled={loadingAction}
                    className="flex-1 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm disabled:opacity-50">
                    {loadingAction ? 'Sending...' : 'Send Reset Email'}
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