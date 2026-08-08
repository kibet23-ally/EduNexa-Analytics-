/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { useSubscription } from '../useSubscription';
import { useData, useDataMutation } from '../hooks/useData';
import { Subject, Grade } from '../types';
import toast from 'react-hot-toast';
import {
  UserPlus, Link as LinkIcon, Trash2, Edit2, X, Check, Search,
  ChevronLeft, ChevronRight, Lock, Loader2, RotateCcw, GraduationCap, BookOpen,
} from 'lucide-react';
import { TableSkeleton } from '../components/ui/Skeleton';

const PAGE_SIZE = 50;
const ROLES = ['Teacher', 'Principal', 'Admin'] as const;

interface TeacherRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  deleted_at: string | null;
}
interface AssignmentRecord {
  id: number;
  teacher_id: string;
  teachers?: { name: string };
  subject_id: number;
  subjects?: { subject_name: string };
  grade_id: number;
  grades?: { grade_name: string };
}

const ROLE_BADGE: Record<string, string> = {
  Teacher: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40',
  Admin: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40',
  Principal: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40',
  SuperAdmin: 'bg-slate-100 text-slate-600 dark:bg-slate-800',
};

const inputCls = "w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white";

const emptyForm = { id: '', name: '', email: '', phone: '', password: '', role: 'Teacher' as string };

