import React, { useState, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { useSubscription } from '../useSubscription';
import { Exam } from '../types';
import { useData, useDataMutation } from '../hooks/useData';
import { Plus, Calendar, Trash2, Edit2, X, Check, Lock } from 'lucide-react';
import { TableSkeleton } from '../components/ui/Skeleton';

const Exams = () => {
  const { user, sessionReady } = useAuth();
  const { isReadOnly } = useSubscription();

  const examMutation = useDataMutation('exams');

  /**
   * ✅ FIX: ensure school_id is ALWAYS used
   * and only run query when session is ready
   */
  const examsQuery = useData<Exam>(
    'exams-list',
    'exams',
    {
      select: 'id, exam_name, term, year, school_id',
      filters: user?.school_id
        ? { school_id: user.school_id }
        : undefined,
      orderBy: { column: 'year', ascending: false }
    },
    !!user?.school_id && sessionReady
  );

  const exams = useMemo(() => {
    return (examsQuery.data || []).sort((a: Exam, b: Exam) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.term - a.term;
    });
  }, [examsQuery.data]);

  const [formData, setFormData] = useState({
    exam_name: '',
    term: '1',
    year: new Date().getFullYear().toString()
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState({
    exam_name: '',
    term: '1',
    year: ''
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!user?.school_id) return;

    try {
      await examMutation.mutateAsync({
        operation: 'insert',
        payload: [{
          exam_name: formData.exam_name,
          term: parseInt(formData.term),
          year: parseInt(formData.year),
          school_id: user.school_id
        }]
      });

      setFormData({
        exam_name: '',
        term: '1',
        year: new Date().getFullYear().toString()
      });
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleEditClick = (exam: Exam) => {
    if (isReadOnly) return;

    setEditingId(exam.id);
    setEditFormData({
      exam_name: exam.exam_name,
      term: exam.term.toString(),
      year: exam.year.toString()
    });
  };

  const handleUpdate = async () => {
    if (isReadOnly || !editingId) return;

    try {
      await examMutation.mutateAsync({
        operation: 'update',
        payload: {
          exam_name: editFormData.exam_name,
          term: parseInt(editFormData.term),
          year: parseInt(editFormData.year)
        },
        criteria: { id: editingId }
      });

      setEditingId(null);
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleDelete = async (id: number) => {
    if (isReadOnly) return;

    try {
      await examMutation.mutateAsync({
        operation: 'delete',
        criteria: { id }
      });

      setDeleteConfirmId(null);
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      <header>
        <h1 className="text-2xl font-bold">Exams</h1>
        <p className="text-slate-500 text-sm">
          Schedule and manage examination periods.
        </p>
      </header>

      {(['Admin', 'admin', 'school_admin', 'Principal'].includes(user?.role || '')) && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-xl border grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <input
            value={formData.exam_name}
            onChange={(e) => setFormData({ ...formData, exam_name: e.target.value })}
            placeholder="Exam name"
            className="p-2 border rounded"
          />

          <select
            value={formData.term}
            onChange={(e) => setFormData({ ...formData, term: e.target.value })}
            className="p-2 border rounded"
          >
            <option value="1">Term 1</option>
            <option value="2">Term 2</option>
            <option value="3">Term 3</option>
          </select>

          <input
            type="number"
            value={formData.year}
            onChange={(e) => setFormData({ ...formData, year: e.target.value })}
            className="p-2 border rounded"
          />

          <button className="bg-blue-600 text-white rounded px-4">
            <Plus size={16} /> Create
          </button>
        </form>
      )}

      <div className="space-y-3">
        {examsQuery.isLoading ? (
          <TableSkeleton rows={4} cols={1} />
        ) : exams.length === 0 ? (
          <p className="text-slate-500">No exams found for this school.</p>
        ) : (
          exams.map((exam) => (
            <div key={exam.id} className="p-4 border rounded flex justify-between">
              <div>
                <p className="font-bold">{exam.exam_name}</p>
                <p className="text-xs text-slate-500">
                  Term {exam.term}, {exam.year}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Exams;