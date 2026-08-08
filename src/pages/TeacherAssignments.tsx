import React, { useState, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { useData, useDataMutation } from '../hooks/useData';
import toast from 'react-hot-toast';
import {
  Plus, Trash2, X, Search, Users2, BookOpen, GraduationCap, Loader2, Link as LinkIcon,
} from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';

interface Teacher { id: string; name: string; email: string; role: string; }
interface Subject { id: number; subject_name: string; subject_code: string; }
interface Grade { id: number; grade_name: string; }
interface Assignment {
  id: number;
  teacher_id: string;
  subject_id: number;
  grade_id: number;
  is_active: boolean;
  teachers?: { name: string; email: string } | null;
  subjects?: { subject_name: string; subject_code?: string } | null;
  grades?: { grade_name: string } | null;
}

const inputCls = "w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white";

const TeacherAssignments = () => {
  const { user } = useAuth();
  const enabled = !!user?.school_id;

  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ teacher_id: '', subject_id: '', grade_id: '' });

  const assignmentMutation = useDataMutation('teacher_assignments');

  const teachersQuery = useData<Teacher>('teachers-list-assign', 'teachers',
    { select: 'id, name, email, role', filters: { school_id: user?.school_id }, orderBy: { column: 'name', ascending: true } }, enabled);
  const subjectsQuery = useData<Subject>('subjects-list-assign', 'subjects',
    { select: 'id, subject_name, subject_code', filters: { school_id: user?.school_id }, orderBy: { column: 'subject_name', ascending: true } }, enabled);
  const gradesQuery = useData<Grade>('grades-list-assign', 'grades',
    { select: 'id, grade_name', filters: { school_id: user?.school_id }, orderBy: { column: 'grade_name', ascending: true } }, enabled);
  const assignmentsQuery = useData<Assignment>('assignments-list', 'teacher_assignments', {
    select: `id, teacher_id, subject_id, grade_id, is_active,
      teachers:teacher_id(name, email), subjects:subject_id(subject_name, subject_code), grades:grade_id(grade_name)`,
    filters: { school_id: user?.school_id },
  }, enabled);

  const teachers = useMemo(() => teachersQuery.data || [], [teachersQuery.data]);
  const subjects = useMemo(() => subjectsQuery.data || [], [subjectsQuery.data]);
  const grades = useMemo(() => gradesQuery.data || [], [gradesQuery.data]);
  const assignments = useMemo(() => assignmentsQuery.data || [], [assignmentsQuery.data]);

  const isLoading = teachersQuery.isLoading || subjectsQuery.isLoading || gradesQuery.isLoading || assignmentsQuery.isLoading;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.teacher_id || !formData.subject_id || !formData.grade_id) {
      toast.error('Please select teacher, subject and grade.');
      return;
    }
    const exists = assignments.some(a =>
      a.teacher_id === formData.teacher_id &&
      a.subject_id === Number(formData.subject_id) &&
      a.grade_id === Number(formData.grade_id)
    );
    if (exists) { toast.error('This assignment already exists.'); return; }

    setSaving(true);
    try {
      await assignmentMutation.mutateAsync({
        operation: 'insert',
        payload: [{
          teacher_id: formData.teacher_id, subject_id: Number(formData.subject_id),
          grade_id: Number(formData.grade_id), school_id: user?.school_id, is_active: true,
        }],
      });
      toast.success('Assignment created successfully.');
      setFormData({ teacher_id: '', subject_id: '', grade_id: '' });
      setShowAddModal(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create assignment.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await assignmentMutation.mutateAsync({ operation: 'delete', filters: { id } });
      toast.success('Assignment removed.');
      setConfirmDeleteId(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete assignment.');
    }
  };

  const byTeacher = useMemo(() => {
    const groups = assignments.reduce((acc: Record<string, { teacher: any; items: Assignment[] }>, a) => {
      const key = a.teacher_id;
      if (!acc[key]) acc[key] = { teacher: a.teachers || { name: 'Unknown', email: '' }, items: [] };
      acc[key].items.push(a);
      return acc;
    }, {});
    if (!search) return groups;
    const q = search.toLowerCase();
    return Object.fromEntries(
      Object.entries(groups).filter(([, g]) =>
        g.teacher?.name?.toLowerCase().includes(q) ||
        g.items.some(i => i.subjects?.subject_name?.toLowerCase().includes(q) || i.grades?.grade_name?.toLowerCase().includes(q))
      )
    );
  }, [assignments, search]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#1e3a5f] flex items-center justify-center">
            <LinkIcon className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Teacher Assignments</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Assign teachers to subjects and grades.</p>
          </div>
        </div>
        <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors">
          <Plus size={18} /> Add Assignment
        </button>
      </header>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search teacher, subject, or grade..."
          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white" />
      </div>

      {Object.keys(byTeacher).length === 0 ? (
        <div className="text-center p-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
          <Users2 className="mx-auto mb-3 text-slate-300" size={40} />
          <p className="font-bold text-slate-400">No assignments found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byTeacher).map(([teacherId, group]) => (
            <div key={teacherId} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/40 rounded-xl flex items-center justify-center font-bold text-blue-600">
                  {group.teacher?.name?.charAt(0) || 'T'}
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{group.teacher?.name || 'Unknown Teacher'}</p>
                  <p className="text-xs text-slate-400">{group.teacher?.email}</p>
                </div>
              </div>
              {group.items.map(a => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3 border-t border-slate-50 dark:border-slate-800">
                  <div className="flex gap-6 text-sm text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5"><BookOpen size={14} className="text-slate-400" /> {a.subjects?.subject_name ?? 'Unassigned Subject'}</span>
                    <span className="flex items-center gap-1.5"><GraduationCap size={14} className="text-slate-400" /> {a.grades?.grade_name ?? 'Unassigned Grade'}</span>
                  </div>
                  {confirmDeleteId === a.id ? (
                    <div className="flex gap-2">
                      <button onClick={() => handleDelete(a.id)} className="text-xs font-bold text-red-600 px-2 py-1 hover:bg-red-50 rounded-lg">Confirm</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-xs font-medium text-slate-400 px-2 py-1">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(a.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add Assignment</h2>
              <button onClick={() => setShowAddModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <form onSubmit={handleAdd} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Teacher</label>
                <select required className={inputCls} value={formData.teacher_id} onChange={e => setFormData({ ...formData, teacher_id: e.target.value })}>
                  <option value="">Select Teacher</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Subject</label>
                <select required className={inputCls} value={formData.subject_id} onChange={e => setFormData({ ...formData, subject_id: e.target.value })}>
                  <option value="">Select Subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Grade</label>
                <select required className={inputCls} value={formData.grade_id} onChange={e => setFormData({ ...formData, grade_id: e.target.value })}>
                  <option value="">Select Grade</option>
                  {grades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">Cancel</button>
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

export default TeacherAssignments;