import React, { useState, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { useSubscription } from '../useSubscription';
import { User, Subject, Grade } from '../types';
import { UserPlus, Link as LinkIcon, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useData, useDataMutation } from '../hooks/useData';
import { TableSkeleton } from '../components/ui/Skeleton';

const PAGE_SIZE = 50;

interface AssignmentRecord {
  id: number;
  teacher_id: number;
  teachers?: { name: string };
  subject_id: number;
  subjects?: { subject_name: string };
  grade_id: number;
  grades?: { grade_name: string };
}

const Teachers = () => {
  const { user } = useAuth();
  const { isReadOnly } = useSubscription();
  const [page, setPage] = useState(0);
  
  // Mutations
  const teachersMutation = useDataMutation('teachers');
  const assignmentMutation = useDataMutation('teacher_assignments');

  // Optimized Fetching
  const teachersQuery = useData<User>('teachers-page', 'teachers', {
    range: { from: page * PAGE_SIZE, to: (page + 1) * PAGE_SIZE - 1 },
    orderBy: { column: 'name' }
  }, !!user?.school_id);

  const subjectsQuery = useData<Subject>('subjects-list', 'subjects', {
    select: 'id, subject_name',
    orderBy: { column: 'subject_name' }
  }, !!user?.school_id);

  const gradesQuery = useData<Grade>('grades-list', 'grades', {
    select: 'id, grade_name',
    orderBy: { column: 'grade_name' }
  }, !!user?.school_id);

  const assignmentsQuery = useData<AssignmentRecord>('assignments-list', 'teacher_assignments', {
    select: '*, teachers:teacher_id(id, name), subjects:subject_id(id, subject_name), grades:grade_id(id, grade_name)'
  }, !!user?.school_id);
  
  // Local UI State
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [assignmentDeleteConfirmId, setAssignmentDeleteConfirmId] = useState<number | null>(null);
  
  const [teacherForm, setTeacherForm] = useState({ name: '', email: '', password: '', role: 'Teacher' });
  const [assignForm, setAssignForm] = useState({ teacher_id: '', subject_id: '', grade_id: '' });

  const teachers = useMemo(() => teachersQuery.data || [], [teachersQuery.data]);
  const subjects = useMemo(() => subjectsQuery.data || [], [subjectsQuery.data]);
  const grades = useMemo(() => gradesQuery.data || [], [gradesQuery.data]);
  const rawAssignments = useMemo(() => assignmentsQuery.data || [], [assignmentsQuery.data]);

  const processedAssignments = useMemo(() => {
    return rawAssignments.map((item) => ({
      id: item.id,
      teacher_id: item.teacher_id,
      teacher_name: item.teachers?.name || 'Unknown',
      subject_id: item.subject_id,
      subject_name: item.subjects?.subject_name || 'Unknown',
      grade_id: item.grade_id,
      grade_name: item.grades?.grade_name || 'Unknown'
    }));
  }, [rawAssignments]);

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    setLoading(true);
    try {
      const payload = {
        name: teacherForm.name,
        email: teacherForm.email,
        password: teacherForm.password,
        role: teacherForm.role || 'Teacher',
        school_id: Number(user?.school_id)
      };

      await teachersMutation.mutateAsync({ operation: 'insert', payload: [payload] });
      setFeedback({ type: 'success', message: 'Teacher registered successfully!' });
      setShowTeacherModal(false);
      setTeacherForm({ name: '', email: '', password: '', role: 'Teacher' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: (err as Error).message || 'Failed to register teacher' });
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    setLoading(true);
    try {
      const payload = {
        teacher_id: assignForm.teacher_id,
        subject_id: assignForm.subject_id,
        grade_id: assignForm.grade_id,
        school_id: user?.school_id,
        is_active: true
      };

      await assignmentMutation.mutateAsync({ operation: 'insert', payload: [payload] });
      setFeedback({ type: 'success', message: 'Subject assigned successfully!' });
      setShowAssignModal(false);
      setAssignForm({ teacher_id: '', subject_id: '', grade_id: '' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: (err as Error).message || 'Failed to assign' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeacher = async (id: number) => {
    if (isReadOnly) return;
    try {
      await teachersMutation.mutateAsync({ operation: 'delete', filters: { id } });
      setDeleteConfirmId(null);
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: (err as Error).message });
    }
  };

  const handleDeleteAssignment = async (id: number) => {
    if (isReadOnly) return;
    try {
      await assignmentMutation.mutateAsync({ operation: 'delete', filters: { id } });
      setAssignmentDeleteConfirmId(null);
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: (err as Error).message });
    }
  };

  return (
    <div className="space-y-8">
      {feedback && (
        <div className={`fixed top-4 right-4 z-[100] px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 ${
          feedback.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'
        }`}>
          <span className="font-bold text-sm">{feedback.message}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teachers</h1>
          <p className="text-slate-500 text-sm">Manage staff and assignments.</p>
        </div>
        <div className="flex gap-3">
          <button 
            disabled={isReadOnly}
            onClick={() => setShowAssignModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm bg-white hover:bg-slate-50"
          >
            <LinkIcon size={18} /> Assign Subject
          </button>
          <button 
            disabled={isReadOnly}
            onClick={() => setShowTeacherModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            <UserPlus size={18} /> Add Teacher
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-bold text-slate-900 text-sm">Staff List</h3>
            <div className="flex items-center gap-2">
               <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1 border rounded disabled:opacity-30"><ChevronLeft size={16}/></button>
               <span className="text-xs font-bold">Page {page + 1}</span>
               <button onClick={() => setPage(p => p + 1)} disabled={teachers.length < PAGE_SIZE} className="p-1 border rounded disabled:opacity-30"><ChevronRight size={16}/></button>
            </div>
          </div>
          <div className="overflow-x-auto min-h-[300px]">
            {teachersQuery.isLoading ? (
              <div className="p-6"><TableSkeleton rows={8} cols={4} /></div>
            ) : (
              <table className="w-full text-left">
                <thead className="text-xs text-slate-400 uppercase font-bold border-b">
                  <tr>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y">
                  {teachers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{t.name}</div>
                        <div className="text-[10px] text-slate-400">{t.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100">{t.role}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          {deleteConfirmId === t.id ? (
                            <button onClick={() => handleDeleteTeacher(t.id)} className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-bold">Confirm</button>
                          ) : (
                            <button onClick={() => setDeleteConfirmId(t.id)} className="text-slate-400 hover:text-red-600 p-2"><Trash2 size={16} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-900 text-sm">Active Assignments</h3>
          </div>
          <div className="overflow-x-auto">
             {assignmentsQuery.isLoading ? (
               <div className="p-6"><TableSkeleton rows={8} cols={4} /></div>
             ) : (
              <table className="w-full text-left">
                <thead className="text-xs text-slate-400 uppercase font-bold border-b">
                  <tr>
                    <th className="px-6 py-3">Staff</th>
                    <th className="px-6 py-3">Subject & Grade</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y">
                  {processedAssignments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-bold text-slate-800">{a.teacher_name}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg">{a.subject_name}</span>
                           <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-50 text-slate-700 rounded-lg">{a.grade_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {assignmentDeleteConfirmId === a.id ? (
                          <button onClick={() => handleDeleteAssignment(a.id)} className="text-red-600 px-2 py-1 font-bold">YES</button>
                        ) : (
                          <button onClick={() => setAssignmentDeleteConfirmId(a.id)} className="text-slate-300 hover:text-red-600"><Trash2 size={16} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
             )}
          </div>
        </div>
      </div>

      {showTeacherModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h3 className="text-lg font-bold">Add Teacher</h3></div>
            <form onSubmit={handleCreateTeacher} className="p-6 space-y-4">
              <input required placeholder="Full Name" value={teacherForm.name} onChange={e => setTeacherForm({...teacherForm, name: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
              <input type="email" required placeholder="Email" value={teacherForm.email} onChange={e => setTeacherForm({...teacherForm, email: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
              <input type="password" placeholder="Password (Optional)" value={teacherForm.password} onChange={e => setTeacherForm({...teacherForm, password: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowTeacherModal(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b"><h3 className="text-lg font-bold">Assign Subject</h3></div>
            <form onSubmit={handleAssign} className="p-6 space-y-4">
              <select required value={assignForm.teacher_id} onChange={e => setAssignForm({...assignForm, teacher_id: e.target.value})} className="w-full px-4 py-2 border rounded-lg">
                <option value="">Select Teacher</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select required value={assignForm.subject_id} onChange={e => setAssignForm({...assignForm, subject_id: e.target.value})} className="w-full px-4 py-2 border rounded-lg">
                <option value="">Select Subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
              </select>
              <select required value={assignForm.grade_id} onChange={e => setAssignForm({...assignForm, grade_id: e.target.value})} className="w-full px-4 py-2 border rounded-lg">
                <option value="">Select Grade</option>
                {grades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
              </select>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowAssignModal(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50">Assign</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Teachers;
