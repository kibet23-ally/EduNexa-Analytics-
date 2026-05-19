import React, { useState, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { useSubscription } from '../useSubscription';
import { Exam, Grade, Subject, Student } from '../types';
import { useData, useDataMutation } from '../hooks/useData';
import { Save } from 'lucide-react';

interface Assignment {
  id: number;
  teacher_id: number;
  subject_id: number;
  grade_id: number;
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
    };

  if (percent >= 75)
    return {
      label: 'EE2',
      desc: 'Exceeding Expectations',
      color: 'text-emerald-500',
    };

  if (percent >= 58)
    return {
      label: 'ME1',
      desc: 'Meeting Expectations',
      color: 'text-blue-600',
    };

  if (percent >= 41)
    return {
      label: 'ME2',
      desc: 'Meeting Expectations',
      color: 'text-blue-500',
    };

  if (percent >= 31)
    return {
      label: 'AE1',
      desc: 'Approaching Expectations',
      color: 'text-amber-600',
    };

  if (percent >= 21)
    return {
      label: 'AE2',
      desc: 'Approaching Expectations',
      color: 'text-amber-500',
    };

  if (percent >= 11)
    return {
      label: 'BE1',
      desc: 'Below Expectations',
      color: 'text-red-500',
    };

  return {
    label: 'BE2',
    desc: 'Below Expectations',
    color: 'text-red-700',
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

  const [marks, setMarks] = useState<Record<number, number>>({});
  const [rawMarks, setRawMarks] = useState<Record<number, string>>({});

  const marksMutation = useDataMutation('marks');

  /** =========================
   * FETCH DATA
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

  const assignmentsQuery = useData<Assignment>(
    'teacher-assignments',
    'teacher_assignments',
    {
      select: 'id, teacher_id, subject_id, grade_id',
      filters: {
        teacher_id: Number(user?.id),
      },
    },
    !!user?.school_id && user?.role === 'Teacher'
  );

  /** =========================
   * RBAC FILTERS
   * ========================= */

  const filteredGrades = useMemo(() => {
    const all = gradesQuery.data || [];

    if (user?.role !== 'Teacher') return all;

    const assignments = assignmentsQuery.data || [];

    const allowedGradeIds = new Set(
      assignments.map(a => a.grade_id)
    );

    return all.filter(g => allowedGradeIds.has(g.id));
  }, [gradesQuery.data, assignmentsQuery.data, user]);

  const filteredSubjects = useMemo(() => {
    const all = subjectsQuery.data || [];

    if (user?.role !== 'Teacher') return all;

    const assignments = assignmentsQuery.data || [];

    const allowedSubjectIds = new Set(
      assignments.map(a => a.subject_id)
    );

    return all.filter(s => allowedSubjectIds.has(s.id));
  }, [subjectsQuery.data, assignmentsQuery.data, user]);

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
        : {
            school_id: user?.school_id,
          },
    },
    !!selectedGrade && !!user?.school_id
  );

  const students = useMemo(
    () => studentsQuery.data || [],
    [studentsQuery.data]
  );

  /** =========================
   * SCORE HANDLER
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
   * SAVE MARKS
   * ========================= */

  const handleSave = async () => {
    if (isReadOnly) return;

    if (
      !selectedExam ||
      !selectedSubject ||
      !selectedGrade
    ) {
      setFeedback({
        type: 'error',
        msg: 'Select exam, grade and subject',
      });
      return;
    }

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
        onConflict:
          'student_id,exam_id,subject_id',
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

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Marks Entry
          </h1>

          <p className="text-slate-500 text-sm">
            CBC grading system enabled
          </p>
        </div>

        {feedback && (
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {feedback.msg}
          </span>
        )}
      </header>

      {/* FILTERS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-6">

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase text-slate-400">
            Exam
          </label>

          <select
            value={selectedExam}
            onChange={e =>
              setSelectedExam(e.target.value)
            }
            className="w-full px-4 py-2 bg-slate-50 border rounded-lg text-sm"
          >
            <option value="">Select Exam</option>

            {examsQuery.data?.map(exam => (
              <option
                key={exam.id}
                value={exam.id}
              >
                {exam.exam_name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase text-slate-400">
            Grade
          </label>

          <select
            value={selectedGrade}
            onChange={e =>
              setSelectedGrade(e.target.value)
            }
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
          <label className="text-xs font-bold uppercase text-slate-400">
            Subject
          </label>

          <select
            value={selectedSubject}
            onChange={e =>
              setSelectedSubject(e.target.value)
            }
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
          <label className="text-xs font-bold uppercase text-slate-400">
            Max Score
          </label>

          <input
            type="number"
            value={maxScore}
            onChange={e =>
              setMaxScore(e.target.value)
            }
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

          <button
            onClick={handleSave}
            disabled={
              marksMutation.isPending || isReadOnly
            }
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold disabled:opacity-50"
          >
            <Save size={14} />
            Save Changes
          </button>
        </div>

        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 text-[10px] uppercase font-black text-slate-400">
              <th className="px-6 py-3">Adm No</th>
              <th className="px-6 py-3">Student</th>
              <th className="px-6 py-3">
                Score / {currentMax}
              </th>
              <th className="px-6 py-3">
                Percentage
              </th>
              <th className="px-6 py-3">
                CBC Rubric
              </th>
            </tr>
          </thead>

          <tbody className="divide-y text-sm">
            {students.map(student => {
              const percent =
                marks[student.id] ?? 0;

              const rubric = getRubric(percent);

              return (
                <tr
                  key={student.id}
                  className="hover:bg-slate-50/30 transition-colors"
                >
                  <td className="px-6 py-4 font-mono text-xs">
                    {student.admission_number}
                  </td>

                  <td className="px-6 py-4 font-bold text-slate-700">
                    {student.name}
                  </td>

                  <td className="px-6 py-4">
                    <input
                      type="number"
                      value={
                        rawMarks[student.id] ?? ''
                      }
                      disabled={isReadOnly}
                      onChange={e =>
                        handleScoreChange(
                          student.id,
                          e.target.value
                        )
                      }
                      className="w-24 px-3 py-1.5 bg-slate-50 border rounded-lg text-center font-bold text-slate-600 outline-none focus:ring-1 ring-blue-500"
                    />
                  </td>

                  <td className="px-6 py-4 font-black text-blue-600">
                    {percent}%
                  </td>

                  <td
                    className={`px-6 py-4 font-black ${rubric.color}`}
                  >
                    {rubric.label}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

      </div>
    </div>
  );
};

export default MarksEntry;