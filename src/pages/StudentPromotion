import React, { useState, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { supabase } from '../lib/supabase';
import {
  GraduationCap, ChevronRight, CheckCircle2, AlertTriangle,
  Users, RotateCcw, Trophy, ArrowRight, Info
} from 'lucide-react';

interface Grade {
  id: number;
  grade_name: string;
}

interface Student {
  id: number;
  name: string;
  admission_number: string;
  gender: string;
  grade_id: number;
}

interface PromotionHistory {
  id: number;
  student_name: string;
  from_grade: string;
  to_grade: string | null;
  status: 'promoted' | 'retained' | 'graduated';
  academic_year: string;
  promoted_at: string;
}

type StudentAction = 'promote' | 'retain' | 'graduate';

interface StudentDecision {
  studentId: number;
  action: StudentAction;
}

const ACTION_STYLES: Record<StudentAction, string> = {
  promote:  'bg-emerald-50 border-emerald-200 text-emerald-700',
  retain:   'bg-amber-50 border-amber-200 text-amber-700',
  graduate: 'bg-blue-50 border-blue-200 text-blue-700',
};

const ACTION_LABELS: Record<StudentAction, string> = {
  promote:  'Promote',
  retain:   'Retain',
  graduate: 'Graduate',
};

export default function StudentPromotion() {
  const { user } = useAuth();

  const [grades, setGrades]           = useState<Grade[]>([]);
  const [students, setStudents]       = useState<Student[]>([]);
  const [history, setHistory]         = useState<PromotionHistory[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [decisions, setDecisions]     = useState<Record<number, StudentDecision>>({});
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));
  const [loading, setLoading]         = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [feedback, setFeedback]       = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeTab, setActiveTab]     = useState<'promote' | 'history'>('promote');
  const [confirmed, setConfirmed]     = useState(false);

  // Load grades on mount
  React.useEffect(() => {
    if (!user?.school_id) return;
    supabase
      .from('grades')
      .select('id, grade_name')
      .eq('school_id', user.school_id)
      .order('grade_name')
      .then(({ data }) => setGrades(data || []));

    loadHistory();
  }, [user?.school_id]);

  const loadHistory = async () => {
    if (!user?.school_id) return;
    const { data } = await supabase
      .from('promotion_history')
      .select('id, student_name, from_grade, to_grade, status, academic_year, promoted_at')
      .eq('school_id', user.school_id)
      .order('promoted_at', { ascending: false })
      .limit(100);
    setHistory(data || []);
  };

  // Load students when grade is selected
  const loadStudents = async (gradeId: number) => {
    setLoadingStudents(true);
    setDecisions({});
    setConfirmed(false);
    const { data } = await supabase
      .from('students')
      .select('id, name, admission_number, gender, grade_id')
      .eq('grade_id', gradeId)
      .eq('school_id', user?.school_id)
      .order('name');
    setStudents(data || []);
    setLoadingStudents(false);
  };

  const handleGradeSelect = (gradeId: number) => {
    setSelectedGrade(gradeId);
    loadStudents(gradeId);
  };

  // Next grade in sequence based on grade_name
  const nextGrade = useMemo(() => {
    if (!selectedGrade) return null;
    const current = grades.find(g => g.id === selectedGrade);
    if (!current) return null;

    // Extract number from grade name e.g. "Grade 7" → 7
    const currentNum = parseInt(current.grade_name.replace(/\D/g, ''), 10);
    return grades.find(g => {
      const n = parseInt(g.grade_name.replace(/\D/g, ''), 10);
      return n === currentNum + 1;
    }) ?? null;
  }, [selectedGrade, grades]);

  const isTopGrade = useMemo(() => {
    if (!selectedGrade) return false;
    const current = grades.find(g => g.id === selectedGrade);
    if (!current) return false;
    const currentNum = parseInt(current.grade_name.replace(/\D/g, ''), 10);
    return !grades.some(g => parseInt(g.grade_name.replace(/\D/g, ''), 10) === currentNum + 1);
  }, [selectedGrade, grades]);

  const setDecision = (studentId: number, action: StudentAction) => {
    setDecisions(prev => ({ ...prev, [studentId]: { studentId, action } }));
  };

  const setAllDecisions = (action: StudentAction) => {
    const bulk: Record<number, StudentDecision> = {};
    students.forEach(s => { bulk[s.id] = { studentId: s.id, action }; });
    setDecisions(bulk);
  };

  const counts = useMemo(() => {
    const vals = Object.values(decisions);
    return {
      promote:  vals.filter(d => d.action === 'promote').length,
      retain:   vals.filter(d => d.action === 'retain').length,
      graduate: vals.filter(d => d.action === 'graduate').length,
      undecided: students.length - vals.length,
    };
  }, [decisions, students]);

  const allDecided = students.length > 0 && counts.undecided === 0;

  const handlePromote = async () => {
    if (!allDecided || !selectedGrade || !user?.school_id) return;
    setLoading(true);
    setFeedback(null);

    try {
      const currentGrade = grades.find(g => g.id === selectedGrade)!;
      const historyRows: object[] = [];
      const updates: Promise<unknown>[] = [];

      for (const student of students) {
        const decision = decisions[student.id];
        if (!decision) continue;

        if (decision.action === 'promote' && nextGrade) {
          // Move to next grade
          updates.push(
            supabase.from('students').update({ grade_id: nextGrade.id }).eq('id', student.id)
          );
          historyRows.push({
            school_id:    user.school_id,
            student_id:   student.id,
            student_name: student.name,
            from_grade_id: selectedGrade,
            from_grade:   currentGrade.grade_name,
            to_grade_id:  nextGrade.id,
            to_grade:     nextGrade.grade_name,
            promoted_by:  user.id,
            academic_year: academicYear,
            status:       'promoted',
          });
        } else if (decision.action === 'retain') {
          // Stay in same grade — no update needed, just log it
          historyRows.push({
            school_id:    user.school_id,
            student_id:   student.id,
            student_name: student.name,
            from_grade_id: selectedGrade,
            from_grade:   currentGrade.grade_name,
            to_grade_id:  selectedGrade,
            to_grade:     currentGrade.grade_name,
            promoted_by:  user.id,
            academic_year: academicYear,
            status:       'retained',
          });
        } else if (decision.action === 'graduate') {
          // Remove from active students (or keep — here we just log graduation)
          historyRows.push({
            school_id:    user.school_id,
            student_id:   student.id,
            student_name: student.name,
            from_grade_id: selectedGrade,
            from_grade:   currentGrade.grade_name,
            to_grade_id:  null,
            to_grade:     null,
            promoted_by:  user.id,
            academic_year: academicYear,
            status:       'graduated',
          });
        }
      }

      // Run all grade updates in parallel
      await Promise.all(updates);

      // Insert history records
      if (historyRows.length > 0) {
        const { error } = await supabase.from('promotion_history').insert(historyRows);
        if (error) throw error;
      }

      setFeedback({
        type: 'success',
        message: `Done! ${counts.promote} promoted, ${counts.retain} retained, ${counts.graduate} graduated.`,
      });

      // Reset
      setSelectedGrade(null);
      setStudents([]);
      setDecisions({});
      setConfirmed(false);
      loadHistory();
      setTimeout(() => setFeedback(null), 5000);

    } catch (err: unknown) {
      setFeedback({ type: 'error', message: (err as Error).message || 'Promotion failed.' });
    } finally {
      setLoading(false);
    }
  };

  const selectedGradeName = grades.find(g => g.id === selectedGrade)?.grade_name ?? '';

  return (
    <div className="space-y-6">
      {/* Toast */}
      {feedback && (
        <div className={`fixed top-4 right-4 z-[100] px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 max-w-sm ${
          feedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
            : 'bg-red-50 border-red-100 text-red-800'
        }`}>
          {feedback.type === 'success'
            ? <CheckCircle2 size={18} className="shrink-0" />
            : <AlertTriangle size={18} className="shrink-0" />
          }
          <span className="font-bold text-sm">{feedback.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Student Promotion</h1>
          <p className="text-slate-500 text-sm">Promote learners to the next grade at end of year.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">Academic Year</label>
          <input
            type="number"
            value={academicYear}
            onChange={e => setAcademicYear(e.target.value)}
            min={2020} max={2099}
            className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold text-center focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(['promote', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-bold capitalize transition-all border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab === 'promote' ? 'Promote Students' : 'Promotion History'}
          </button>
        ))}
      </div>

      {/* ── PROMOTE TAB ─────────────────────────────────────── */}
      {activeTab === 'promote' && (
        <div className="space-y-6">

          {/* Step 1: Select grade */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
              Select Grade to Promote From
            </h3>
            <p className="text-slate-400 text-xs mb-4 ml-8">Choose which grade's students you are processing this year.</p>
            <div className="flex flex-wrap gap-3 ml-8">
              {grades.map(g => (
                <button
                  key={g.id}
                  onClick={() => handleGradeSelect(g.id)}
                  className={`px-5 py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${
                    selectedGrade === g.id
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300'
                  }`}
                >
                  {g.grade_name}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Decide per student */}
          {selectedGrade && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                  <h3 className="font-bold text-slate-800">
                    {selectedGradeName} — {students.length} students
                  </h3>
                  {nextGrade && (
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <ArrowRight size={12} />
                      <span>Next: {nextGrade.grade_name}</span>
                    </div>
                  )}
                  {isTopGrade && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold border border-blue-100">
                      Final Grade
                    </span>
                  )}
                </div>

                {/* Bulk actions */}
                {students.length > 0 && (
                  <div className="sm:ml-auto flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-400 font-medium">Set all:</span>
                    {!isTopGrade && (
                      <button onClick={() => setAllDecisions('promote')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold hover:bg-emerald-100 transition-all">
                        All Promote
                      </button>
                    )}
                    <button onClick={() => setAllDecisions('retain')}
                      className="text-xs px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-bold hover:bg-amber-100 transition-all">
                      All Retain
                    </button>
                    {isTopGrade && (
                      <button onClick={() => setAllDecisions('graduate')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-bold hover:bg-blue-100 transition-all">
                        All Graduate
                      </button>
                    )}
                    <button onClick={() => setDecisions({})}
                      className="text-xs px-3 py-1.5 rounded-lg bg-slate-50 text-slate-500 border border-slate-200 font-medium hover:bg-slate-100 transition-all flex items-center gap-1">
                      <RotateCcw size={11} /> Clear
                    </button>
                  </div>
                )}
              </div>

              {loadingStudents ? (
                <div className="p-12 text-center text-slate-400 text-sm">Loading students…</div>
              ) : students.length === 0 ? (
                <div className="p-12 text-center">
                  <Users size={32} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">No students in this grade.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-xs text-slate-400 uppercase font-bold border-b bg-slate-50/50">
                      <tr>
                        <th className="px-5 py-3">Student</th>
                        <th className="px-5 py-3">Adm. No.</th>
                        <th className="px-5 py-3">Gender</th>
                        <th className="px-5 py-3 text-center">Decision</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {students.map(s => {
                        const decision = decisions[s.id]?.action;
                        return (
                          <tr key={s.id} className={`transition-colors ${decision ? 'bg-slate-50/40' : 'hover:bg-slate-50'}`}>
                            <td className="px-5 py-3 font-semibold text-slate-800 text-sm">{s.name}</td>
                            <td className="px-5 py-3 text-slate-400 text-xs font-mono">{s.admission_number}</td>
                            <td className="px-5 py-3 text-slate-500 text-xs capitalize">{s.gender}</td>
                            <td className="px-5 py-3">
                              <div className="flex items-center justify-center gap-2">
                                {/* Promote — hide if top grade */}
                                {!isTopGrade && (
                                  <button
                                    onClick={() => setDecision(s.id, 'promote')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                      decision === 'promote'
                                        ? ACTION_STYLES.promote + ' shadow-sm'
                                        : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-300 hover:text-emerald-600'
                                    }`}
                                  >
                                    Promote
                                  </button>
                                )}
                                {/* Retain */}
                                <button
                                  onClick={() => setDecision(s.id, 'retain')}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                    decision === 'retain'
                                      ? ACTION_STYLES.retain + ' shadow-sm'
                                      : 'bg-white border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-600'
                                  }`}
                                >
                                  Retain
                                </button>
                                {/* Graduate — only on top grade */}
                                {isTopGrade && (
                                  <button
                                    onClick={() => setDecision(s.id, 'graduate')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                      decision === 'graduate'
                                        ? ACTION_STYLES.graduate + ' shadow-sm'
                                        : 'bg-white border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-600'
                                    }`}
                                  >
                                    Graduate
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Summary + Confirm */}
          {selectedGrade && students.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                Review & Confirm
              </h3>

              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 ml-8">
                {[
                  { label: 'Promote',   value: counts.promote,   color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
                  { label: 'Retain',    value: counts.retain,    color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100' },
                  { label: 'Graduate',  value: counts.graduate,  color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-100' },
                  { label: 'Undecided', value: counts.undecided, color: 'text-slate-500',   bg: 'bg-slate-50 border-slate-100' },
                ].map(item => (
                  <div key={item.label} className={`rounded-xl border p-4 text-center ${item.bg}`}>
                    <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>

              {/* Warning if undecided */}
              {counts.undecided > 0 && (
                <div className="ml-8 flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
                  <Info size={16} className="text-amber-500 shrink-0" />
                  <p className="text-amber-700 text-sm font-medium">
                    {counts.undecided} student{counts.undecided > 1 ? 's have' : ' has'} no decision yet. Set all students before confirming.
                  </p>
                </div>
              )}

              {/* Confirm checkbox */}
              {allDecided && (
                <label className="ml-8 flex items-center gap-3 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={e => setConfirmed(e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <span className="text-sm text-slate-600 font-medium">
                    I confirm these decisions for <strong>{academicYear}</strong> academic year. This action will update student grades.
                  </span>
                </label>
              )}

              <div className="ml-8">
                <button
                  onClick={handlePromote}
                  disabled={!allDecided || !confirmed || loading}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-sm shadow-blue-100"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Processing…
                    </>
                  ) : (
                    <>
                      <GraduationCap size={18} />
                      Apply Promotion
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ─────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Promotion Records</h3>
            <button onClick={loadHistory} className="text-xs text-blue-600 hover:underline font-medium">Refresh</button>
          </div>
          {history.length === 0 ? (
            <div className="p-12 text-center">
              <Trophy size={32} className="text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No promotion records yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-slate-400 uppercase font-bold border-b">
                  <tr>
                    <th className="px-5 py-3">Student</th>
                    <th className="px-5 py-3">From</th>
                    <th className="px-5 py-3">To</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Year</th>
                    <th className="px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {history.map(h => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-semibold text-slate-800">{h.student_name}</td>
                      <td className="px-5 py-3 text-slate-500">{h.from_grade}</td>
                      <td className="px-5 py-3">
                        {h.to_grade ? (
                          <div className="flex items-center gap-1 text-slate-600">
                            <ChevronRight size={12} className="text-slate-300" />
                            {h.to_grade}
                          </div>
                        ) : (
                          <span className="text-blue-500 font-medium">Graduated</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                          h.status === 'promoted'  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          h.status === 'retained'  ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-blue-50 text-blue-700 border-blue-100'
                        }`}>
                          {h.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-500 text-xs">{h.academic_year}</td>
                      <td className="px-5 py-3 text-slate-400 text-xs">
                        {new Date(h.promoted_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}