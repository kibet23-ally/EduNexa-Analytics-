import React, { useState, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { useData } from '../hooks/useData';
import { writeWithProxy } from '../lib/fetchProxy';
import {
  Plus,
  Trash2,
  X,
  Check,
  AlertCircle,
  Users2,
  BookOpen,
  GraduationCap
} from 'lucide-react';
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

  teachers?: { name: string; email: string } | null;
  subjects?: { subject_name: string; subject_code?: string } | null;
  grades?: { grade_name: string } | null;
}

const TeacherAssignments = () => {
  const { user } = useAuth();

  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    teacher_id: '',
    subject_id: '',
    grade_id: '',
  });

  const enabled = !!user?.school_id;

  const teachersQuery = useData<Teacher>(
    'teachers-list-assign',
    'teachers',
    {
      select: 'id, name, email, role',
      filters: { school_id: user?.school_id },
      orderBy: { column: 'name', ascending: true }
    },
    enabled
  );

  const subjectsQuery = useData<Subject>(
    'subjects-list-assign',
    'subjects',
    {
      select: 'id, subject_name, subject_code',
      filters: { school_id: user?.school_id },
      orderBy: { column: 'subject_name', ascending: true }
    },
    enabled
  );

  const gradesQuery = useData<Grade>(
    'grades-list-assign',
    'grades',
    {
      select: 'id, grade_name',
      filters: { school_id: user?.school_id },
      orderBy: { column: 'grade_name', ascending: true }
    },
    enabled
  );

  const assignmentsQuery = useData<Assignment>(
    'assignments-list',
    'teacher_assignments',
    {
      select: `
        id,
        teacher_id,
        subject_id,
        grade_id,
        school_id,
        is_active,
        teachers:teacher_id(name, email),
        subjects:subject_id(subject_name, subject_code),
        grades:grade_id(grade_name)
      `,
      filters: { school_id: user?.school_id },
    },
    enabled
  );

  const teachers = useMemo(() => teachersQuery.data || [], [teachersQuery.data]);
  const subjects = useMemo(() => subjectsQuery.data || [], [subjectsQuery.data]);
  const grades = useMemo(() => gradesQuery.data || [], [gradesQuery.data]);
  const assignments = useMemo(() => assignmentsQuery.data || [], [assignmentsQuery.data]);

  const isLoading =
    teachersQuery.isLoading ||
    subjectsQuery.isLoading ||
    gradesQuery.isLoading ||
    assignmentsQuery.isLoading;

  /**
   * =========================
   * CREATE ASSIGNMENT
   * =========================
   */
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.teacher_id || !formData.subject_id || !formData.grade_id) {
      setError('Please select teacher, subject and grade.');
      return;
    }

    const exists = assignments.some(a =>
      a.teacher_id === formData.teacher_id &&
      a.subject_id === Number(formData.subject_id) &&
      a.grade_id === Number(formData.grade_id)
    );

    if (exists) {
      setError('Assignment already exists.');
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
    } catch (err: any) {
      setError(err.message || 'Failed to create assignment');
    } finally {
      setLoading(false);
    }
  };

  /**
   * =========================
   * DELETE ASSIGNMENT
   * =========================
   */
  const handleDelete = async (id: number) => {
    setLoading(true);
    try {
      await writeWithProxy('teacher_assignments', 'delete', null, { id });

      setSuccess('Assignment removed');
      setConfirmDeleteId(null);

      assignmentsQuery.refetch?.();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete assignment');
    } finally {
      setLoading(false);
    }
  };

  /**
   * =========================
   * GROUP BY TEACHER
   * =========================
   */
  const byTeacher = assignments.reduce((acc: any, a) => {
    const key = a.teacher_id;

    if (!acc[key]) {
      acc[key] = {
        teacher: a.teachers || { name: 'Unknown', email: '' },
        items: []
      };
    }

    acc[key].items.push(a);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* HEADER */}
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Teacher Assignments</h1>
          <p className="text-sm text-slate-500">
            Assign teachers to subjects and grades
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary text-white px-5 py-2 rounded-xl flex items-center gap-2"
        >
          <Plus size={18} />
          Add Assignment
        </button>
      </header>

      {/* ERROR */}
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={14} />
          </button>
        </div>
      )}

      {/* SUCCESS */}
      {success && (
        <div className="bg-green-50 text-green-600 p-3 rounded-xl flex items-center gap-2">
          <Check size={16} />
          {success}
        </div>
      )}

      {/* EMPTY STATE */}
      {Object.keys(byTeacher).length === 0 ? (
        <div className="text-center p-12 bg-white rounded-2xl">
          <Users2 className="mx-auto mb-3 text-slate-300" size={40} />
          <p className="font-bold text-slate-400">No assignments yet</p>
        </div>
      ) : (
        <div className="space-y-4">

          {Object.entries(byTeacher).map(([teacherId, group]: any) => (
            <div key={teacherId} className="bg-white rounded-2xl border">

              {/* TEACHER HEADER */}
              <div className="p-4 border-b flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  {group.teacher?.name?.charAt(0) || 'T'}
                </div>

                <div>
                  <p className="font-bold">
                    {group.teacher?.name || 'Unknown Teacher'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {group.teacher?.email}
                  </p>
                </div>
              </div>

              {/* ASSIGNMENTS */}
              {group.items.map((a: Assignment) => (
                <div
                  key={a.id}
                  className="flex justify-between p-4 border-b last:border-b-0"
                >
                  <div className="flex gap-6">

                    <div className="flex items-center gap-2 text-sm">
                      <BookOpen size={14} />
                      {a.subjects?.subject_name ?? 'Unassigned Subject'}
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <GraduationCap size={14} />
                      {a.grades?.grade_name ?? 'Unassigned Grade'}
                    </div>

                  </div>

                  <button
                    onClick={() => setConfirmDeleteId(a.id)}
                    className="text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeacherAssignments;