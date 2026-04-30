import React, { useState, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { Users2, Search, Filter, Shield, GraduationCap, Building2, Key, X, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { useData } from '../hooks/useData';
import { User } from '../types';
import { Navigate } from 'react-router-dom';
import { Skeleton } from '../components/ui/Skeleton';
import { supabase } from '../lib/supabase';

const GlobalUsers = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [resetModalUser, setResetModalUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const isSuperAdmin = useMemo(() => {
    if (!user) return false;
    const role = user.role.toLowerCase();
    return role === 'superadmin' || role === 'super_admin' || role.includes('super');
  }, [user]);

  const { data: users, isLoading } = useData<User>('global-users-list', 'teachers', {
    select: '*, schools:school_id(name)'
  }, isSuperAdmin, 300000);

  const safeUsers = users || [];

  const filteredUsers = useMemo(() => {
    return safeUsers.filter(u =>
      (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
      ((u.schools as { name?: string })?.name || 'Global').toLowerCase().includes(search.toLowerCase())
    );
  }, [safeUsers, search]);

  if (!user) return <Navigate to="/login" />;
  if (!isSuperAdmin) return <Navigate to="/" />;

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;
    if (newPassword.length < 8) {
      setActionError('Password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setActionError('Passwords do not match');
      return;
    }

    setLoadingAction(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      // Send password reset email via Supabase Auth
      const { error } = await supabase.auth.resetPasswordForEmail(
        resetModalUser.email,
        { redirectTo: `${window.location.origin}/reset-password` }
      );

      if (error) throw error;

      setActionSuccess(`Password reset email sent to ${resetModalUser.email}. They will receive a link to set a new password.`);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoadingAction(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Global User Directory</h1>
          <p className="text-slate-500 mt-2">Managing {safeUsers.length} users across the EduNexa network.</p>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or school..."
              className="pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl w-80 shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
            />
          </div>
          <button className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-500 hover:bg-slate-50 transition-colors shadow-sm">
            <Filter size={20} />
          </button>
        </div>
      </header>

      <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 text-slate-400 text-xs uppercase tracking-widest font-bold border-b border-slate-50">
              <th className="px-8 py-5">Identified User</th>
              <th className="px-8 py-5">Role/Access</th>
              <th className="px-8 py-5">Assigned Institution</th>
              <th className="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-8 py-12 text-center text-slate-400 font-medium">
                  No users found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                        {(u.name || '?').charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{u.name}</p>
                        <p className="text-sm text-slate-400 font-medium">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                      u.role === 'SuperAdmin' ? 'bg-purple-50 text-purple-600' :
                      u.role === 'Admin' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-600'
                    }`}>
                      {u.role === 'SuperAdmin' ? <Shield size={12} /> :
                       u.role === 'Admin' ? <GraduationCap size={12} /> : <Users2 size={12} />}
                      {u.role === 'SuperAdmin' ? 'Super Admin' : (u.role === 'Admin' ? 'Admin' : 'Teacher')}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 text-slate-600 font-medium tracking-tight">
                      <Building2 size={16} className="text-slate-300" />
                      {(u.schools as { name?: string })?.name || <span className="text-slate-300 italic">Platform Level</span>}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setResetModalUser(u);
                          setActionError(null);
                          setActionSuccess(null);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg font-bold text-sm transition-all"
                      >
                        <Key size={14} />
                        Reset Password
                      </button>
                      <button className="text-slate-300 hover:text-blue-600 font-bold text-sm transition-colors">
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Reset Password Modal */}
      {resetModalUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3 text-blue-600">
                <div className="p-3 bg-blue-100 rounded-2xl">
                  <Key size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Reset Password</h2>
                  <p className="text-xs text-slate-500 font-medium">Send password reset email</p>
                </div>
              </div>
              <button
                onClick={() => setResetModalUser(null)}
                className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              {actionError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm">
                  <AlertCircle size={18} className="shrink-0" />
                  <p className="font-bold">{actionError}</p>
                </div>
              )}

              {actionSuccess && (
                <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex items-start gap-3 text-green-600 text-sm">
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Success!</p>
                    <p className="font-medium whitespace-pre-wrap">{actionSuccess}</p>
                  </div>
                </div>
              )}

              {!actionSuccess && (
                <form onSubmit={handleResetPassword} className="space-y-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Target School</label>
                        <div className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-600 text-sm font-bold flex items-center gap-2">
                          <Building2 size={14} className="text-slate-400" />
                          <span className="truncate">{(resetModalUser.schools as { name?: string })?.name || 'Platform'}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">User Email</label>
                        <div className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-600 text-sm font-bold flex items-center gap-2">
                          <Users2 size={14} className="text-slate-400" />
                          <span className="truncate">{resetModalUser.email}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-2xl text-blue-700 text-sm font-medium">
                      A password reset email will be sent to <strong>{resetModalUser.email}</strong>. They will receive a secure link to set a new password.
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loadingAction}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98] disabled:opacity-50"
                  >
                    {loadingAction ? 'Sending...' : 'Send Password Reset Email'}
                  </button>
                </form>
              )}

              {actionSuccess && (
                <button
                  onClick={() => setResetModalUser(null)}
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl transition-all hover:bg-slate-800"
                >
                  Close & Continue
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalUsers;
