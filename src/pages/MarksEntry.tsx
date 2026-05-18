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
  teacher_id: number;
  subject_id: number;
  grade_id: number;
}

/** ================= CBC RUBRIC ================= */
const getRubric = (percent: number) => {
  if (percent >= 90) return 'EE1';
  if (percent >= 75) return 'EE2';
  if (percent >= 58) return 'ME1';
  if (percent >= 41) return 'ME2';
  if (percent >= 31) return 'AE1';
  if (percent >= 21) return 'AE2';
  if (percent >= 11) return 'BE1';
  return 'BE2';
};

const MarksEntry = () => {
  const { user } = useAuth();
  const { isReadOnly } = useSubscription();

  const [selectedExam, setSelectedExam] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [maxScore, setMaxScore] = useState<number | string>(100);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const currentMax = Number(maxScore) || 100;

  const marksMutation = useDataMutation('marks');

  /** ================= DATA ================= */
  const examsQuery = useData<Exam>(
    'exams-list',
    'exams',
    { select: 'id, exam_name' },
    !!user?.school_id
  );

  const gradesQuery = useData<Grade>(
    'grades-list',
    'grades',
    { select: 'id, grade_name', orderBy: { column: 'grade_name', ascending: true } },
    !!user?.school_id
  );

  const subjectsQuery = useData<Subject>(
    'subjects-list',
    'subjects',
    { select: 'id, subject_name' },
    !!user?.school_id
  );

  const assignmentsQuery = useData<Assignment>(
    'teacher-assignments-all',
    'teacher_assignments',
    { select: 'id, teacher_id, subject_id, grade_id' },
    !!user?.school_id && user.role === 'Teacher'
  );

  /** ================= FILTERS ================= */
  const filteredGrades = useMemo(() => {
    const data = gradesQuery.data || [];
    if (user?.role !== 'Teacher' || !assignmentsQuery.data) return data;

    const teacherId = user.id.toString().replace('teacher-', '');

    const allowed = new Set(
      assignmentsQuery.data
        .filter(a => a.teacher_id.toString() === teacherId)
        .map(a => a.grade_id.toString())
    );

    return data.filter(g => allowed.has(g.id.toString()));
  }, [gradesQuery.data, assignmentsQuery.data, user]);

  const filteredSubjects = useMemo(() => {
    const data = subjectsQuery.data || [];
    if (user?.role !== 'Teacher' || !assignmentsQuery.data) return data;

    const teacherId = user.id.toString().replace('teacher-', '');

    const allowed = new Set(
      assignmentsQuery.data
        .filter(a => a.teacher_id.toString() === teacherId)
        .map(a => a.subject_id.toString())
    );

    return data.filter(s => allowed.has(s.id.toString()));
  }, [subjectsQuery.data, assignmentsQuery.data, user]);

  /** ================= STUDENTS ================= */
  const studentsQuery = useData<Student>(
    'students-marks',
    'students',
    {
      select: 'id, name, admission_number, grade_id',
      filters: selectedGrade ? { grade_id: parseInt(selectedGrade) } : undefined
    },
    !!selectedGrade
  );

  const students = useMemo(() => studentsQuery.data || [], [studentsQuery.data]);

  /** ================= EXISTING MARKS ================= */
  const existingMarksQuery = useData<Mark>(
    'marks-existing',
    'marks',
    {
      filters: selectedExam && selectedSubject ? {
        exam_id: parseInt(selectedExam),
        subject_id: parseInt(selectedSubject)
      } : undefined
    },
    !!selectedExam && !!selectedSubject
  );

  const [marks, setMarks] = useState<Record<number, number>>({});
  const [rawMarks, setRawMarks] = useState<Record<number, string>>({});

  const lastMarksRef = React.useRef<string>('');

  React.useEffect(() => {
    if (existingMarksQuery.data) {
      const key = JSON.stringify(existingMarksQuery.data);
      if (key !== lastMarksRef.current) {
        const m: Record<number, number> = {};
        const r: Record<number, string> = {};

        existingMarksQuery.data.forEach((x) => {
          m[x.student_id] = x.score;
          const raw = (x.score * currentMax) / 100;
          r[x.student_id] = raw.toString();
        });

        setMarks(m);
        setRawMarks(r);
        lastMarksRef.current = key;
      }
    }
  }, [existingMarksQuery.data, currentMax]);

  /** ================= HANDLERS ================= */
  const handleScoreChange = (studentId: number, value: string) => {
    if (isReadOnly) return;

    setRawMarks(p => ({ ...p, [studentId]: value }));

    const val = parseFloat(value);
    if (!isNaN(val) && val >= 0 && val <= currentMax) {
      setMarks(p => ({
        ...p,
        [studentId]: Math.round((val / currentMax) * 100)
      }));
    }
  };

  const handleSave = async () => {
    if (isReadOnly) return;

    const payload = Object.entries(marks).map(([studentId, score]) => ({
      student_id: parseInt(studentId),
      score,
      exam_id: parseInt(selectedExam),
      subject_id: parseInt(selectedSubject),
      school_id: user?.school_id
    }));

    try {
      await marksMutation.mutateAsync({
        operation: 'upsert',
        payload,
        onConflict: 'student_id,exam_id,subject_id'
      });

      setFeedback({ type: 'success', msg: 'Saved successfully!' });
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message });
    }
  };

  /** ================= UI ================= */
  return (
    <div className="space-y-6">

      {/* HEADER */}
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Marks Entry</h1>
          <p className="text-slate-500 text-sm">Enter scores for examinations.</p>
        </div>
      </header>

      {/* DROPDOWNS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border grid grid-cols-1 md:grid-cols-4 gap-6">

        <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)} className="p-2 border rounded">
          <option value="">Select Exam</option>
          {examsQuery.data?.map(e => (
            <option key={e.id} value={e.id}>{e.exam_name}</option>
          ))}
        </select>

        <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)} className="p-2 border rounded">
          <option value="">Select Grade</option>
          {filteredGrades.map(g => (
            <option key={g.id} value={g.id}>{g.grade_name}</option>
          ))}
        </select>

        <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="p-2 border rounded">
          <option value="">Select Subject</option>
          {filteredSubjects.map(s => (
            <option key={s.id} value={s.id}>{s.subject_name}</option>
          ))}
        </select>

        <input
          type="number"
          value={maxScore}
          onChange={e => setMaxScore(e.target.value)}
          className="p-2 border rounded"
        />
      </div>

      {/* TABLE */}
      {selectedExam && selectedGrade && selectedSubject && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">

          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-xs font-bold text-slate-500">
                <th className="p-3">Adm No</th>
                <th className="p-3">Name</th>
                <th className="p-3">Score</th>
                <th className="p-3">%</th>
                <th className="p-3">Rubric</th>
              </tr>
            </thead>

            <tbody>
              {students.map(s => {
                const percent = marks[s.id] || 0;

                return (
                  <tr key={s.id} className="border-t">
                    <td className="p-3">{s.admission_number}</td>
                    <td className="p-3 font-semibold">{s.name}</td>

                    <td className="p-3">
                      <input
                        value={rawMarks[s.id] || ''}
                        onChange={e => handleScoreChange(s.id, e.target.value)}
                        className="border p-1 w-20"
                      />
                    </td>

                    <td className="p-3 font-bold text-blue-600">
                      {percent}%
                    </td>

                    {/* RUBRIC ADDED */}
                    <td className="p-3 font-bold">
                      {getRubric(percent)}
                    </td>

                  </tr>
                );
              })}
            </tbody>

          </table>

        </div>
      )}

    </div>
  );
};

export default MarksEntry;