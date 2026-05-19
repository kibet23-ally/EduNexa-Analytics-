import React, { useState, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { useSubscription } from '../useSubscription';
import { User, Subject, Grade } from '../types';
import { UserPlus, Link as LinkIcon, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useData, useDataMutation } from '../hooks/useData';
import { TableSkeleton } from '../components/ui/Skeleton';
import { supabase } from '../lib/supabase';

const PAGE_SIZE = 50;

interface AssignmentRecord {
  id: number;
  teacher_id: number;
  subject_id: number;
  grade_id: number;
  school_id: number;
  teachers?: { name: string };
  subjects?: { subject_name: string };
  grades?: { grade_name: string };
}

const Teachers = () => {
  const { user } = useAuth();
  const { isReadOnly } = useSubscription();
  const [page, setPage] = useState(0);

  const teachersMutation = useDataMutation('teachers');
  const assignmentMutation = useDataMutation('teacher_assignments');

  const enabled = !!user?.school_id;

  // =========================
  // TEACHERS
  // =========================
  const teachersQuery = useData<User>(
    'teachers-page',
    'teachers',
    {
      range: { from: page * PAGE_SIZE, to: (page + 1) * PAGE_SIZE - 1 },
      orderBy: { column: 'name' },
      filters: { school_id: user?.school_id }
    },
    enabled
  );

  // =========================
  // SUBJECTS
  // =========================
  const subjectsQuery = useData<Subject>(
    'subjects-list',
    'subjects',
    {
      select: 'id, subject_name',
      orderBy: { column: 'subject_name' },
      filters: { school_id: user?.school_id }
    },
    enabled
  );

  // =========================
  // GRADES
  // =========================
  const gradesQuery = useData<Grade>(
    'grades-list',
    'grades',
    {
      select: 'id, grade_name',
      orderBy: { column: 'grade_name' },
      filters: { school_id: user?.school_id }
    },
    enabled
  );

  // =========================
  // ASSIGNMENTS (FIXED)
  // =========================
  const assignmentsQuery = useData<AssignmentRecord>(
    'assignments-list',
    'teacher_assignments',
    {
      select: `
        id,
        teacher_id,
        subject_id,
        grade_id,
        school_id,
        teachers:teacher_id(name),
        subjects:subject_id(subject_name),
        grades:grade_id(grade_name)
      `,
      filters: {
        school_id: user?.school_id,
        is_active: true
      }
    },
    enabled
  );

  // =========================
  // LOCAL STATE
  // =========================
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

  // =========================
  // SAFE DATA
  // =========================
  const teachers = useMemo(() => {
    const data = (teachersQuery.data as User[]) || [];
    return data.filter(t => t?.id);
  }, [teachersQuery.data]);

  const subjects = useMemo(() => (subjectsQuery.data as Subject[]) || [], [subjectsQuery.data]);
  const grades = useMemo(() => (gradesQuery.data as Grade[]) || [], [gradesQuery.data]);
  const rawAssignments = useMemo(() => (assignmentsQuery.data as AssignmentRecord[]) || [], [assignmentsQuery.data]);

  // =========================
  // FORMAT ASSIGNMENTS
  // =========================
  const processedAssignments = useMemo(() => {
    return rawAssignments.map((item) => ({
      id: item.id,
      teacher_id: item.teacher_id,
      teacher_name: item.teachers?.name || 'Unknown',
      subject_name: item.subjects?.subject_name || 'Unknown',
      grade_name: item.grades?.grade_name || 'Unknown'
    }));
  }, [rawAssignments]);

  // =========================
  // SAVE TEACHER
  // =========================
  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    setLoading(true);
    try {
      const payload = {
        name: teacherForm.name,
        email: teacherForm.email,
        phone: teacherForm.phone || null,
        password: teacherForm.password || undefined,
        role: teacherForm.role,
        school_id: user?.school_id
      };

      if (isEditing) {
        await teachersMutation.mutateAsync({
          operation: 'update',
          payload,
          filters: { id: teacherForm.id }
        });
      } else {
        await teachersMutation.mutateAsync({
          operation: 'insert',
          payload: [payload]
        });
      }

      setShowTeacherModal(false);
      setTeacherForm({ id: '', name: '', email: '', phone: '', password: '', role: 'Teacher' });
      setIsEditing(false);

      setFeedback({ type: 'success', message: 'Teacher saved successfully' });

    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // ASSIGN SUBJECT
  // =========================
  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    setLoading(true);
    try {
      await assignmentMutation.mutateAsync({
        operation: 'insert',
        payload: [{
          teacher_id: assignForm.teacher_id,
          subject_id: assignForm.subject_id,
          grade_id: assignForm.grade_id,
          school_id: user?.school_id,
          is_active: true
        }]
      });

      setShowAssignModal(false);
      setAssignForm({ teacher_id: '', subject_id: '', grade_id: '' });

      setFeedback({ type: 'success', message: 'Assignment created successfully' });

    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // DELETE
  // =========================
  const handleDeleteTeacher = async (id: number) => {
    if (isReadOnly) return;

    await teachersMutation.mutateAsync({
      operation: 'delete',
      filters: { id }
    });

    setDeleteConfirmId(null);
  };

  const handleDeleteAssignment = async (id: number) => {
    if (isReadOnly) return;

    await assignmentMutation.mutateAsync({
      operation: 'delete',
      filters: { id }
    });

    setAssignmentDeleteConfirmId(null);
  };

  // =========================
  // LOADING
  // =========================
  if (teachersQuery.isLoading || assignmentsQuery.isLoading) {
    return <TableSkeleton rows={6} cols={4} />;
  }

  // =========================
  // UI (UNCHANGED STRUCTURE)
  // =========================
  return (
    <div className="space-y-8">

      {/* HEADER */}
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">Teachers</h1>

        <div className="flex gap-2">
          <button onClick={() => setShowAssignModal(true)} className="px-4 py-2 border rounded-lg">
            <LinkIcon size={16} /> Assign
          </button>

          <button onClick={() => setShowTeacherModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            <UserPlus size={16} /> Add Teacher
          </button>
        </div>
      </div>

      {/* ASSIGNMENTS TABLE */}
      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-bold mb-3">Assignments</h2>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th>Teacher</th>
              <th>Subject</th>
              <th>Grade</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {processedAssignments.map(a => (
              <tr key={a.id}>
                <td>{a.teacher_name}</td>
                <td>{a.subject_name}</td>
                <td>{a.grade_name}</td>
                <td>
                  <button onClick={() => handleDeleteAssignment(a.id)}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default Teachers;