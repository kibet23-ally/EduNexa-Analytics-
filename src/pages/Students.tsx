/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { useSubscription } from '../useSubscription';
import { Student, Grade } from '../types';
import { useData, useDataMutation } from '../hooks/useData';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Search, UserPlus, Trash2, Edit2, X, Check, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import debounce from 'lodash/debounce';

const PAGE_SIZE = 50;

const isAdmin = (role?: string) =>
  ['Admin', 'admin', 'school_admin', 'Principal', 'SuperAdmin', 'super_admin'].includes(role || '');

const Students = () => {
  const { user } = useAuth();
  const { isReadOnly } = useSubscription();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);

  const debouncedSetSearch = useMemo(
    () => debounce((val: string) => {
      setDebouncedSearch(val);
      setPage(0);
    }, 500),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    debouncedSetSearch(e.target.value);
  };

  const gradesQuery = useData<Grade>('grades-list', 'grades', {
    select: 'id, grade_name',
    orderBy: { column: 'grade_name', ascending: true }
  }, !!user?.school_id);

  const studentsQuery = useData<Student & { grades: { grade_name: string } }>(
    'students-page',
    'students',
    {
      select: 'id, name, admission_number, gender, grade_id, grades:grade_id(grade_name)',
      range: { from: page * PAGE_SIZE, to: (page + 1) * PAGE_SIZE - 1 },
    },
    !!user?.school_id
  );

  const studentsMutation = useDataMutation('students');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    admission_number: '',
    gender: 'Male',
    grade_id: ''
  });

  const students = useMemo(() => {
    let items = studentsQuery.data || [];
    if (debouncedSearch) {
      items = items.filter(s =>
        s.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        s.admission_number.includes(debouncedSearch)
      );
    }
    return items;
  }, [studentsQuery.data, debouncedSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return setError('Read-only mode (Subscription expired)');
    setError(null);
    try {
      const payload = {
        name: formData.name,
        admission_number: formData.admission_number,
        gender: formData.gender,
        grade_id: parseInt(formData.grade_id),
        school_id: Number(user?.school_id)
      };
      if (editingId) {
        await studentsMutation.mutateAsync({ operation: 'update', payload, filters: { id: editingId } });
      } else {
        await studentsMutation.mutateAsync({ operation: 'insert', payload: [payload] });
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({ name: '', admission_number: '', gender: 'Male', grade_id: '' });
    } catch (err: any) {
      setError(err?.message || 'Failed to save student');
    }
  };

  const handleDelete = async (id: number) => {
    if (isReadOnly) return;
    try {
      await studentsMutation.mutateAsync({ operation: 'delete', filters: { id } });
      setDeleteConfirmId(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete');
    }
  };

  const handleEditClick = (student: Student) => {
    setEditingId(student.id);
    setFormData({
      name: student.name,
      admission_number: student.admission_number,
      gender: student.gender,
      grade_id: student.grade_id.toString()
    });
    setShowModal(true);
  };

  const grades = gradesQuery.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-slate-500 text-sm">Manage student records and enrollment.</p>
        </div>
        {isAdmin(user?.role) && (
          <div className="flex gap-2">
            <button
              disabled={isReadOnly}
              onClick={() => {
                setEditingId(null);
                setFormData({ name: '', admission_number: '', gender: 'Male', grade_id: '' });
                setShowModal(true);
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm ${
                isReadOnly ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isReadOnly ? <Lock size={18} /> : <UserPlus size={18} />}
              Add Student
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X size={16} /></button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name or admission number..."
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-2 border rounded-lg disabled:opacity-50">
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs font-bold text-slate-500">Page {page + 1}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={(studentsQuery.data?.length || 0) < PAGE_SIZE} className="p-2 border rounded-lg disabled:opacity-50">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {studentsQuery.isLoading ? (
            <div className="p-8"><TableSkeleton rows={10} cols={5} /></div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="px-6 py-3">Admission No</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Gender</th>
                  <th className="px-6 py-3">Grade</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-blue-600 font-medium">{student.admission_number}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{student.name}</td>
                    <td className="px-6 py-4 text-slate-600">{student.gender}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                        {(student.grades as any)?.grade_name || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin(user?.role) && (
                          <>
                            {deleteConfirmId === student.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleDelete(student.id)} className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg"><Check size={18} /></button>
                                <button onClick={() => setDeleteConfirmId(null)} className="text-slate-400 hover:bg-slate-50 p-1.5 rounded-lg"><X size={18} /></button>
                              </div>
                            ) : (
                              <>
                                <button onClick={() => handleEditClick(student)} className="text-blue-600 hover:text-blue-800 p-1"><Edit2 size={18} /></button>
                                <button onClick={() => setDeleteConfirmId(student.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={18} /></button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-blue-900 p-6 text-white">
              <h3 className="text-lg font-bold">{editingId ? 'Edit Student' : 'Add New Student'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                <input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border rounded-lg text-sm outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Admission Number</label>
                <input required value={formData.admission_number} onChange={(e) => setFormData({ ...formData, admission_number: e.target.value })} className="w-full px-4 py-2 border rounded-lg text-sm outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Gender</label>
                  <select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} className="w-full px-4 py-2 border rounded-lg text-sm">
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Grade</label>
                  <select required value={formData.grade_id} onChange={(e) => setFormData({ ...formData, grade_id: e.target.value })} className="w-full px-4 py-2 border rounded-lg text-sm">
                    <option value="">Select Grade</option>
                    {grades.map(g => <option key={g.id} value={g.id.toString()}>{g.grade_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm font-medium">Cancel</button>
                <button type="submit" disabled={studentsMutation.isPending} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {studentsMutation.isPending ? 'Saving...' : (editingId ? 'Update' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;
