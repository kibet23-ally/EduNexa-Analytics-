/* eslint-disable @typescript-eslint/no-explicit-any */

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

  /**
   * ✅ FIX: Safe filtering (DO NOT hide valid teachers)
   */
  const teachers = useMemo(() => {
    const data = (teachersQuery.data as User[]) || [];
    return data.filter((t) => {
      const role = (t.role || '').toLowerCase().trim();
      return role !== 'superadmin' && role !== 'super admin';
    });
  }, [teachersQuery.data]);

  const subjects = useMemo(() => (subjectsQuery.data as Subject[]) || [], [subjectsQuery.data]);
  const grades = useMemo(() => (gradesQuery.data as Grade[]) || [], [gradesQuery.data]);

  const rawAssignments = useMemo(() => (assignmentsQuery.data as AssignmentRecord[]) || [], [assignmentsQuery.data]);

  const processedAssignments = useMemo(() => {
    return rawAssignments.map((item) => ({
      id: item.id,
      teacher_id: item.teacher_id,
      teacher_name: item.teachers?.name || 'Unknown',
      subject_name: item.subjects?.subject_name || 'Unknown',
      grade_name: item.grades?.grade_name || 'Unknown'
    }));
  }, [rawAssignments]);

  /**
   * ✅ FIXED SAVE (keeps school_id ALWAYS)
   */
  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    setLoading(true);
    setFeedback(null);

    try {
      let cleanPhone = teacherForm.phone.replace(/\s+/g, '');

      if (cleanPhone) {
        if (cleanPhone.startsWith('0')) {
          cleanPhone = '+254' + cleanPhone.substring(1);
        } else if (!cleanPhone.startsWith('+')) {
          cleanPhone = '+254' + cleanPhone;
        }

        if (!/^\+254\d{9}$/.test(cleanPhone)) {
          throw new Error('Invalid Kenya phone format');
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
            school_id: Number(user?.school_id) // 🔥 IMPORTANT FIX
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

        setFeedback({ type: 'success', message: 'Teacher created successfully' });
      }

      /**
       * ✅ FIX: Prevent disappearing data
       */
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

  const resetTeacherForm = () => {
    setTeacherForm({
      id: '',
      name: '',
      email: '',
      phone: '',
      password: '',
      role: 'Teacher'
    });
    setIsEditing(false);
  };

  const handleEditClick = (teacher: any) => {
    setTeacherForm({
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone || '',
      password: '',
      role: teacher.role || 'Teacher'
    });
    setIsEditing(true);
    setShowTeacherModal(true);
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

      {feedback && (
        <div
          className={`fixed top-4 right-4 z-[100] px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
              : 'bg-red-50 border-red-100 text-red-800'
          }`}
        >
          <span className="font-bold text-sm">{feedback.message}</span>
        </div>
      )}

      {/* UI remains unchanged below (same as your original) */}

    </div>
  );
};

export default Teachers;