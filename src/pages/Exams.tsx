import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { Exam } from '../types';
import { Plus, Calendar, Trash2, Edit2, X, Check } from 'lucide-react';

const Exams = () => {
  const { token, user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [formData, setFormData] = useState({ exam_name: '', term: '1', year: new Date().getFullYear().toString() });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState({ exam_name: '', term: '1', year: '' });
  const [error, setError] = useState<string | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const fetchExams = React.useCallback(async () => {
    try {
      const res = await fetch('/api/exams', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setExams(data);
        setError(null);
      } else {
        setError(data.error || 'Failed to load exams');
        setExams([]);
      }
    } catch {
      setError('Could not connect to server');
    }
  }, [token]);

  useEffect(() => {
    Promise.resolve().then(() => fetchExams());
  }, [fetchExams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/exams', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...formData,
        term: parseInt(formData.term),
        year: parseInt(formData.year)
      }),
    });
    if (res.ok) {
      setFormData({ exam_name: '', term: '1', year: new Date().getFullYear().toString() });
      fetchExams();
    }
  };

  const handleEditClick = (exam: Exam) => {
    setEditingId(exam.id);
    setEditFormData({
      exam_name: exam.exam_name,
      term: exam.term.toString(),
      year: exam.year.toString()
    });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const res = await fetch(`/api/exams/${editingId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        exam_name: editFormData.exam_name,
        term: parseInt(editFormData.term),
        year: parseInt(editFormData.year)
      }),
    });
    if (res.ok) {
      setEditingId(null);
      fetchExams();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to update exam');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/exams/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();

      if (res.ok) {
        setDeleteConfirmId(null);
        fetchExams();
      } else {
        alert(data.error || 'Failed to delete exam');
        setDeleteConfirmId(null);
      }
    } catch {
      alert('Could not connect to the server to delete the exam');
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Exams</h1>
        <p className="text-slate-500 text-sm">Schedule and manage examination periods.</p>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {user?.role === 'Admin' && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Exam Name</label>
            <input 
              required
              value={formData.exam_name}
              onChange={(e) => setFormData({...formData, exam_name: e.target.value})}
              placeholder="e.g. End of Term 1"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Term</label>
            <select 
              value={formData.term}
              onChange={(e) => setFormData({...formData, term: e.target.value})}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
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
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="md:col-span-4 flex justify-end">
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <Plus size={18} />
              Create Exam
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exams.map((exam) => (
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
                    className="w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 outline-none"
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
              {user?.role === 'Admin' && (
                <div className="flex gap-1">
                  {editingId === exam.id ? (
                    <>
                      <button onClick={handleUpdate} className="text-green-600 hover:bg-green-50 p-1.5 rounded-lg transition-colors" title="Save">
                        <Check size={18} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-slate-400 hover:bg-slate-50 p-1.5 rounded-lg transition-colors" title="Cancel">
                        <X size={18} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleEditClick(exam)}
                        className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-3 rounded-lg transition-colors border border-transparent"
                        title="Edit"
                      >
                        <Edit2 size={20} />
                      </button>
                      
                      {deleteConfirmId === exam.id ? (
                        <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-100">
                          <button 
                            onClick={() => handleDelete(exam.id)}
                            className="text-red-600 hover:bg-red-100 p-2 rounded text-xs font-bold flex items-center gap-1"
                          >
                            <Trash2 size={16} /> Confirm
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
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-3 rounded-lg transition-colors border border-transparent"
                          title="Delete"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
              {editingId !== exam.id && (
                <span className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded uppercase">
                  Active
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Exams;
