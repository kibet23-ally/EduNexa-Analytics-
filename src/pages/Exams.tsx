import React, { useState, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { useSubscription } from '../useSubscription';
import { Exam } from '../types';
import { useData, useDataMutation } from '../hooks/useData';
import { Plus, Calendar, Trash2, Edit2, X, Check, Lock, AlertTriangle } from 'lucide-react';
import { TableSkeleton } from '../components/ui/Skeleton';

const Exams = () => {
  const { user, sessionReady } = useAuth();
  const { isReadOnly } = useSubscription();
  const examMutation = useDataMutation('exams');

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

  const isAdmin = ['Admin', 'admin', 'school_admin', 'Principal'].includes(user?.role || '');

  // ── Create form state ──
  const [formData, setFormData] = useState({
    exam_name: '',
    term: '1',
    year: new Date().getFullYear().toString(),
  });
  const [creating, setCreating] = useState(false);

  // ── Edit state ──
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState({
    exam_name: '',
    term: '1',
    year: '',
  });
  const [saving, setSaving] = useState(false);

  // ── Delete state ──
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Handlers ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !user?.school_id || !formData.exam_name.trim()) return;
    setCreating(true);
    try {
      await examMutation.mutateAsync({
        operation: 'insert',
        payload: [{
          exam_name: formData.exam_name.trim(),
          term: parseInt(formData.term),
          year: parseInt(formData.year),
          school_id: user.school_id,
        }],
      });
      setFormData({
        exam_name: '',
        term: '1',
        year: new Date().getFullYear().toString(),
      });
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleEditClick = (exam: Exam) => {
    if (isReadOnly) return;
    setDeleteConfirmId(null);
    setEditingId(exam.id);
    setEditFormData({
      exam_name: exam.exam_name,
      term: exam.term.toString(),
      year: exam.year.toString(),
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (isReadOnly || !editingId || !editFormData.exam_name.trim()) return;
    setSaving(true);
    try {
      await examMutation.mutateAsync({
        operation: 'update',
        payload: {
          exam_name: editFormData.exam_name.trim(),
          term: parseInt(editFormData.term),
          year: parseInt(editFormData.year),
        },
        criteria: { id: editingId },
      });
      setEditingId(null);
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = (id: number) => {
    if (isReadOnly) return;
    setEditingId(null);
    setDeleteConfirmId(id);
  };

  const handleDelete = async () => {
    if (isReadOnly || !deleteConfirmId) return;
    setDeleting(true);
    try {
      await examMutation.mutateAsync({
        operation: 'delete',
        criteria: { id: deleteConfirmId },
      });
      setDeleteConfirmId(null);
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const termLabel = (t: number) =>
    t === 1 ? 'Term 1' : t === 2 ? 'Term 2' : t === 3 ? 'Term 3' : `Term ${t}`;

  const termColor = (t: number) =>
    t === 1
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : t === 2
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-amber-50 text-amber-700 border-amber-200';

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Header ── */}
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="w-1 h-5 rounded-full bg-blue-700" />
            <span className="text-[10px] font-bold tracking-widest uppercase text-blue-700">
              Exam Management
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Exams</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Schedule and manage examination periods.
          </p>
        </div>
        <div className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full font-medium">
          {exams.length} exam{exams.length !== 1 ? 's' : ''}
        </div>
      </header>

      {/* ── Create form ── */}
      {isAdmin && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm"
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            New Examination
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              value={formData.exam_name}
              onChange={(e) => setFormData({ ...formData, exam_name: e.target.value })}
              placeholder="Exam name e.g. End of Term 1"
              required
              className="sm:col-span-2 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
            <select
              value={formData.term}
              onChange={(e) => setFormData({ ...formData, term: e.target.value })}
              className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-600"
            >
              <option value="1">Term 1</option>
              <option value="2">Term 2</option>
              <option value="3">Term 3</option>
            </select>
            <input
              type="number"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: e.target.value })}
              min="2020"
              max="2099"
              className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-600"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={creating || isReadOnly || !formData.exam_name.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{ background: '#1e3a5f' }}
            >
              {isReadOnly ? (
                <><Lock size={14} /> Read Only</>
              ) : creating ? (
                <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating…</>
              ) : (
                <><Plus size={14} /> Create Exam</>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── Exam list ── */}
      <div className="space-y-2">
        {examsQuery.isLoading ? (
          <TableSkeleton rows={4} cols={1} />
        ) : exams.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
            <Calendar size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No exams found for this school.</p>
            <p className="text-slate-400 text-sm mt-1">Create your first exam using the form above.</p>
          </div>
        ) : (
          exams.map((exam) => (
            <div
              key={exam.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all ${
                editingId === exam.id
                  ? 'border-blue-400 shadow-md ring-1 ring-blue-400/30'
                  : deleteConfirmId === exam.id
                  ? 'border-red-300 shadow-md ring-1 ring-red-300/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              {/* ── Normal view ── */}
              {editingId !== exam.id && (
                <div className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: '#e8f0fb' }}>
                      <Calendar size={16} style={{ color: '#1e3a5f' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {exam.exam_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${termColor(exam.term)}`}>
                          {termLabel(exam.term)}
                        </span>
                        <span className="text-[11px] text-slate-400">{exam.year}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  {isAdmin && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {deleteConfirmId === exam.id ? (
                        /* Delete confirmation inline */
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-600 font-medium hidden sm:block">
                            Delete this exam?
                          </span>
                          <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            {deleting ? (
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Check size={12} />
                            )}
                            Yes, Delete
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            disabled={deleting}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
                          >
                            <X size={12} /> Cancel
                          </button>
                        </div>
                      ) : (
                        /* Normal action buttons */
                        <>
                          {!isReadOnly && (
                            <>
                              <button
                                onClick={() => handleEditClick(exam)}
                                title="Edit exam"
                                className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteConfirm(exam.id)}
                                title="Delete exam"
                                className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                          {isReadOnly && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                              <Lock size={11} /> Read only
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Inline edit form ── */}
              {editingId === exam.id && (
                <div className="p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-3 flex items-center gap-1.5">
                    <Edit2 size={11} /> Editing Exam
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <input
                      value={editFormData.exam_name}
                      onChange={(e) => setEditFormData({ ...editFormData, exam_name: e.target.value })}
                      placeholder="Exam name"
                      className="px-3 py-2 text-sm border border-blue-300 rounded-xl bg-blue-50/30 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                    <select
                      value={editFormData.term}
                      onChange={(e) => setEditFormData({ ...editFormData, term: e.target.value })}
                      className="px-3 py-2 text-sm border border-blue-300 rounded-xl bg-blue-50/30 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-600"
                    >
                      <option value="1">Term 1</option>
                      <option value="2">Term 2</option>
                      <option value="3">Term 3</option>
                    </select>
                    <input
                      type="number"
                      value={editFormData.year}
                      onChange={(e) => setEditFormData({ ...editFormData, year: e.target.value })}
                      min="2020"
                      max="2099"
                      className="px-3 py-2 text-sm border border-blue-300 rounded-xl bg-blue-50/30 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      <X size={13} /> Cancel
                    </button>
                    <button
                      onClick={handleUpdate}
                      disabled={saving || !editFormData.exam_name.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all"
                      style={{ background: '#1e3a5f' }}
                    >
                      {saving ? (
                        <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                      ) : (
                        <><Check size={13} /> Save Changes</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Delete confirmation modal (fallback for mobile) ── */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => !deleting && setDeleteConfirmId(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Delete Exam</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {exams.find(e => e.id === deleteConfirmId)?.exam_name}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">
              This will permanently delete the exam and all associated marks. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Deleting…</>
                ) : (
                  <><Trash2 size={13} /> Delete</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Exams;
