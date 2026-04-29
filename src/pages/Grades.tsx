import React, { useState, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { useSubscription } from '../useSubscription';
import { Grade } from '../types';
import { useData, useDataMutation } from '../hooks/useData';
import { Plus, Trash2, Lock } from 'lucide-react';
import { TableSkeleton } from '../components/ui/Skeleton';

const Grades = () => {
  const { user } = useAuth();
  const { isReadOnly } = useSubscription();
  const [newGrade, setNewGrade] = useState('');
  const [error, setError] = useState<string | null>(null);

  const gradesQuery = useData<Grade>('grades-full-list', 'grades', {
    select: 'id, grade_name',
    orderBy: { column: 'grade_name', ascending: true }
  }, !!user?.school_id);

  const gradeMutation = useDataMutation('grades');

  const grades = useMemo(() => {
    const data = gradesQuery.data || [];
    return [...data].sort((a, b) => {
      const numA = parseInt(a.grade_name.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.grade_name.match(/\d+/)?.[0] || '0');
      if (numA !== numB) return numA - numB;
      return a.grade_name.localeCompare(b.grade_name);
    });
  }, [gradesQuery.data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return setError("Subscription expired (Read-only)");
    if (!newGrade || !user?.school_id) return;
    
    setError(null);
    try {
      await gradeMutation.mutateAsync({ 
        operation: 'insert', 
        payload: [{ grade_name: newGrade, school_id: Number(user.school_id) }]
      });
      setNewGrade('');
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (id: number) => {
    if (isReadOnly) return;
    if (!window.confirm('Delete this grade?')) return;
    try {
      await gradeMutation.mutateAsync({ operation: 'delete', filters: { id } });
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Grades</h1>
        <p className="text-slate-500 text-sm">Define the classes/grades in your school (e.g., Grade 7, Grade 8).</p>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {(user?.role === 'Admin' || user?.role === 'Principal' || user?.role === 'SuperAdmin') && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex gap-4">
          <input 
            required
            value={newGrade}
            onChange={(e) => setNewGrade(e.target.value)}
            placeholder="Enter grade name (e.g. Grade 7)"
            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <button 
            type="submit" 
            disabled={isReadOnly}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              isReadOnly ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isReadOnly ? <Lock size={18} /> : <Plus size={18} />}
            Add Grade
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {gradesQuery.isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={8} cols={3} />
          </div>
        ) : (
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
                    {(user?.role === 'Admin' || user?.role === 'Principal' || user?.role === 'SuperAdmin') && (
                      <button 
                        onClick={() => handleDelete(grade.id)}
                        className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete Grade"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Grades;
