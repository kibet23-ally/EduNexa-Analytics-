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

/** =======================
 * CBC RUBRIC FUNCTION
 * ======================= */
const getRubric = (percent: number) => {
  if (percent >= 90) return { label: 'EE1', desc: 'Exceeding Expectations', color: 'text-emerald-600' };
  if (percent >= 75) return { label: 'EE2', desc: 'Exceeding Expectations', color: 'text-emerald-500' };
  if (percent >= 58) return { label: 'ME1', desc: 'Meeting Expectations', color: 'text-blue-600' };
  if (percent >= 41) return { label: 'ME2', desc: 'Meeting Expectations', color: 'text-blue-500' };
  if (percent >= 31) return { label: 'AE1', desc: 'Approaching Expectations', color: 'text-amber-600' };
  if (percent >= 21) return { label: 'AE2', desc: 'Approaching Expectations', color: 'text-amber-500' };
  if (percent >= 11) return { label: 'BE1', desc: 'Below Expectations', color: 'text-red-500' };
  return { label: 'BE2', desc: 'Below Expectations', color: 'text-red-700' };
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

  const examsQuery = useData<Exam>('exams-list', 'exams', { select: 'id, exam_name' }, !!user?.school_id);
  const gradesQuery = useData<Grade>('grades-list', 'grades', {
    select: 'id, grade_name',
    orderBy: { column: 'grade_name', ascending: true }
  }, !!user?.school_id);

  const subjectsQuery = useData<Subject>('subjects-list', 'subjects', {
    select: 'id, subject_name'
  }, !!user?.school_id);

  const assignmentsQuery = useData<Assignment>(
    'teacher-assignments-all',
    'teacher_assignments',
    { select: 'id, teacher_id, subject_id, grade_id' },
    !!user?.school_id && user.role === 'Teacher'
  );

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

  const [marks, setMarks] = useState<Record<number, number>>({});
  const [rawMarks, setRawMarks] = useState<Record<number, string>>({});

  const handleScoreChange = (studentId: number, rawValue: string) => {
    if (isReadOnly) return;

    setRawMarks(p => ({ ...p, [studentId]: rawValue }));

    const val = parseFloat(rawValue);
    if (!isNaN(val) && val >= 0 && val <= currentMax) {
      const percentage = Math.round((val / currentMax) * 100);
      setMarks(p => ({ ...p, [studentId]: percentage }));
    }
  };

  const handleSave = async () => {
    if (isReadOnly) return;
    if (!selectedExam || !selectedSubject) return;

    try {
      const payload = Object.entries(marks).map(([studentId, score]) => ({
        student_id: parseInt(studentId),
        score,
        exam_id: parseInt(selectedExam),
        subject_id: parseInt(selectedSubject),
        school_id: user?.school_id
      }));

      await marksMutation.mutateAsync({
        operation: 'upsert',
        payload,
        onConflict: 'student_id,exam_id,subject_id'
      });

      setFeedback({ type: 'success', msg: 'Marks saved successfully!' });
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message });
    }
  };

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Marks Entry</h1>
          <p className="text-slate-500 text-sm">
            Enter marks and instantly view CBC rubric performance
          </p>
        </div>

        {feedback && (
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-red-50 text-red-600'
          }`}>
            {feedback.msg}
          </span>
        )}
      </header>

      {/* CONTROLS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border grid grid-cols-4 gap-4">
        <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)} className="p-2 border rounded">
          <option>Select Exam</option>
          {examsQuery.data?.map(e => (
            <option key={e.id} value={e.id}>{e.exam_name}</option>
          ))}
        </select>

        <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)} className="p-2 border rounded">
          <option>Select Grade</option>
          {gradesQuery.data?.map(g => (
            <option key={g.id} value={g.id}>{g.grade_name}</option>
          ))}
        </select>

        <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="p-2 border rounded">
          <option>Select Subject</option>
          {subjectsQuery.data?.map(s => (
            <option key={s.id} value={s.id}>{s.subject_name}</option>
          ))}
        </select>

        <input
          type="number"
          value={maxScore}
          onChange={e => setMaxScore(e.target.value)}
          className="p-2 border rounded font-bold text-blue-600"
        />
      </div>

      {/* RUBRIC LEGEND */}
      <div className="bg-slate-50 p-4 rounded-xl text-xs grid grid-cols-4 gap-2">
        <span>EE1 (90-100)</span>
        <span>EE2 (75-89)</span>
        <span>ME1 (58-74)</span>
        <span>ME2 (41-57)</span>
        <span>AE1 (31-40)</span>
        <span>AE2 (21-30)</span>
        <span>BE1 (11-20)</span>
        <span>BE2 (0-10)</span>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl border overflow-hidden">

        <div className="p-3 border-b flex justify-between">
          <h3 className="font-bold text-sm">Student Marks</h3>

          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-4 py-2 rounded text-xs flex items-center gap-2"
          >
            <Save size={14} /> Save
          </button>
        </div>

        {students.map(s => {
          const percent = marks[s.id] || 0;
          const rubric = getRubric(percent);

          return (
            <div key={s.id} className="grid grid-cols-4 p-3 border-b items-center hover:bg-slate-50">

              <div className="font-bold text-sm">{s.name}</div>

              <input
                type="number"
                value={rawMarks[s.id] || ''}
                onChange={e => handleScoreChange(s.id, e.target.value)}
                className="border p-2 rounded w-24"
              />

              <div className="text-blue-600 font-bold">{percent}%</div>

              <div className={`font-bold ${rubric.color}`}>
                {rubric.label} <span className="text-xs text-slate-400">{rubric.desc}</span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default MarksEntry;