const Teachers = () => {
  const { user } = useAuth();
  const { isReadOnly } = useSubscription();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  const teachersMutation = useDataMutation('teachers');
  const assignmentMutation = useDataMutation('teacher_assignments');

  const teachersQuery = useData<TeacherRow>(
    'teachers-page',
    'teachers',
    { select: 'id, name, email, phone, role, deleted_at', orderBy: { column: 'name' }, limit: 2000 },
    !!user?.school_id
  );

  const subjectsQuery = useData<Subject>(
    'subjects-list', 'subjects',
    { select: 'id, subject_name', orderBy: { column: 'subject_name' } },
    !!user?.school_id
  );
  const gradesQuery = useData<Grade>(
    'grades-list', 'grades',
    { select: 'id, grade_name', orderBy: { column: 'grade_name' } },
    !!user?.school_id
  );
  const assignmentsQuery = useData<AssignmentRecord>(
    'assignments-list', 'teacher_assignments',
    { select: '*, teachers:teacher_id(id, name), subjects:subject_id(id, subject_name), grades:grade_id(id, grade_name)' },
    !!user?.school_id
  );

  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [assignmentDeleteConfirmId, setAssignmentDeleteConfirmId] = useState<number | null>(null);
  const [teacherForm, setTeacherForm] = useState(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const [assignForm, setAssignForm] = useState({ teacher_id: '', subject_id: '', grade_id: '' });

  const allTeachers = useMemo(() => {
    const data = teachersQuery.data || [];
    // SuperAdmin accounts are never managed from a school's Teachers page.
    return data.filter(t => (t.role || '').toLowerCase() !== 'superadmin');
  }, [teachersQuery.data]);

  const filteredTeachers = useMemo(() => {
    let list = allTeachers.filter(t => showArchived ? !!t.deleted_at : !t.deleted_at);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q));
    }
    return list;
  }, [allTeachers, search, showArchived]);

  const totalPages = Math.max(1, Math.ceil(filteredTeachers.length / PAGE_SIZE));
  const teachers = filteredTeachers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const activeTeachers = useMemo(() => allTeachers.filter(t => !t.deleted_at), [allTeachers]);

  const subjects = useMemo(() => subjectsQuery.data || [], [subjectsQuery.data]);
  const grades = useMemo(() => gradesQuery.data || [], [gradesQuery.data]);
  const rawAssignments = useMemo(() => assignmentsQuery.data || [], [assignmentsQuery.data]);

  const processedAssignments = useMemo(() => rawAssignments.map(a => ({
    id: a.id,
    teacher_id: a.teacher_id,
    teacher_name: a.teachers?.name || 'Unknown',
    subject_name: a.subjects?.subject_name || 'Unknown',
    grade_name: a.grades?.grade_name || 'Unknown',
  })), [rawAssignments]);

  const byTeacher = useMemo(() => {
    return processedAssignments.reduce((acc: Record<string, typeof processedAssignments>, a) => {
      (acc[a.teacher_id] ||= []).push(a);
      return acc;
    }, {});
  }, [processedAssignments]);

  const resetTeacherForm = () => { setTeacherForm(emptyForm); setIsEditing(false); };

  const openEdit = (t: TeacherRow) => {
    setTeacherForm({ id: t.id, name: t.name, email: t.email, phone: t.phone || '', password: '', role: t.role });
    setIsEditing(true);
    setShowTeacherModal(true);
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    let cleanPhone = teacherForm.phone.replace(/\s+/g, '');
    if (cleanPhone) {
      if (cleanPhone.startsWith('0')) cleanPhone = '+254' + cleanPhone.slice(1);
      else if (!cleanPhone.startsWith('+')) cleanPhone = '+254' + cleanPhone;
      if (!/^\+254\d{9}$/.test(cleanPhone)) { toast.error('Invalid phone format.'); return; }
    }

    setSaving(true);
    try {
      if (isEditing) {
        await teachersMutation.mutateAsync({
          operation: 'update',
          payload: { name: teacherForm.name, email: teacherForm.email, phone: cleanPhone || null, role: teacherForm.role },
          filters: { id: teacherForm.id },
        });
        toast.success('Teacher updated successfully.');
      } else {
        await teachersMutation.mutateAsync({
          operation: 'insert',
          payload: [{
            name: teacherForm.name, email: teacherForm.email, phone: cleanPhone || null,
            password: teacherForm.password, role: teacherForm.role, school_id: Number(user?.school_id),
          }],
        });
        toast.success('Teacher added successfully.');
      }
      setPage(0);
      setShowTeacherModal(false);
      resetTeacherForm();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save teacher.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (isReadOnly) return;
    try {
      await teachersMutation.mutateAsync({ operation: 'update', payload: { deleted_at: new Date().toISOString() }, filters: { id } });
      toast.success('Teacher archived.');
      setDeleteConfirmId(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to archive teacher.');
    }
  };

  const handleRestore = async (id: string) => {
    if (isReadOnly) return;
    try {
      await teachersMutation.mutateAsync({ operation: 'update', payload: { deleted_at: null }, filters: { id } });
      toast.success('Teacher restored.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to restore teacher.');
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!assignForm.teacher_id || !assignForm.subject_id || !assignForm.grade_id) {
      toast.error('Please select teacher, subject and grade.');
      return;
    }
    setSaving(true);
    try {
      await assignmentMutation.mutateAsync({
        operation: 'insert',
        payload: [{
          teacher_id: assignForm.teacher_id, subject_id: Number(assignForm.subject_id),
          grade_id: Number(assignForm.grade_id), school_id: user?.school_id, is_active: true,
        }],
      });
      toast.success('Subject assigned successfully.');
      setShowAssignModal(false);
      setAssignForm({ teacher_id: '', subject_id: '', grade_id: '' });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign subject.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAssignment = async (id: number) => {
    try {
      await assignmentMutation.mutateAsync({ operation: 'delete', filters: { id } });
      toast.success('Assignment removed.');
      setAssignmentDeleteConfirmId(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove assignment.');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#1e3a5f] flex items-center justify-center">
            <UserPlus className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Teachers</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Manage staff and subject assignments.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAssignModal(true)}
            disabled={isReadOnly}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 hover:text-blue-600 transition-colors disabled:opacity-50"
          >
            <LinkIcon size={18} /> Assign Subject
          </button>
          <button
            onClick={() => { resetTeacherForm(); setShowTeacherModal(true); }}
            disabled={isReadOnly}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm ${
              isReadOnly ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isReadOnly ? <Lock size={18} /> : <UserPlus size={18} />} Add Teacher
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── Teachers table ─────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">Staff Directory</span>
              <span className="text-xs text-slate-400">{activeTeachers.length} active</span>
            </div>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white" />
              </div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 whitespace-nowrap">
                <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Archived
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            {teachersQuery.isLoading ? (
              <div className="p-4"><TableSkeleton rows={6} cols={4} /></div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase">
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {teachers.map(t => (
                    <tr key={t.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${t.deleted_at ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 dark:text-white">{t.name}</p>
                        <p className="text-xs text-slate-400">{t.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[t.role] || 'bg-slate-100 text-slate-600'}`}>{t.role}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {t.deleted_at ? (
                            <button onClick={() => handleRestore(t.id)} title="Restore" className="p-1.5 text-green-500 hover:text-green-700"><RotateCcw size={15} /></button>
                          ) : deleteConfirmId === t.id ? (
                            <>
                              <button onClick={() => handleArchive(t.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Check size={15} /></button>
                              <button onClick={() => setDeleteConfirmId(null)} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg"><X size={15} /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => openEdit(t)} className="p-1.5 text-blue-500 hover:text-blue-700"><Edit2 size={15} /></button>
                              <button onClick={() => setDeleteConfirmId(t.id)} className="p-1.5 text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {teachers.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-10 text-center text-slate-400">No teachers found.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {totalPages > 1 && (
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-3">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 border rounded-lg disabled:opacity-40"><ChevronLeft size={16} /></button>
              <span className="text-xs font-bold text-slate-500">Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(p + 1, totalPages - 1))} disabled={page >= totalPages - 1} className="p-1.5 border rounded-lg disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>
          )}
        </div>

        {/* ── Assignments ────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-900 dark:text-white">
            Subject Assignments
          </div>
          <div className="p-4 max-h-[560px] overflow-y-auto space-y-3">
            {assignmentsQuery.isLoading ? (
              <TableSkeleton rows={6} cols={3} />
            ) : Object.keys(byTeacher).length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-10">No assignments yet.</p>
            ) : (
              Object.entries(byTeacher).map(([teacherId, items]) => (
                <div key={teacherId} className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200">
                    {items[0].teacher_name}
                  </div>
                  {items.map(a => (
                    <div key={a.id} className="px-3 py-2 flex items-center justify-between text-sm border-t border-slate-50 dark:border-slate-800">
                      <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-1.5"><BookOpen size={13} className="text-slate-400" /> {a.subject_name}</span>
                        <span className="flex items-center gap-1.5"><GraduationCap size={13} className="text-slate-400" /> {a.grade_name}</span>
                      </div>
                      {assignmentDeleteConfirmId === a.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => handleDeleteAssignment(a.id)} className="p-1 text-red-600"><Check size={14} /></button>
                          <button onClick={() => setAssignmentDeleteConfirmId(null)} className="p-1 text-slate-400"><X size={14} /></button>
                        </div>
                      ) : (
                        <button onClick={() => setAssignmentDeleteConfirmId(a.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Add/Edit Teacher modal ──────────────────────────────────── */}
      {showTeacherModal && (
        <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{isEditing ? 'Edit Teacher' : 'Add Teacher'}</h2>
              <button onClick={() => { setShowTeacherModal(false); resetTeacherForm(); }}><X size={20} className="text-slate-400" /></button>
            </div>
            <form onSubmit={handleSaveTeacher} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                <input required className={inputCls} value={teacherForm.name} onChange={e => setTeacherForm({ ...teacherForm, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                <input required type="email" className={inputCls} value={teacherForm.email} onChange={e => setTeacherForm({ ...teacherForm, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Phone</label>
                <input className={inputCls} placeholder="0712 345 678" value={teacherForm.phone} onChange={e => setTeacherForm({ ...teacherForm, phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Role</label>
                <select className={inputCls} value={teacherForm.role} onChange={e => setTeacherForm({ ...teacherForm, role: e.target.value })}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {!isEditing && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Temporary Password</label>
                  <input required type="password" className={inputCls} value={teacherForm.password} onChange={e => setTeacherForm({ ...teacherForm, password: e.target.value })} />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowTeacherModal(false); resetTeacherForm(); }} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-blue-600 text-white disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : (isEditing ? 'Save Changes' : 'Add Teacher')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Assign Subject modal ────────────────────────────────────── */}
      {showAssignModal && (
        <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Assign Subject</h2>
              <button onClick={() => setShowAssignModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <form onSubmit={handleAssign} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Teacher</label>
                <select required className={inputCls} value={assignForm.teacher_id} onChange={e => setAssignForm({ ...assignForm, teacher_id: e.target.value })}>
                  <option value="">Select Teacher</option>
                  {activeTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Subject</label>
                <select required className={inputCls} value={assignForm.subject_id} onChange={e => setAssignForm({ ...assignForm, subject_id: e.target.value })}>
                  <option value="">Select Subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Grade</label>
                <select required className={inputCls} value={assignForm.grade_id} onChange={e => setAssignForm({ ...assignForm, grade_id: e.target.value })}>
                  <option value="">Select Grade</option>
                  {grades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAssignModal(false)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-blue-600 text-white disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : 'Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Teachers;