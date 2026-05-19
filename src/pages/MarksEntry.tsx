import React, { useState, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { useSubscription } from '../useSubscription';
import { Exam, Grade, Subject, Student, Mark } from '../types';
import { useData, useDataMutation } from '../hooks/useData';
import { Save, Download, Upload } from 'lucide-react';
import { TableSkeleton } from '../components/ui/Skeleton';
import * as XLSX from 'xlsx';

interface ExcelRow {
  AdmissionNo?: string | number;
  admission_number?: string | number;
  'Adm No'?: string | number;
  Score?: string | number;
  score?: string | number;
  Mark?: string | number;
  mark?: string | number;
}

interface Assignment {
  id: number;
  teacher_id: string;
  subject_id: number;
  grade_id: number;
  school_id: number;
  is_active: boolean;
}

/** =========================
 * CBC RUBRICS
 * ========================= */
const getRubric = (percent: number) => {
  if (percent >= 90)
    return {
      label: 'EE1',
      desc: 'Exceeding Expectations',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    };

  if (percent >= 75)
    return {
      label: 'EE2',
      desc: 'Exceeding Expectations',
      color: 'text-emerald-500',
      bg: 'bg-emerald-50',
    };

  if (percent >= 58)
    return {
      label: 'ME1',
      desc: 'Meeting Expectations',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    };

  if (percent >= 41)
    return {
      label: 'ME2',
      desc: 'Meeting Expectations',
      color: 'text-blue-500',
      bg: 'bg-blue-50',
    };

  if (percent >= 31)
    return {
      label: 'AE1',
      desc: 'Approaching Expectations',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    };

  if (percent >= 21)
    return {
      label: 'AE2',
      desc: 'Approaching Expectations',
      color: 'text-amber-500',
      bg: 'bg-amber-50',
    };

  if (percent >= 11)
    return {
      label: 'BE1',
      desc: 'Below Expectations',
      color: 'text-red-500',
      bg: 'bg-red-50',
    };

  return {
    label: 'BE2',
    desc: 'Below Expectations',
    color: 'text-red-700',
    bg: 'bg-red-50',
  };
};

const MarksEntry = () => {
  const { user } = useAuth();
  const { isReadOnly } = useSubscription();

  const [selectedExam, setSelectedExam] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [maxScore, setMaxScore] = useState<number | string>(100);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    msg: string;
  } | null>(null);

  const currentMax = Number(maxScore) || 100;

  /** =========================
   * MUTATION
   * ========================= */
  const marksMutation = useDataMutation('marks');

  /** =========================
   * TEACHER ASSIGNMENTS FIX
   * ========================= */
  const assignmentsQuery = useData<Assignment>(
    'teacher-assignments',
    'teacher_assignments',
    {
      select: 'id, teacher_id, subject_id, grade_id, school_id, is_active',
      filters: {
        teacher_id: user?.id,
        school_id: user?.school_id,
        is_active: true,
      },
    },
    !!user?.school_id && !!user?.id
  );

  const assignments = useMemo(
    () => assignmentsQuery.data || [],
    [assignmentsQuery.data]
  );

  /** =========================
   * EXAMS
   * ========================= */
  const examsQuery = useData<Exam>(
    'exams-list',
    'exams',
    {
      select: 'id, exam_name',
      filters: {
        school_id: user?.school_id,
      },
    },
    !!user?.school_id
  );

  /** =========================
   * GRADES
   * ========================= */
  const gradesQuery = useData<Grade>(
    'grades-list',
    'grades',
    {
      select: 'id, grade_name',
      filters: {
        school_id: user?.school_id,
      },
      orderBy: {
        column: 'grade_name',
        ascending: true,
      },
    },
    !!user?.school_id
  );

  /** =========================
   * SUBJECTS
   * ========================= */
  const subjectsQuery = useData<Subject>(
    'subjects-list',
    'subjects',
    {
      select: 'id, subject_name',
      filters: {
        school_id: user?.school_id,
      },
    },
    !!user?.school_id
  );

  /** =========================
   * FILTER TEACHER GRADES
   * ========================= */
  const filteredGrades = useMemo(() => {
    const allGrades = gradesQuery.data || [];

    if (user?.role !== 'Teacher') return allGrades;

    const allowedGradeIds = new Set(
      assignments.map(a => a.grade_id)
    );

    return allGrades.filter(g =>
      allowedGradeIds.has(g.id)
    );
  }, [gradesQuery.data, assignments, user]);

  /** =========================
   * FILTER TEACHER SUBJECTS
   * ========================= */
  const filteredSubjects = useMemo(() => {
    const allSubjects = subjectsQuery.data || [];

    if (user?.role !== 'Teacher') return allSubjects;

    const allowedSubjectIds = new Set(
      assignments.map(a => a.subject_id)
    );

    return allSubjects.filter(s =>
      allowedSubjectIds.has(s.id)
    );
  }, [subjectsQuery.data, assignments, user]);

  /** =========================
   * STUDENTS
   * ========================= */
  const studentsQuery = useData<Student>(
    'students-marks',
    'students',
    {
      select: 'id, name, admission_number, grade_id',
      filters: selectedGrade
        ? {
            grade_id: parseInt(selectedGrade),
            school_id: user?.school_id,
          }
        : undefined,
    },
    !!selectedGrade
  );

  const students = useMemo(
    () => studentsQuery.data || [],
    [studentsQuery.data]
  );

  /** =========================
   * EXISTING MARKS
   * ========================= */
  const existingMarksQuery = useData<Mark>(
    'marks-existing',
    'marks',
    {
      filters:
        selectedExam && selectedSubject
          ? {
              exam_id: parseInt(selectedExam),
              subject_id: parseInt(selectedSubject),
            }
          : undefined,
    },
    !!selectedExam && !!selectedSubject
  );

  /** =========================
   * STATE
   * ========================= */
  const [marks, setMarks] = useState<Record<number, number>>({});
  const [rawMarks, setRawMarks] = useState<Record<number, string>>({});

  /** =========================
   * LOAD EXISTING MARKS
   * ========================= */
  React.useEffect(() => {
    if (!existingMarksQuery.data) return;

    const marksMap: Record<number, number> = {};
    const rawMap: Record<number, string> = {};

    existingMarksQuery.data.forEach((m) => {
      marksMap[m.student_id] = m.score;

      const raw = (m.score * currentMax) / 100;

      rawMap[m.student_id] =
        raw % 1 === 0
          ? raw.toString()
          : raw.toFixed(1);
    });

    setMarks(marksMap);
    setRawMarks(rawMap);
  }, [existingMarksQuery.data, currentMax]);

  /** =========================
   * SCORE CHANGE
   * ========================= */
  const handleScoreChange = (
    studentId: number,
    rawValue: string
  ) => {
    if (isReadOnly) return;

    setRawMarks(prev => ({
      ...prev,
      [studentId]: rawValue,
    }));

    if (rawValue.trim() === '') {
      setMarks(prev => ({
        ...prev,
        [studentId]: 0,
      }));
      return;
    }

    const val = Number(rawValue);

    if (isNaN(val)) {
      setMarks(prev => ({
        ...prev,
        [studentId]: 0,
      }));
      return;
    }

    const safeVal = Math.max(
      0,
      Math.min(val, currentMax)
    );

    const percentage = Math.round(
      (safeVal / currentMax) * 100
    );

    setMarks(prev => ({
      ...prev,
      [studentId]: percentage,
    }));
  };

  /** =========================
   * SAVE
   * ========================= */
  const handleSave = async () => {
    if (isReadOnly) return;

    if (!selectedExam || !selectedSubject) return;

    try {
      const payload = Object.entries(marks).map(
        ([studentId, score]) => ({
          student_id: parseInt(studentId),
          score,
          exam_id: parseInt(selectedExam),
          subject_id: parseInt(selectedSubject),
          school_id: user?.school_id,
        })
      );

      await marksMutation.mutateAsync({
        operation: 'upsert',
        payload,
        onConflict: 'student_id,exam_id,subject_id',
      });

      setFeedback({
        type: 'success',
        msg: 'Marks saved successfully!',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        msg: err.message,
      });
    }
  };

  /** =========================
   * TEMPLATE DOWNLOAD
   * ========================= */
  const downloadTemplate = () => {
    const data = students.map(s => ({
      AdmissionNo: s.admission_number,
      Name: s.name,
      Score: '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      ws,
      'Template'
    );

    XLSX.writeFile(wb, 'Marks_Template.xlsx');
  };

  return (
    <div className="space-y-6">

      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Marks Entry
          </h1>

          <p className="text-slate-500 text-sm">
            CBC grading system enabled
          </p>
        </div>
      </header>

      {/* CONTROLS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-6">

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase">
            Exam
          </label>

          <select
            value={selectedExam}
            onChange={e => setSelectedExam(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border rounded-lg text-sm"
          >
            <option value="">Select Exam</option>

            {examsQuery.data?.map(e => (
              <option key={e.id} value={e.id}>
                {e.exam_name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase">
            Grade
          </label>

          <select
            value={selectedGrade}
            onChange={e => setSelectedGrade(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border rounded-lg text-sm"
          >
            <option value="">Select Grade</option>

            {filteredGrades.map(g => (
              <option key={g.id} value={g.id}>
                {g.grade_name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase">
            Subject
          </label>

          <select
            value={selectedSubject}
            onChange={e => setSelectedSubject(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border rounded-lg text-sm"
          >
            <option value="">Select Subject</option>

            {filteredSubjects.map(s => (
              <option key={s.id} value={s.id}>
                {s.subject_name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase">
            Max Score
          </label>

          <input
            type="number"
            value={maxScore}
            onChange={e => setMaxScore(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border rounded-lg text-sm font-bold text-blue-600"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">

        <div className="p-4 border-b flex items-center justify-between bg-slate-50/30">
          <h3 className="font-bold text-sm text-slate-500 uppercase tracking-widest">
            Student Marks
          </h3>

          <div className="flex gap-2 items-center">

            {feedback && (
              <span className={`text-xs font-bold ${
                feedback.type === 'success'
                  ? 'text-emerald-600'
                  : 'text-red-600'
              }`}>
                {feedback.msg}
              </span>
            )}

            <button
              onClick={downloadTemplate}
              className="p-2 hover:bg-white rounded border"
            >
              <Download size={16} />
            </button>

            <button
              onClick={handleSave}
              disabled={marksMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold"
            >
              <Save size={14} />
              Save Changes
            </button>

          </div>
        </div>

        {studentsQuery.isLoading ? (
          <div className="p-8">
            <TableSkeleton rows={10} cols={5} />
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] uppercase font-black text-slate-400">
                <th className="px-6 py-3">Adm No</th>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Score</th>
                <th className="px-6 py-3">%</th>
                <th className="px-6 py-3">Rubric</th>
              </tr>
            </thead>

            <tbody className="divide-y text-sm">

              {students.map(s => {
                const percent = marks[s.id] ?? 0;

                const rubric = getRubric(percent);

                return (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-50/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono text-xs">
                      {s.admission_number}
                    </td>

                    <td className="px-6 py-4 font-bold text-slate-700">
                      {s.name}
                    </td>

                    <td className="px-6 py-4">
                      <input
                        type="number"
                        value={rawMarks[s.id] ?? ''}
                        onChange={e =>
                          handleScoreChange(
                            s.id,
                            e.target.value
                          )
                        }
                        className="w-24 px-3 py-1.5 bg-slate-50 border rounded-lg text-center font-bold text-slate-600 outline-none focus:ring-1 ring-blue-500"
                      />
                    </td>

                    <td className="px-6 py-4 font-black text-blue-600">
                      {percent}%
                    </td>

                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${rubric.bg} ${rubric.color}`}>
                        {rubric.label}
                      </div>
                    </td>
                  </tr>
                );
              })}

            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default MarksEntry;