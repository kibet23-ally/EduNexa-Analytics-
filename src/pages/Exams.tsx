import React, { useState, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { useSubscription } from '../useSubscription';
import { Exam } from '../types';
import { useData, useDataMutation } from '../hooks/useData';
import { Plus, Calendar, Trash2, Edit2, X, Check, Lock } from 'lucide-react';
import { TableSkeleton } from '../components/ui/Skeleton';

const Exams = () => {
  const { user } = useAuth();
  const { isReadOnly } = useSubscription();
  
  // Mutations
  const examMutation = useDataMutation('exams');

  // Fetching
  const examsQuery = useData<Exam>('exams-list', 'exams', {
    orderBy: { column: 'year', ascending: false }
  }, !!user?.school_id);

  const exams = useMemo(() => {
    return (examsQuery.data || []).sort((a: Exam, b: Exam) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.term - a.term;
    });
  }, [examsQuery.data]);

  const [formData, setFormData] = useState({ exam_name: '', term: '1', year: new Date().getFullYear().toString() });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState({ exam_name: '', term: '1', year: '' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return alert("Subscription expired.");
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
      setFormData({ exam_name: '', term: '1', year: new Date().getFullYear().toString() });
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
        <h1 className="text-2xl font-bold text-slate-900">Exams</h1>
        <p className="text-slate-500 text-sm">Schedule and manage examination periods.</p>
      </header>

      {(['Admin', 'admin', 'school_admin', 'Principal'].includes(user?.role || '')) && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Exam Name</label>
            <input 
              required
              value={formData.exam_name}
              onChange={(e) => setFormData({...formData, exam_name: e.target.value})}
              placeholder="e.g. End of Term 1"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Term</label>
            <select 
              value={formData.term}
              onChange={(e) => setFormData({...formData, term: e.target.value})}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
            >
              <option value="1">Term 1</option>
              <option value="2">Term 2</option>
              <option value="3">Term 3</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Year</label>
            <input 
              type="number"
              required
              value={formData.year}
              onChange={(e) => setFormData({...formData, year: e.target.value})}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
            />
          </div>
          <div className="md:col-span-4 flex justify-end">
            <button 
              type="submit" 
              disabled={examMutation.isPending || isReadOnly}
              className="px-6 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white disabled:opacity-50 flex items-center gap-2"
            >
              {isReadOnly ? <Lock size={18} /> : <Plus size={18} />}
              {examMutation.isPending ? 'Processing...' : 'Create Exam'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {examsQuery.isLoading ? (
          <div className="col-span-2"><TableSkeleton rows={4} cols={1} /></div>
        ) : exams.map((exam) => (
          <div key={exam.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between group overflow-hidden">
            <div className="flex items-center gap-4 flex-1">
              <div className="bg-blue-50 text-blue-600 p-3 rounded-lg">
                <Calendar size={20} />
              </div>
              {editingId === exam.id ? (
                <div className="flex-1 space-y-2 max-w-[200px]">
                  <input 
                    value={editFormData.exam_name}
                    onChange={(e) => setEditFormData({...editFormData, exam_name: e.target.value})}
                    className="w-full px-2 py-1 text-sm border rounded outline-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <select 
                      value={editFormData.term}
                      onChange={(e) => setEditFormData({...editFormData, term: e.target.value})}
                      className="flex-1 px-1 py-1 text-xs border rounded outline-none"
                    >
                      <option value="1">T1</option>
                      <option value="2">T2</option>
                      <option value="3">T3</option>
                    </select>
                    <input 
                      type="number"
                      value={editFormData.year}
                      onChange={(e) => setEditFormData({...editFormData, year: e.target.value})}
                      className="w-16 px-1 py-1 text-xs border rounded outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="font-bold text-slate-900">{exam.exam_name}</h3>
                  <p className="text-xs text-slate-500">Term {exam.term}, {exam.year}</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 ml-4">
              {(['Admin', 'admin', 'school_admin', 'Principal'].includes(user?.role || '')) && (
                <div className="flex gap-1">
                  {editingId === exam.id ? (
                    <>
                      <button onClick={handleUpdate} className="text-green-600 hover:bg-green-50 p-1.5 rounded-lg transition-colors">
                        <Check size={18} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-slate-400 hover:bg-slate-50 p-1.5 rounded-lg transition-colors">
                        <X size={18} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleEditClick(exam)}
                        disabled={isReadOnly}
                        className="p-3 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-20"
                      >
                        <Edit2 size={20} />
                      </button>
                      
                      {deleteConfirmId === exam.id ? (
                        <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-100">
                          <button 
                            onClick={() => handleDelete(exam.id)}
                            className="text-red-600 hover:bg-red-100 p-2 rounded text-xs font-bold"
                          >
                            Confirm
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-slate-500 hover:bg-slate-200 p-2 rounded"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setDeleteConfirmId(exam.id)}
                          disabled={isReadOnly}
                          className="p-3 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-20"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Exams;
