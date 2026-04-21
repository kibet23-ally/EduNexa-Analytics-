import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { Grade } from '../types';
import { Plus, Trash2 } from 'lucide-react';

const Grades = () => {
  const { token, user } = useAuth();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [newGrade, setNewGrade] = useState('');

  const [error, setError] = useState<string | null>(null);

  const fetchGrades = React.useCallback(async () => {
    try {
      const res = await fetch('/api/grades', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setGrades(data);
        setError(null);
      } else {
        setError(data.error || 'Failed to load grades');
        setGrades([]);
      }
    } catch {
      setError('Could not connect to server');
    }
  }, [token]);

  useEffect(() => {
    Promise.resolve().then(() => fetchGrades());
  }, [fetchGrades]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGrade) return;
    const res = await fetch('/api/grades', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ grade_name: newGrade }),
    });
    if (res.ok) {
      setNewGrade('');
      fetchGrades();
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this grade?')) return;
    const res = await fetch(`/api/grades/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      fetchGrades();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to delete grade');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Grades</h1>
        <p className="text-slate-500 text-sm">Define the classes/grades in your school (e.g., Grade 7, Grade 8).</p>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {user?.role === 'Admin' && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex gap-4">
          <input 
            required
            value={newGrade}
            onChange={(e) => setNewGrade(e.target.value)}
            placeholder="Enter grade name (e.g. Grade 7)"
            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Plus size={18} />
            Add Grade
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
              <th className="px-6 py-3">ID</th>
              <th className="px-6 py-3">Grade Name</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {grades.map((grade) => (
              <tr key={grade.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-slate-400 font-mono">{grade.id}</td>
                <td className="px-6 py-4 font-medium text-slate-900">{grade.grade_name}</td>
                <td className="px-6 py-4 text-right">
                  {user?.role === 'Admin' && (
                    <button 
                      onClick={() => handleDelete(grade.id)}
                      className="text-red-400 hover:text-red-600 p-1 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Grades;
