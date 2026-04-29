import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { useSubscription } from '../useSubscription';
import { Subject } from '../types';
import { fetchWithProxy, writeWithProxy } from '../lib/fetchProxy';
import { Plus, BookOpen, Edit2, X, Check, Trash2, Lock } from 'lucide-react';

const Subjects = () => {
  const { user } = useAuth();
  const { isReadOnly } = useSubscription();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [formData, setFormData] = useState({ subject_name: '', subject_code: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState({ subject_name: '', subject_code: '' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSubjects = React.useCallback(async () => {
    if (!user?.school_id) return;
    try {
      const result = await fetchWithProxy('subjects');
      const subjectsData = result.data || [];

      setSubjects([...subjectsData].sort((a: Subject, b: Subject) => a.subject_name.localeCompare(b.subject_name)));
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not connect to server');
    }
  }, [user]);

  useEffect(() => {
    Promise.resolve().then(() => fetchSubjects());
  }, [fetchSubjects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      setError("Subscription expired. Read-only mode.");
      return;
    }
    if (!user?.school_id) {
      setError("No School ID found. Session might be stale.");
      return;
    }
    setError(null);
    try {
      const payload = {
        subject_name: formData.subject_name,
        subject_code: formData.subject_code,
        school_id: Number(user.school_id)
      };
      
      console.log("PROFILE:", user);
      console.log("SUBJECT PAYLOAD VIA PROXY:", payload);

      await writeWithProxy('subjects', 'insert', [payload]);
      
      setFormData({ subject_name: '', subject_code: '' });
      fetchSubjects();
    } catch (err: unknown) {
      console.error("Submission Error:", err);
      setError(err instanceof Error ? err.message : 'Failed to add subject');
    }
  };

  const handleEditClick = (subject: Subject) => {
    setEditingId(subject.id);
    setEditFormData({ subject_name: subject.subject_name, subject_code: subject.subject_code });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId === null) return;
    if (isReadOnly) {
      setError("Subscription expired. Cannot update.");
      return;
    }
    setError(null);
    try {
      await writeWithProxy('subjects', 'update', editFormData, { id: editingId });
      setEditingId(null);
      fetchSubjects();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update subject');
    }
  };

  const handleDelete = async (id: number) => {
    if (isReadOnly) {
      setError("Subscription expired. Cannot delete.");
      return;
    }
    setError(null);
    try {
      await writeWithProxy('subjects', 'delete', null, { id });
      setDeleteConfirmId(null);
      fetchSubjects();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete subject');
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Subjects</h1>
        <p className="text-slate-500 text-sm">Manage the curriculum and subject codes.</p>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <X size={16} onClick={() => setError(null)} className="cursor-pointer" />
          {error}
        </div>
      )}

      {user?.role === 'Admin' && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Subject Name</label>
            <input 
              required
              value={formData.subject_name}
              onChange={(e) => setFormData({...formData, subject_name: e.target.value})}
              placeholder="e.g. Mathematics"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Subject Code</label>
            <input 
              required
              value={formData.subject_code}
              onChange={(e) => setFormData({...formData, subject_code: e.target.value})}
              placeholder="e.g. MATH"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button 
            type="submit" 
            disabled={isReadOnly}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              isReadOnly ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isReadOnly ? <Lock size={18} /> : <Plus size={18} />}
            Add Subject
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map((subject) => (
          <div key={subject.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between group relative overflow-hidden">
            <div className="flex items-center gap-4 flex-1">
              <div className="bg-blue-50 text-blue-600 p-3 rounded-lg">
                <BookOpen size={20} />
              </div>
              {editingId === subject.id ? (
                <div className="flex-1 space-y-2">
                  <input 
                    value={editFormData.subject_name}
                    onChange={(e) => setEditFormData({...editFormData, subject_name: e.target.value})}
                    className="w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 outline-none"
                    autoFocus
                  />
                  <input 
                    value={editFormData.subject_code}
                    onChange={(e) => setEditFormData({...editFormData, subject_code: e.target.value})}
                    className="w-full px-2 py-1 text-xs font-mono border rounded uppercase focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              ) : (
                <div>
                  <h3 className="font-bold text-slate-900">{subject.subject_name}</h3>
                  <p className="text-xs font-mono text-slate-400 uppercase">{subject.subject_code}</p>
                </div>
              )}
            </div>
            
            {user?.role === 'Admin' && (
              <div className="flex gap-1 ml-2">
                {editingId === subject.id ? (
                  <>
                    <button onClick={handleUpdate} className="text-green-600 hover:bg-green-50 p-1.5 rounded-lg transition-colors" title="Save">
                      <Check size={16} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-slate-400 hover:bg-slate-50 p-1.5 rounded-lg transition-colors" title="Cancel">
                      <X size={16} />
                    </button>
                  </>
                ) : deleteConfirmId === subject.id ? (
                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleDelete(subject.id)}
                      className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                      title="Confirm Delete"
                    >
                      <Check size={16} />
                    </button>
                    <button 
                      onClick={() => setDeleteConfirmId(null)}
                      className="text-slate-400 hover:bg-slate-50 p-1.5 rounded-lg transition-colors"
                      title="Cancel"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <button 
                      onClick={() => handleEditClick(subject)}
                      className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-all"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => setDeleteConfirmId(subject.id)}
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-all"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Subjects;
