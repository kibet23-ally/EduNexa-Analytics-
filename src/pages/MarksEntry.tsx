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

/** ================================
 * CBC RUBRIC FUNCTION (ADDED)
 * ================================ */
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

  const examsQuery = useData<Exam>('exams-list', 'exams', { select: 'id, exam_name' }, !!user?.school_id);
  const gradesQuery = useData<Grade>('grades-list', 'grades', {
    select: 'id, grade_name',
    orderBy: { column: 'grade_name', ascending: true }
  }, !!user?.school_id);
  const subjectsQuery = useData<Subject>('subjects-list', 'subjects', { select: 'id, subject_name' }, !!user?.school_id);
  const assignmentsQuery = useData<Assignment>('teacher-assignments-all', 'teacher_assignments', { select: 'id, teacher_id, subject_id, grade_id' }, !!user?.school_id && user.role === 'Teacher');

  const filteredGrades = useMemo(() => {
    const data = gradesQuery.data || [];
    if (user?.role !== 'Teacher' || !assignmentsQuery.data) return data;
    const teacherId = user.id.toString().replace('teacher-', '');
    const assignedGradeIds = new Set(assignmentsQuery.data.filter(as => as.teacher_id.toString() === teacherId).map(as => as.grade_id.toString()));
    return data.filter(g => assignedGradeIds.has(g.id.toString()));
  }, [gradesQuery.data, assignmentsQuery.data, user]);

  const filteredSubjects = useMemo(() => {
    const data = subjectsQuery.data || [];
    if (user?.role !== 'Teacher' || !assignmentsQuery.data) return data;
    const teacherId = user.id.toString().replace('teacher-', '');
    const assignedSubjectIds = new Set(assignmentsQuery.data.filter(as => as.teacher_id.toString() === teacherId).map(as => as.subject_id.toString()));
    return data.filter(s => assignedSubjectIds.has(s.id.toString()));
  }, [subjectsQuery.data, assignmentsQuery.data, user]);

  const studentsQuery = useData<Student>('students-marks', 'students', {
    select: 'id, name, admission_number, grade_id',
    filters: selectedGrade ? { grade_id: parseInt(selectedGrade) } : undefined
  }, !!selectedGrade);

  const students = useMemo(() => studentsQuery.data || [], [studentsQuery.data]);

  const existingMarksQuery = useData<Mark>('marks-existing', 'marks', {
    filters: selectedExam && selectedSubject ? {
      exam_id: parseInt(selectedExam),
      subject_id: parseInt(selectedSubject)
    } : undefined
  }, !!selectedExam && !!selectedSubject);

  const [marks, setMarks] = useState<Record<number, number>>({});
  const [rawMarks, setRawMarks] = useState<Record<number, string>>({});

  const lastMarksRef = React.useRef<string>('');

  React.useEffect(() => {
    if (existingMarksQuery.data) {
      const marksKey = JSON.stringify(existingMarksQuery.data);
      if (marksKey !== lastMarksRef.current) {
        const marksMap: Record<number, number> = {};
        const rawMap: Record<number, string> = {};

        existingMarksQuery.data.forEach((m) => {
          marksMap[m.student_id] = m.score;

          const raw = (m.score * Number(maxScore)) / 100;
          rawMap[m.student_id] = raw % 1 === 0 ? raw.toString() : raw.toFixed(1);
        });

        setMarks(marksMap);
        setRawMarks(rawMap);
        lastMarksRef.current = marksKey;
      }
    }
  }, [existingMarksQuery.data, maxScore]);

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
    setFeedback(null);

    try {
      const payloadMark = Object.entries(marks).map(([studentId, score]) => ({
        student_id: parseInt(studentId),
        score,
        exam_id: parseInt(selectedExam),
        subject_id: parseInt(selectedSubject),
        school_id: user?.school_id
      }));

      await marksMutation.mutateAsync({
        operation: 'upsert',
        payload: payloadMark,
        onConflict: 'student_id,exam_id,subject_id'
      });

      setFeedback({ type: 'success', msg: 'Marks saved!' });
    } catch (err: unknown) {
      const error = err as Error;
      setFeedback({ type: 'error', msg: error.message });
    }
  };

  const downloadTemplate = () => {
    const data = students.map(s => ({
      AdmissionNo: s.admission_number,
      Name: s.name,
      Score: ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");

    XLSX.writeFile(wb, "Marks_Template.xlsx");
  };

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws) as ExcelRow[];

      const newMarks = { ...marks };
      const newRaw = { ...rawMarks };

      data.forEach(row => {
        const adm = (row.AdmissionNo || row.admission_number || row['Adm No'])?.toString();
        const scoreStr = (row.Score || row.score || row.Mark || row.mark)?.toString();
        const score = parseFloat(scoreStr || '');

        const student = students.find(s => s.admission_number === adm);

        if (student && !isNaN(score)) {
          newMarks[student.id] = Math.round((score / currentMax) * 100);
          newRaw[student.id] = score.toString();
        }
      });

      setMarks(newMarks);
      setRawMarks(newRaw);

      setFeedback({ type: 'success', msg: 'Imported! Click Save.' });
    };

    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6">

      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Marks Entry</h1>
          <p className="text-slate-500 text-sm">Enter scores for examinations.</p>
        </div>
      </header>

      {/* SAME UI KEPT */}
      <div className="bg-white p-6 rounded-xl shadow-sm border grid grid-cols-1 md:grid-cols-4 gap-6">
        ...
      </div>

      {selectedExam && selectedGrade && selectedSubject && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">

          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
                <th className="px-6 py-3">Adm No</th>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Score / {currentMax}</th>
                <th className="px-6 py-3">Percentage</th>
                <th className="px-6 py-3">Rubric</th> {/* ADDED */}
              </tr>
            </thead>

            <tbody>
              {students.map(s => {
                const percent = marks[s.id] || 0;

                return (
                  <tr key={s.id}>
                    <td className="px-6 py-4 font-mono text-xs">{s.admission_number}</td>
                    <td className="px-6 py-4 font-bold">{s.name}</td>

                    <td className="px-6 py-4">
                      <input
                        type="number"
                        value={rawMarks[s.id] || ''}
                        onChange={e => handleScoreChange(s.id, e.target.value)}
                        className="w-24 px-3 py-1 border rounded"
                      />
                    </td>

                    <td className="px-6 py-4 font-bold text-blue-600">
                      {percent}%
                    </td>

                    {/* ADDED RUBRIC DISPLAY */}
                    <td className="px-6 py-4 font-black text-slate-700">
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