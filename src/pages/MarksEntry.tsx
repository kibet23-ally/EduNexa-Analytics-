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

const MarksEntry = () => {
  const { user } = useAuth();
  const { isReadOnly } = useSubscription();
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [maxScore, setMaxScore] = useState<number | string>(100);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const currentMax = Number(maxScore) || 100;

  // Mutations
  const marksMutation = useDataMutation('marks');

  // Multi-Fetch
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

  // Initialize marks from existing data
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
    const data = students.map(s => ({ 'AdmissionNo': s.admission_number, 'Name': s.name, 'Score': '' }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `Marks_Template.xlsx`);
  };

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as ExcelRow[];
      
      const newMarks = { ...marks };
      const newRawMarks = { ...rawMarks };
      
      data.forEach(row => {
        const adm = (row.AdmissionNo || row.admission_number || row['Adm No'])?.toString();
        const scoreStr = (row.Score || row.score || row.Mark || row.mark)?.toString();
        const score = parseFloat(scoreStr || '');
        const student = students.find(s => s.admission_number === adm);
        if (student && !isNaN(score)) {
          newMarks[student.id] = Math.round((score / currentMax) * 100);
          newRawMarks[student.id] = score.toString();
        }
      });
      setMarks(newMarks);
      setRawMarks(newRawMarks);
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
        {isReadOnly && <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold">READ-ONLY</span>}
      </header>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase">Exam</label>
          <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border rounded-lg text-sm">
            <option value="">Select Exam</option>
            {examsQuery.data?.map(e => <option key={e.id} value={e.id}>{e.exam_name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase">Grade</label>
          <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border rounded-lg text-sm">
            <option value="">Select Grade</option>
            {filteredGrades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase">Subject</label>
          <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border rounded-lg text-sm">
            <option value="">Select Subject</option>
            {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase">Max Score</label>
          <input type="number" value={maxScore} onChange={e => setMaxScore(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border rounded-lg text-sm font-bold text-blue-600" />
        </div>
      </div>

      {selectedExam && selectedGrade && selectedSubject && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px]">
          <div className="p-4 border-b flex items-center justify-between bg-slate-50/30">
            <h3 className="font-bold text-sm text-slate-500 uppercase tracking-widest">Student Marks</h3>
            <div className="flex gap-2 items-center">
              {feedback && <span className={`text-xs font-bold ${feedback.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>{feedback.msg}</span>}
              <button title="Download Template" onClick={downloadTemplate} className="p-2 hover:bg-white rounded border"><Download size={16} /></button>
              <label title="Import Excel" className={`p-2 rounded border cursor-pointer ${isReadOnly ? 'opacity-30' : 'hover:bg-white'}`}>
                <Upload size={16} /><input type="file" className="hidden" disabled={isReadOnly} onChange={handleBulkImport} />
              </label>
              <button 
                onClick={handleSave} 
                disabled={marksMutation.isPending || isReadOnly} 
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold disabled:opacity-50"
              >
                {marksMutation.isPending ? 'Saving...' : <><Save size={14} /> Save Changes</>}
              </button>
            </div>
          </div>
          {studentsQuery.isLoading ? (
            <div className="p-8"><TableSkeleton rows={10} cols={4} /></div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] uppercase font-black text-slate-400">
                  <th className="px-6 py-3">Adm No</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Score / {currentMax}</th>
                  <th className="px-6 py-3">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {students.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs">{s.admission_number}</td>
                    <td className="px-6 py-4 font-bold text-slate-700">{s.name}</td>
                    <td className="px-6 py-4">
                      <input 
                        type="number" 
                        value={rawMarks[s.id] || ''} 
                        disabled={isReadOnly}
                        onChange={e => handleScoreChange(s.id, e.target.value)}
                        className="w-24 px-3 py-1.5 bg-slate-50 border rounded-lg text-center font-bold text-slate-600 outline-none focus:ring-1 ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 font-black text-blue-600">{marks[s.id] || 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default MarksEntry;
