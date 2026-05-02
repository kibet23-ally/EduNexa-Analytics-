import React, { useState, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { useData } from '../hooks/useData';
import { writeWithProxy } from '../lib/fetchProxy';
import { Plus, Trash2, X, Check, AlertCircle, Users2, BookOpen, GraduationCap } from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';

interface Teacher {
  id: string;
  name: string;
  email: string;
  role: string;
  school_id: number;
}

interface Subject {
  id: number;
  subject_name: string;
  subject_code: string;
  school_id: number;
}

interface Grade {
  id: number;
  grade_name: string;
  school_id: number;
}

interface Assignment {
  id: number;
  teacher_id: string;
  subject_id: number;
  grade_id: number;
  school_id: number;
  is_active: boolean;
  teachers?: { name: string; email: string };
  subjects?: { subject_name: string };
  grades?: { grade_name: string };
}

const TeacherAssignments = () => {
  const { user } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    teacher_id: '',
    subject_id: '',
    grade_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const enabled = !!user?.school_id;

  const teachersQuery = useData<Teacher>('teachers-list-assign', 'teachers', {
    select: 'id, name, email, role',
    filters: { school_id: user?.school_id },
    orderBy: { column: 'name', ascending: true }
  }, enabled);

  const subjectsQuery = useData<Subject>('subjects-list-assign', 'subjects', {
    select: 'id, subject_name, subject_code',
    filters: { school_id: user?.school_id },
    orderBy: { column: 'subject_name', ascending: true }
  }, enabled);

  const gradesQuery = useData<Grade>('grades-list-assign', 'grades', {
    select: 'id, grade_name',
    filters: { school_id: user?.school_id },
    orderBy: { column: 'grade_name', ascending: true }
  }, enabled);

  const assignmentsQuery = useData<Assignment>('assignments-list', 'teacher_assignments', {
    select: '*, teachers:teacher_id(name, email), subjects:subject_id(subject_name), grades:grade_id(grade_name)',
    filters: { school_id: user?.school_id },
  }, enabled);

  const teachers = useMemo(() => teachersQuery.data || [], [teachersQuery.data]);
  const subjects = useMemo(() => subjectsQuery.data || [], [subjectsQuery.data]);
  const grades = useMemo(() => {
    const d = gradesQuery.data || [];
    return [...d].sort((a, b) => {
      const numA = parseInt(a.grade_name.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.grade_name.match(/\d+/)?.[0] || '0');
      if (numA !== numB) return numA - numB;
      return a.grade_name.localeCompare(b.grade_name);
    });
  }, [gradesQuery.data]);

  const assignments = useMemo(() => assignmentsQuery.data || [], [assignmentsQuery.data]);

  const isLoading = teachersQuery.isLoading || subjectsQuery.isLoading ||
    gradesQuery.isLoading || assignmentsQuery.isLoading;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.teacher_id || !formData.subject_id || !formData.grade_id) {
      setError('Please select a teacher, subject and grade.');
      return;
    }

    // Check duplicate
    const exists = assignments.some(a =>
      a.teacher_id === formData.teacher_id &&
      a.subject_id === Number(formData.subject_id) &&
      a.grade_id === Number(formData.grade_id)
    );
    if (exists) {
      setError('This assignment already exists.');
      return;
    }

    setLoading(true);
    try {
      await writeWithProxy('teacher_assignments', 'insert', [{
        teacher_id: formData.teacher_id,
        subject_id: Number(formData.subject_id),
        grade_id: Number(formData.grade_id),
        school_id: user?.school_id,
        is_active: true,
      }]);

      setSuccess('Assignment created successfully');
      setFormData({ teacher_id: '', subject_id: '', grade_id: '' });
      setShowAddModal(false);
      assignmentsQuery.refetch?.();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setLoading(true);
    try {
      await writeWithProxy('teacher_assignments', 'delete', null, { id });
      setSuccess('Assignment removed');
      setConfirmDeleteId(null);
      assignmentsQuery.refetch?.();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete assignment');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }

  // Group assignments by teacher
  const byTeacher = assignments.reduce((acc, a) => {
    const key = a.teacher_id;
    if (!acc[key]) acc[key] = { teacher: a.teachers, items: [] };
    acc[key].items.push(a);
    return acc;
  }, {} as Record<string, { teacher: Assignment['teachers']; items: Assignment[] }>);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Teacher Assignments</h1>
          <p className="text-slate-500 mt-1 text-sm">Assign teachers to subjects and grades.</p>
        </div>
        <button
          onClick={() => { setShowAddModal(true); setError(null); }}
          className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 active:scale-95"
        >
          <Plus size={18} />
          Add Assignment
        </button>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0" />
          <p className="font-medium text-sm">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto"><X size={16} /></button>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 p-4 rounded-xl flex items-center gap-3">
          <Check size={18} className="shrink-0" />
          <p className="font-medium text-sm">{success}</p>
        </div>
      )}

      {/* Assignments grouped by teacher */}
      {Object.keys(byTeacher).length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-100 dark:border-slate-800">
          <Users2 size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="font-bold text-slate-400">No assignments yet</p>
          <p className="text-sm text-slate-400 mt-1">Click "Add Assignment" to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byTeacher).map(([teacherId, { teacher, items }]) => (
            <div key={teacherId} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="p-5 border-b border-slate-50 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {(teacher?.name || 'T').charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{teacher?.name || 'Unknown Teacher'}</p>
                  <p className="text-xs text-slate-400">{teacher?.email}</p>
                </div>
                <span className="ml-auto bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full">
                  {items.length} assignment{items.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-slate-800">
                {items.map(assignment => (
                  <div key={assignment.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <BookOpen size={14} className="text-blue-500" />
                        <span className="font-medium">{(assignment.subjects as { subject_name?: string })?.subject_name || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <GraduationCap size={14} className="text-emerald-500" />
                        <span className="font-medium">{(assignment.grades as { grade_name?: string })?.grade_name || 'N/A'}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${assignment.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {assignment.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {confirmDeleteId === assignment.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Remove?</span>
                        <button onClick={() => handleDelete(assignment.id)} disabled={loading}
                          className="bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50">
                          Yes
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-slate-200">
                          No
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(assignment.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Assignment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">New Assignment</h2>
                <p className="text-sm text-slate-500 mt-0.5">Assign a teacher to a subject and grade</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdd} className="p-6 space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm font-medium flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Teacher</label>
                <select required value={formData.teacher_id}
                  onChange={e => setFormData({ ...formData, teacher_id: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 dark:text-white">
                  <option value="">Select Teacher</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} — {t.role}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subject</label>
                <select required value={formData.subject_id}
                  onChange={e => setFormData({ ...formData, subject_id: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 dark:text-white">
                  <option value="">Select Subject</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.subject_name} ({s.subject_code})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Grade</label>
                <select required value={formData.grade_id}
                  onChange={e => setFormData({ ...formData, grade_id: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 dark:text-white">
                  <option value="">Select Grade</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.id}>{g.grade_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? 'Saving...' : <><Check size={16} /> Save Assignment</>}
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
