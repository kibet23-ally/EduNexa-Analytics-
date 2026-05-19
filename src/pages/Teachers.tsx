/* eslint-disable @typescript-eslint/no-explicit-any */

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

  const teachersMutation = useDataMutation('teachers');
  const assignmentMutation = useDataMutation('teacher_assignments');

  const teachersQuery = useData<User>(
    'teachers-page',
    'teachers',
    {
      range: { from: page * PAGE_SIZE, to: (page + 1) * PAGE_SIZE - 1 },
      orderBy: { column: 'name' }
    } as any,
    !!user?.school_id
  );

  const subjectsQuery = useData<Subject>(
    'subjects-list',
    'subjects',
    {
      select: 'id, subject_name',
      orderBy: { column: 'subject_name' }
    },
    !!user?.school_id
  );

  const gradesQuery = useData<Grade>(
    'grades-list',
    'grades',
    {
      select: 'id, grade_name',
      orderBy: { column: 'grade_name' }
    },
    !!user?.school_id
  );

  const assignmentsQuery = useData<AssignmentRecord>(
    'assignments-list',
    'teacher_assignments',
    {
      select:
        '*, teachers:teacher_id(id, name), subjects:subject_id(id, subject_name), grades:grade_id(id, grade_name)'
    },
    !!user?.school_id
  );

  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [assignmentDeleteConfirmId, setAssignmentDeleteConfirmId] = useState<number | null>(null);

  const [teacherForm, setTeacherForm] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'Teacher'
  });

  const [isEditing, setIsEditing] = useState(false);

  const [assignForm, setAssignForm] = useState({
    teacher_id: '',
    subject_id: '',
    grade_id: ''
  });

  const teachers = useMemo(() => {
    const data = (teachersQuery.data as User[]) || [];
    return data.filter(t => {
      const role = (t.role || '').toLowerCase().trim();
      return role !== 'superadmin' && role !== 'super admin';
    });
  }, [teachersQuery.data]);

  const subjects = useMemo(() => (subjectsQuery.data as Subject[]) || [], [subjectsQuery.data]);
  const grades = useMemo(() => (gradesQuery.data as Grade[]) || [], [gradesQuery.data]);

  const rawAssignments = useMemo(() => (assignmentsQuery.data as AssignmentRecord[]) || [], [assignmentsQuery.data]);

  const processedAssignments = useMemo(() => {
    return rawAssignments.map(a => ({
      id: a.id,
      teacher_id: a.teacher_id,
      teacher_name: a.teachers?.name || 'Unknown',
      subject_name: a.subjects?.subject_name || 'Unknown',
      grade_name: a.grades?.grade_name || 'Unknown'
    }));
  }, [rawAssignments]);

  const resetTeacherForm = () => {
    setTeacherForm({ id: '', name: '', email: '', phone: '', password: '', role: 'Teacher' });
    setIsEditing(false);
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    setLoading(true);
    setFeedback(null);

    try {
      let cleanPhone = teacherForm.phone.replace(/\s+/g, '');

      if (cleanPhone) {
        if (cleanPhone.startsWith('0')) cleanPhone = '+254' + cleanPhone.slice(1);
        else if (!cleanPhone.startsWith('+')) cleanPhone = '+254' + cleanPhone;

        if (!/^\+254\d{9}$/.test(cleanPhone)) {
          throw new Error('Invalid phone format');
        }
      }

      if (isEditing) {
        await teachersMutation.mutateAsync({
          operation: 'update',
          payload: {
            name: teacherForm.name,
            email: teacherForm.email,
            phone: cleanPhone || null,
            role: teacherForm.role,
            school_id: Number(user?.school_id)
          },
          filters: { id: teacherForm.id }
        });

        setFeedback({ type: 'success', message: 'Teacher updated successfully' });
      } else {
        await teachersMutation.mutateAsync({
          operation: 'insert',
          payload: [
            {
              name: teacherForm.name,
              email: teacherForm.email,
              phone: cleanPhone || null,
              password: teacherForm.password,
              role: teacherForm.role,
              school_id: Number(user?.school_id)
            }
          ]
        });

        setFeedback({ type: 'success', message: 'Teacher added successfully' });
      }

      setPage(0);
      await teachersQuery.refetch?.();

      setShowTeacherModal(false);
      resetTeacherForm();

    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    setLoading(true);

    try {
      await assignmentMutation.mutateAsync({
        operation: 'insert',
        payload: [
          {
            teacher_id: assignForm.teacher_id,
            subject_id: assignForm.subject_id,
            grade_id: assignForm.grade_id,
            school_id: user?.school_id,
            is_active: true
          }
        ]
      });

      setFeedback({ type: 'success', message: 'Subject assigned successfully' });

      setShowAssignModal(false);
      setAssignForm({ teacher_id: '', subject_id: '', grade_id: '' });

    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">

      {/* Feedback */}
      {feedback && (
        <div className={`fixed top-4 right-4 z-[100] px-6 py-4 rounded-2xl shadow-2xl border ${
          feedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
            : 'bg-red-50 text-red-800 border-red-100'
        }`}>
          {feedback.message}
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Teachers</h1>
          <p className="text-sm text-slate-500">Manage staff and assignments</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowAssignModal(true)}
            className="px-4 py-2 border rounded-lg"
          >
            <LinkIcon size={18} /> Assign Subject
          </button>

          <button
            onClick={() => setShowTeacherModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            <UserPlus size={18} /> Add Teacher
          </button>
        </div>
      </div>

      {/* TABLES (RESTORED) */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* TEACHERS */}
        <div className="bg-white rounded-xl border">
          <div className="p-4 border-b flex justify-between">
            <span className="font-bold">Teachers</span>
          </div>

          <div className="p-4">
            {teachersQuery.isLoading ? (
              <TableSkeleton rows={5} cols={3} />
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {teachers.map(t => (
                    <tr key={t.id} className="border-b">
                      <td className="py-2">{t.name}</td>
                      <td>{t.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ASSIGNMENTS */}
        <div className="bg-white rounded-xl border">
          <div className="p-4 border-b font-bold">Assignments</div>

          <div className="p-4">
            {assignmentsQuery.isLoading ? (
              <TableSkeleton rows={5} cols={3} />
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {processedAssignments.map(a => (
                    <tr key={a.id} className="border-b">
                      <td>{a.teacher_name}</td>
                      <td>{a.subject_name}</td>
                      <td>{a.grade_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* MODALS */}
      {showTeacherModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-[400px]">
            <form onSubmit={handleSaveTeacher} className="space-y-3">
              <input placeholder="Name" className="w-full border p-2" value={teacherForm.name}
                onChange={e => setTeacherForm({ ...teacherForm, name: e.target.value })} />

              <input placeholder="Email" className="w-full border p-2" value={teacherForm.email}
                onChange={e => setTeacherForm({ ...teacherForm, email: e.target.value })} />

              <input placeholder="Phone" className="w-full border p-2" value={teacherForm.phone}
                onChange={e => setTeacherForm({ ...teacherForm, phone: e.target.value })} />

              <button className="bg-blue-600 text-white px-4 py-2 rounded w-full">
                Save
              </button>
            </form>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-[400px]">
            <form onSubmit={handleAssign} className="space-y-3">

              <select className="w-full border p-2"
                onChange={e => setAssignForm({ ...assignForm, teacher_id: e.target.value })}>
                <option>Select Teacher</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>

              <select className="w-full border p-2"
                onChange={e => setAssignForm({ ...assignForm, subject_id: e.target.value })}>
                <option>Select Subject</option>
                {subjects.map(s => (
                  <option key={s.id}>{s.subject_name}</option>
                ))}
              </select>

              <select className="w-full border p-2"
                onChange={e => setAssignForm({ ...assignForm, grade_id: e.target.value })}>
                <option>Select Grade</option>
                {grades.map(g => (
                  <option key={g.id}>{g.grade_name}</option>
                ))}
              </select>

              <button className="bg-blue-600 text-white px-4 py-2 rounded w-full">
                Assign
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Teachers;