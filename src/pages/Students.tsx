/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../useAuth';
import { useSubscription } from '../useSubscription';
import { Student, Grade } from '../types';
import { useData, useDataMutation } from '../hooks/useData';
import { fetchWithProxy } from '../lib/fetchProxy';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Search, UserPlus, Archive, Edit2, X, Check, Lock, ChevronLeft, ChevronRight, RotateCcw, Download } from 'lucide-react';
import debounce from 'lodash/debounce';
import ClassListModal from '../components/ClassListModal';

const PAGE_SIZE = 50;

const isAdmin = (role?: string) =>
  ['Admin', 'admin', 'school_admin', 'Principal', 'SuperAdmin', 'super_admin'].includes(role || '');

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-green-50 text-green-700',
  Transferred: 'bg-amber-50 text-amber-700',
  Alumni: 'bg-slate-100 text-slate-600',
  Suspended: 'bg-red-50 text-red-700',
};

const Students = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isReadOnly } = useSubscription();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [guardianMatchIds, setGuardianMatchIds] = useState<number[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveConfirmId, setArchiveConfirmId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showClassListModal, setShowClassListModal] = useState(false);

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

  // Fast search also covers parent/guardian phone — resolve matching student_ids
  // from the guardians table whenever a search term is active.
  useEffect(() => {
    if (!debouncedSearch || !user?.school_id) { setGuardianMatchIds(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await fetchWithProxy('guardians', {
        select: 'student_id, phone',
        filters: { school_id: user.school_id },
      });
      if (cancelled) return;
      const matches = (Array.isArray(data) ? data : [])
        .filter((g: any) => g.phone && String(g.phone).includes(debouncedSearch))
        .map((g: any) => g.student_id);
      setGuardianMatchIds(matches.length ? matches : null);
    })();
    return () => { cancelled = true; };
  }, [debouncedSearch, user?.school_id]);

  const gradesQuery = useData<Grade>('grades-list', 'grades', {
    select: 'id, grade_name',
    orderBy: { column: 'grade_name', ascending: true }
  }, !!user?.school_id);

  const studentsQuery = useData<Student & { grades: { grade_name: string } }>(
    'students-page',
    'students',
    {
      select: 'id, name, admission_number, uli_number, gender, grade_id, student_status, deleted_at, grades:grade_id(grade_name)',
      limit: 2000,
    },
    !!user?.school_id
  );

  const studentsMutation = useDataMutation('students');

  const filteredStudents = useMemo(() => {
    let items = (studentsQuery.data || []) as any[];
    items = items.filter(s => showArchived ? !!s.deleted_at : !s.deleted_at);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.admission_number || '').toLowerCase().includes(q) ||
        (s.uli_number || '').toLowerCase().includes(q) ||
        (guardianMatchIds?.includes(s.id) ?? false)
      );
    }
    return items;
  }, [studentsQuery.data, debouncedSearch, guardianMatchIds, showArchived]);

  // Client-side pagination — the data layer (useData/fetchWithProxy) has no
  // server-side range/offset support, so page slicing happens here instead.
  const students = useMemo(
    () => filteredStudents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredStudents, page]
  );
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));

  useEffect(() => {
    if (page > 0 && page >= totalPages) setPage(0);
  }, [totalPages, page]);

  const handleArchive = async (id: number) => {
    if (isReadOnly) return;
    try {
      await studentsMutation.mutateAsync({
        operation: 'update',
        payload: { deleted_at: new Date().toISOString(), deleted_by: user?.id },
        filters: { id },
      });
      setArchiveConfirmId(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to archive learner');
    }
  };

  const handleRestore = async (id: number) => {
    if (isReadOnly) return;
    try {
      await studentsMutation.mutateAsync({
        operation: 'update',
        payload: { deleted_at: null, deleted_by: null },
        filters: { id },
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to restore learner');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-slate-500 text-sm">Manage learner profiles and enrollment.</p>
        </div>
        {isAdmin(user?.role) && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowClassListModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <Download size={18} />
              <span className="hidden sm:inline">Download Class List</span>
              <span className="sm:hidden">Class List</span>
            </button>
            <button
              disabled={isReadOnly}
              onClick={() => navigate('/students/onboard')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm ${
                isReadOnly ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isReadOnly ? <Lock size={18} /> : <UserPlus size={18} />}
              Admit Learner
            </button>
          </div>
        )}
      </div>

      <ClassListModal isOpen={showClassListModal} onClose={() => setShowClassListModal(false)} />

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
              placeholder="Search by name, admission no, ULI, or parent phone..."
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500 whitespace-nowrap">
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
            Show archived
          </label>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-2 border rounded-lg disabled:opacity-50">
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs font-bold text-slate-500">Page {page + 1} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(p + 1, totalPages - 1))} disabled={page >= totalPages - 1} className="p-2 border rounded-lg disabled:opacity-50">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {studentsQuery.isLoading ? (
            <div className="p-8"><TableSkeleton rows={10} cols={6} /></div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="px-6 py-3">Admission No</th>
                  <th className="px-6 py-3">ULI</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Gender</th>
                  <th className="px-6 py-3">Grade</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {students.map((student: any) => (
                  <tr key={student.id} className={`hover:bg-slate-50 transition-colors ${student.deleted_at ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4 font-mono text-blue-600 font-medium">{student.admission_number}</td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{student.uli_number || '—'}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{student.name}</td>
                    <td className="px-6 py-4 text-slate-600">{student.gender}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                        {(student.grades as any)?.grade_name || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[student.student_status] || 'bg-slate-100 text-slate-600'}`}>
                        {student.deleted_at ? 'Archived' : (student.student_status || 'Active')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin(user?.role) && (
                          student.deleted_at ? (
                            <button onClick={() => handleRestore(student.id)} className="inline-flex items-center gap-1 text-green-600 hover:text-green-800 text-xs font-medium p-1">
                              <RotateCcw size={16} /> Restore
                            </button>
                          ) : archiveConfirmId === student.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleArchive(student.id)} className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg"><Check size={18} /></button>
                              <button onClick={() => setArchiveConfirmId(null)} className="text-slate-400 hover:bg-slate-50 p-1.5 rounded-lg"><X size={18} /></button>
                            </div>
                          ) : (
                            <>
                              <button onClick={() => navigate(`/students/${student.id}/edit`)} className="text-blue-600 hover:text-blue-800 p-1"><Edit2 size={18} /></button>
                              <button onClick={() => setArchiveConfirmId(student.id)} className="text-red-400 hover:text-red-600 p-1" title="Archive (soft delete)"><Archive size={18} /></button>
                            </>
                          )
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
    </div>
  );
};

export default Students;
