import React, { useState, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { useSubscription } from '../useSubscription';
import { Exam, Grade, Subject, Student, Mark } from '../types';
import { useData, useDataMutation } from '../hooks/useData';
import { Save, Download, Upload } from 'lucide-react';
import { TableSkeleton } from '../components/ui/Skeleton';
import * as XLSX from 'xlsx';

/**
 * ================================
 * CBC RUBRIC SYSTEM (FINAL)
 * ================================
 */
const getCBCRubric = (percentage: number) => {
  const p = Math.max(0, Math.min(100, percentage));

  if (p >= 90 && p <= 100) {
    return { level: 'EE1', label: 'Exceeding Expectations', color: 'text-emerald-700' };
  }

  if (p >= 75 && p <= 89) {
    return { level: 'EE2', label: 'Exceeding Expectations', color: 'text-emerald-600' };
  }

  if (p >= 58 && p <= 74) {
    return { level: 'ME1', label: 'Meeting Expectations', color: 'text-blue-700' };
  }

  if (p >= 41 && p <= 57) {
    return { level: 'ME2', label: 'Meeting Expectations', color: 'text-blue-600' };
  }

  if (p >= 31 && p <= 40) {
    return { level: 'AE1', label: 'Approaching Expectations', color: 'text-yellow-700' };
  }

  if (p >= 21 && p <= 30) {
    return { level: 'AE2', label: 'Approaching Expectations', color: 'text-yellow-600' };
  }

  if (p >= 11 && p <= 20) {
    return { level: 'BE1', label: 'Below Expectations', color: 'text-red-500' };
  }

  return { level: 'BE2', label: 'Below Expectations', color: 'text-red-700' };
};

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

  const filteredGrades = useMemo(() => {
    const data = gradesQuery.data || [];
    if (user?.role !== 'Teacher' || !assignmentsQuery.data) return data;

    const teacherId = user.id.toString().replace('teacher-', '');
    const assigned = new Set(
      assignmentsQuery.data
        .filter(a => a.teacher_id.toString() === teacherId)
        .map(a => a.grade_id.toString())
    );

    return data.filter(g => assigned.has(g.id.toString()));
  }, [gradesQuery.data, assignmentsQuery.data, user]);

  const filteredSubjects = useMemo(() => {
    const data = subjectsQuery.data || [];
    if (user?.role !== 'Teacher' || !assignmentsQuery.data) return data;

    const teacherId = user.id.toString().replace('teacher-', '');
    const assigned = new Set(
      assignmentsQuery.data
        .filter(a => a.teacher_id.toString() === teacherId)
        .map(a => a.subject_id.toString())
    );

    return data.filter(s => assigned.has(s.id.toString()));
  }, [subjectsQuery.data, assignmentsQuery.data, user]);

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

  const existingMarksQuery = useData<Mark>(
    'marks-existing',
    'marks',
    {
      filters:
        selectedExam && selectedSubject
          ? {
              exam_id: parseInt(selectedExam),
              subject_id: parseInt(selectedSubject)
            }
          : undefined
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

  const handleScoreChange = (studentId: number, value: string) => {
    if (isReadOnly) return;

    setRawMarks(p => ({ ...p, [studentId]: value }));

    const val = parseFloat(value);
    if (!isNaN(val) && val >= 0 && val <= currentMax) {
      const percent = Math.round((val / currentMax) * 100);
      setMarks(p => ({ ...p, [studentId]: percent }));
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

      setFeedback({ type: 'success', msg: 'Marks saved successfully' });
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Marks Entry</h1>

      {/* Filters */}
      <div className="grid grid-cols-4 gap-4">
        <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
          <option>Select Exam</option>
          {examsQuery.data?.map(e => (
            <option key={e.id} value={e.id}>{e.exam_name}</option>
          ))}
        </select>

        <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}>
          <option>Select Grade</option>
          {filteredGrades.map(g => (
            <option key={g.id} value={g.id}>{g.grade_name}</option>
          ))}
        </select>

        <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
          <option>Select Subject</option>
          {filteredSubjects.map(s => (
            <option key={s.id} value={s.id}>{s.subject_name}</option>
          ))}
        </select>

        <input
          type="number"
          value={maxScore}
          onChange={e => setMaxScore(e.target.value)}
          placeholder="Max Score"
        />
      </div>

      {/* Table */}
       {selectedExam && selectedGrade && selectedSubject && (
        <table className="w-full border">
          <thead>
            <tr>
              <th>Adm No</th>
              <th>Name</th>
              <th>Score</th>
              <th>%</th>
              <th>CBC Rubric</th>
            </tr>
          </thead>

          <tbody>
            {students.map(s => {
              const percent = marks[s.id] || 0;
              const rubric = getCBCRubric(percent);

              return (
                <tr key={s.id}>
                  <td>{s.admission_number}</td>
                  <td>{s.name}</td>

                  <td>
                    <input
                      type="number"
                      value={rawMarks[s.id] || ''}
                      onChange={e => handleScoreChange(s.id, e.target.value)}
                    />
                  </td>

                  <td>{percent}%</td>

                  <td className={rubric.color}>
                    <div>
                      <strong>{rubric.level}</strong>
                      <div className="text-xs">{rubric.label}</div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {feedback && (
        <div className={feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}>
          {feedback.msg}
        </div>
      )}

      <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded">
        Save Marks
      </button>
    </div>
  );
};

export default MarksEntry;