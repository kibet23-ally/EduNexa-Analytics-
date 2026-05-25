import React, { useState, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { useSubscription } from '../useSubscription';
import { Exam, Grade, Subject, Student, Mark } from '../types';
import { useData, useDataMutation } from '../hooks/useData';
import {
  Save,
  Download,
  Search,
  GraduationCap,
  BookOpen,
  Target,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TableSkeleton } from '../components/ui/Skeleton';
import * as XLSX from 'xlsx';

interface Assignment {
  id: number;
  teacher_id: string;
  subject_id: number;
  grade_id: number;
  school_id: number;
  is_active: boolean;
}

/* =========================
 * CBC RUBRICS
 * ========================= */
const getRubric = (percent: number) => {
  if (percent >= 90)
    return { label: 'EE1', desc: 'Exceeding Expectations', tone: 'emerald', from: 'from-emerald-500', to: 'to-emerald-600' };
  if (percent >= 75)
    return { label: 'EE2', desc: 'Exceeding Expectations', tone: 'emerald', from: 'from-emerald-400', to: 'to-emerald-500' };
  if (percent >= 58)
    return { label: 'ME1', desc: 'Meeting Expectations', tone: 'blue', from: 'from-blue-500', to: 'to-blue-600' };
  if (percent >= 41)
    return { label: 'ME2', desc: 'Meeting Expectations', tone: 'blue', from: 'from-blue-400', to: 'to-blue-500' };
  if (percent >= 31)
    return { label: 'AE1', desc: 'Approaching Expectations', tone: 'amber', from: 'from-amber-500', to: 'to-amber-600' };
  if (percent >= 21)
    return { label: 'AE2', desc: 'Approaching Expectations', tone: 'amber', from: 'from-amber-400', to: 'to-amber-500' };
  if (percent >= 11)
    return { label: 'BE1', desc: 'Below Expectations', tone: 'red', from: 'from-red-400', to: 'to-red-500' };
  return { label: 'BE2', desc: 'Below Expectations', tone: 'red', from: 'from-red-500', to: 'to-red-700' };
};

const toneStyles: Record<string, { chip: string; bar: string; text: string }> = {
  emerald: { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', bar: 'bg-emerald-500', text: 'text-emerald-600' },
  blue: { chip: 'bg-blue-50 text-blue-700 ring-blue-200', bar: 'bg-blue-500', text: 'text-blue-600' },
  amber: { chip: 'bg-amber-50 text-amber-700 ring-amber-200', bar: 'bg-amber-500', text: 'text-amber-600' },
  red: { chip: 'bg-red-50 text-red-700 ring-red-200', bar: 'bg-red-500', text: 'text-red-600' },
};

/* =========================
 * GLASS CARD PRIMITIVE
 * ========================= */
const GlassCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...rest
}) => (
  <div
    className={`relative rounded-3xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-[0_8px_40px_-12px_rgba(15,23,42,0.12)] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

const MarksEntry = () => {
  const { user } = useAuth();
  const { isReadOnly } = useSubscription();

  const [selectedExam, setSelectedExam] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [maxScore, setMaxScore] = useState<number | string>(100);
  const [search, setSearch] = useState('');

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const currentMax = Number(maxScore) || 100;

  const marksMutation = useDataMutation('marks');

  /* TEACHER ASSIGNMENTS */
  const assignmentsQuery = useData<Assignment>(
    'teacher-assignments',
    'teacher_assignments',
    {
      select: 'id, teacher_id, subject_id, grade_id, school_id, is_active',
      filters: { teacher_id: user?.id, school_id: user?.school_id, is_active: true },
    },
    !!user?.school_id && !!user?.id
  );
  const assignments = useMemo(() => assignmentsQuery.data || [], [assignmentsQuery.data]);

  /* EXAMS */
  const examsQuery = useData<Exam>(
    'exams-list',
    'exams',
    { select: 'id, exam_name', filters: { school_id: user?.school_id } },
    !!user?.school_id
  );

  /* GRADES */
  const gradesQuery = useData<Grade>(
    'grades-list',
    'grades',
    {
      select: 'id, grade_name',
      filters: { school_id: user?.school_id },
      orderBy: { column: 'grade_name', ascending: true },
    },
    !!user?.school_id
  );

  /* SUBJECTS */
  const subjectsQuery = useData<Subject>(
    'subjects-list',
    'subjects',
    { select: 'id, subject_name', filters: { school_id: user?.school_id } },
    !!user?.school_id
  );

  /* FILTERED */
  const filteredGrades = useMemo(() => {
    const all = gradesQuery.data || [];
    if (user?.role !== 'Teacher') return all;
    const allowed = new Set(assignments.map(a => a.grade_id));
    return all.filter(g => allowed.has(g.id));
  }, [gradesQuery.data, assignments, user]);

  const filteredSubjects = useMemo(() => {
    const all = subjectsQuery.data || [];
    if (user?.role !== 'Teacher') return all;
    const allowed = new Set(assignments.map(a => a.subject_id));
    return all.filter(s => allowed.has(s.id));
  }, [subjectsQuery.data, assignments, user]);

  /* STUDENTS */
  const studentsQuery = useData<Student>(
    'students-marks',
    'students',
    {
      select: 'id, name, admission_number, grade_id',
      filters: selectedGrade
        ? { grade_id: parseInt(selectedGrade), school_id: user?.school_id }
        : undefined,
    },
    !!selectedGrade
  );
  const students = useMemo(() => studentsQuery.data || [], [studentsQuery.data]);

  /* EXISTING MARKS */
  const existingMarksQuery = useData<Mark>(
    'marks-existing',
    'marks',
    {
      filters:
        selectedExam && selectedSubject
          ? { exam_id: parseInt(selectedExam), subject_id: parseInt(selectedSubject) }
          : undefined,
    },
    !!selectedExam && !!selectedSubject
  );

  const [marks, setMarks] = useState<Record<number, number>>({});
  const [rawMarks, setRawMarks] = useState<Record<number, string>>({});

  React.useEffect(() => {
    if (!existingMarksQuery.data) return;
    const marksMap: Record<number, number> = {};
    const rawMap: Record<number, string> = {};
    existingMarksQuery.data.forEach((m) => {
      marksMap[m.student_id] = m.score;
      const raw = (m.score * currentMax) / 100;
      rawMap[m.student_id] = raw % 1 === 0 ? raw.toString() : raw.toFixed(1);
    });
    setMarks(marksMap);
    setRawMarks(rawMap);
  }, [existingMarksQuery.data, currentMax]);

  /* HANDLERS */
  const handleScoreChange = (studentId: number, rawValue: string) => {
    if (isReadOnly) return;
    setRawMarks(prev => ({ ...prev, [studentId]: rawValue }));
    if (rawValue.trim() === '') {
      setMarks(prev => ({ ...prev, [studentId]: 0 }));
      return;
    }
    const val = Number(rawValue);
    if (isNaN(val)) {
      setMarks(prev => ({ ...prev, [studentId]: 0 }));
      return;
    }
    const safeVal = Math.max(0, Math.min(val, currentMax));
    const percentage = Math.round((safeVal / currentMax) * 100);
    setMarks(prev => ({ ...prev, [studentId]: percentage }));
  };

  const handleSave = async () => {
    if (isReadOnly) return;
    if (!selectedExam || !selectedSubject) return;
    try {
      // For teachers, pass their user id as teacher_id.
      // For school_admin/principal, pass null — teacher_id is nullable.
      const isTeacher = user?.role === 'Teacher' || user?.role === 'teacher';
      const payload = Object.entries(marks).map(([studentId, score]) => ({
        student_id: parseInt(studentId),
        score,
        exam_id: parseInt(selectedExam),
        subject_id: parseInt(selectedSubject),
        school_id: user?.school_id,
        teacher_id: isTeacher ? user?.id : null,
      }));
      await marksMutation.mutateAsync({
        operation: 'upsert',
        payload,
        onConflict: 'student_id,exam_id,subject_id',
      });
      setFeedback({ type: 'success', msg: 'Marks saved successfully' });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message });
    }
  };

  const downloadTemplate = () => {
    const data = students.map(s => ({
      AdmissionNo: s.admission_number,
      Name: s.name,
      Score: '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Marks_Template.xlsx');
  };

  /* DERIVED STATS */
  const visibleStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students;
    return students.filter(
      s =>
        s.name?.toLowerCase().includes(term) ||
        String(s.admission_number).toLowerCase().includes(term)
    );
  }, [students, search]);

  const stats = useMemo(() => {
    const entered = Object.values(rawMarks).filter(v => v !== undefined && v !== '').length;
    const percents = students
      .map(s => marks[s.id])
      .filter((v): v is number => typeof v === 'number' && v > 0);
    const avg = percents.length
      ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length)
      : 0;
    const passing = percents.filter(p => p >= 41).length;
    return {
      total: students.length,
      entered,
      avg,
      passing,
      completion: students.length ? Math.round((entered / students.length) * 100) : 0,
    };
  }, [students, rawMarks, marks]);

  const selectionComplete = selectedExam && selectedGrade && selectedSubject;
  const examName = examsQuery.data?.find(e => String(e.id) === selectedExam)?.exam_name;
  const gradeName = filteredGrades.find(g => String(g.id) === selectedGrade)?.grade_name;
  const subjectName = filteredSubjects.find(s => String(s.id) === selectedSubject)?.subject_name;

  return (
    <div className="relative min-h-screen">
      {/* Aurora background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-blue-300/30 blur-3xl" />
        <div className="absolute top-40 -right-32 w-[32rem] h-[32rem] rounded-full bg-cyan-300/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-[26rem] h-[26rem] rounded-full bg-indigo-300/20 blur-3xl" />
      </div>

      <div className="space-y-6 p-1">
        {/* HERO HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <GlassCard className="overflow-hidden">
            <div className="relative p-6 md:p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 via-blue-500/5 to-cyan-400/10" />
              <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 grid place-items-center shadow-lg shadow-blue-500/30">
                    <ClipboardList className="text-white" size={26} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-1">
                      <Sparkles size={14} />
                      CBC GRADING SYSTEM
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                      Marks Entry
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                      {selectionComplete
                        ? `${examName} • ${gradeName} • ${subjectName}`
                        : 'Select an exam, grade, and subject to begin entering scores'}
                    </p>
                  </div>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-3">
                  <StatPill icon={Users} label="Students" value={stats.total} tone="blue" />
                  <StatPill icon={CheckCircle2} label="Entered" value={`${stats.entered}/${stats.total}`} tone="emerald" />
                  <StatPill icon={TrendingUp} label="Avg" value={`${stats.avg}%`} tone="indigo" />
                </div>
              </div>

              {/* Progress bar */}
              {stats.total > 0 && (
                <div className="relative mt-6">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
                    <span>Entry Progress</span>
                    <span className="text-slate-700 font-semibold">{stats.completion}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200/70 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${stats.completion}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </GlassCard>
        </motion.div>

        {/* CONTROLS */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <GlassCard className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <SelectField
                icon={ClipboardList}
                label="Exam"
                value={selectedExam}
                onChange={setSelectedExam}
                placeholder="Select Exam"
                options={examsQuery.data?.map(e => ({ value: String(e.id), label: e.exam_name })) || []}
              />
              <SelectField
                icon={GraduationCap}
                label="Grade"
                value={selectedGrade}
                onChange={setSelectedGrade}
                placeholder="Select Grade"
                options={filteredGrades.map(g => ({ value: String(g.id), label: g.grade_name }))}
              />
              <SelectField
                icon={BookOpen}
                label="Subject"
                value={selectedSubject}
                onChange={setSelectedSubject}
                placeholder="Select Subject"
                options={filteredSubjects.map(s => ({ value: String(s.id), label: s.subject_name }))}
              />
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Target size={12} /> Max Score
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={maxScore}
                    onChange={e => setMaxScore(e.target.value)}
                    className="w-full pl-4 pr-12 py-2.5 bg-white/80 border border-slate-200 rounded-xl text-sm font-bold text-blue-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    pts
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* TABLE */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <GlassCard className="overflow-hidden">
            {/* Toolbar */}
            <div className="p-5 border-b border-slate-200/60 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-50/60 to-white/40">
              <div>
                <h3 className="font-bold text-slate-800">Student Marks</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter scores out of {currentMax} — rubric updates live
                </p>
              </div>

              <div className="flex flex-1 md:flex-none flex-col sm:flex-row items-stretch sm:items-center gap-3 md:justify-end">
                <div className="relative flex-1 sm:w-64">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search name or adm no…"
                    className="w-full pl-9 pr-3 py-2 bg-white/80 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>

                <AnimatePresence>
                  {feedback && (
                    <motion.div
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ring-1 ${
                        feedback.type === 'success'
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : 'bg-red-50 text-red-700 ring-red-200'
                      }`}
                    >
                      {feedback.type === 'success' ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <AlertCircle size={14} />
                      )}
                      {feedback.msg}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 rounded-xl text-xs font-semibold text-slate-700 transition"
                >
                  <Download size={14} />
                  Template
                </button>

                <button
                  onClick={handleSave}
                  disabled={marksMutation.isPending || isReadOnly || !selectionComplete}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-600 to-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/30 hover:shadow-lg hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  <Save size={14} />
                  {marksMutation.isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>

            {/* Empty / loading / table */}
            {!selectedGrade ? (
              <EmptyState
                title="No grade selected"
                description="Pick a grade above to load students"
              />
            ) : studentsQuery.isLoading ? (
              <div className="p-8">
                <TableSkeleton rows={10} cols={5} />
              </div>
            ) : visibleStudents.length === 0 ? (
              <EmptyState
                title="No students found"
                description={search ? 'Try a different search term' : 'This grade has no students yet'}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/70 text-[10px] uppercase font-black text-slate-500 tracking-widest">
                      <th className="px-6 py-3.5 w-16">#</th>
                      <th className="px-6 py-3.5">Adm No</th>
                      <th className="px-6 py-3.5">Student</th>
                      <th className="px-6 py-3.5">Score</th>
                      <th className="px-6 py-3.5">Performance</th>
                      <th className="px-6 py-3.5">Rubric</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80 text-sm">
                    {visibleStudents.map((s, idx) => {
                      const percent = marks[s.id] ?? 0;
                      const rubric = getRubric(percent);
                      const tone = toneStyles[rubric.tone];
                      const hasEntry = rawMarks[s.id] !== undefined && rawMarks[s.id] !== '';

                      return (
                        <tr
                          key={s.id}
                          className="group hover:bg-blue-50/30 transition-colors"
                        >
                          <td className="px-6 py-4 text-xs font-bold text-slate-400">
                            {String(idx + 1).padStart(2, '0')}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-500">
                            {s.admission_number}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 grid place-items-center text-white text-xs font-bold shadow-sm">
                                {s.name?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-800">{s.name}</p>
                                <p className="text-[11px] text-slate-400">
                                  {hasEntry ? 'Score recorded' : 'Pending entry'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={rawMarks[s.id] ?? ''}
                                onChange={e => handleScoreChange(s.id, e.target.value)}
                                disabled={isReadOnly}
                                placeholder="0"
                                className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-lg text-center font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition disabled:bg-slate-50 disabled:cursor-not-allowed"
                              />
                              <span className="text-xs text-slate-400 font-medium">
                                / {currentMax}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 w-64">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                <motion.div
                                  className={`h-full ${tone.bar}`}
                                  initial={false}
                                  animate={{ width: `${percent}%` }}
                                  transition={{ duration: 0.4, ease: 'easeOut' }}
                                />
                              </div>
                              <span className={`text-sm font-black ${tone.text} tabular-nums w-12 text-right`}>
                                {percent}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ring-1 ${tone.chip}`}
                              title={rubric.desc}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${tone.bar}`} />
                              {rubric.label}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};

/* =========================
 * SUBCOMPONENTS
 * ========================= */
const StatPill: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone: 'blue' | 'emerald' | 'indigo';
}> = ({ icon: Icon, label, value, tone }) => {
  const tones = {
    blue: 'from-blue-500/15 to-blue-500/5 text-blue-600',
    emerald: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600',
    indigo: 'from-indigo-500/15 to-indigo-500/5 text-indigo-600',
  };
  return (
    <div className={`rounded-2xl p-3 bg-gradient-to-br ${tones[tone]} ring-1 ring-white/60`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-80">
        <Icon size={11} />
        {label}
      </div>
      <p className="text-lg font-black mt-0.5 text-slate-900 tabular-nums">{value}</p>
    </div>
  );
};

const SelectField: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}> = ({ icon: Icon, label, value, onChange, placeholder, options }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
      <Icon size={12} />
      {label}
    </label>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-4 py-2.5 bg-white/80 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition cursor-pointer"
    >
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);

const EmptyState: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 ring-1 ring-slate-200 grid place-items-center mb-4">
      <ClipboardList className="text-slate-400" size={26} />
    </div>
    <h4 className="font-bold text-slate-700">{title}</h4>
    <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>
  </div>
);

export default MarksEntry;