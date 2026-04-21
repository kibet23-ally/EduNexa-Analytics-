import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { Exam, Grade, Subject, Student, Mark } from '../types';
import { getCBCGrade } from '../lib/utils';
import { Save, AlertCircle, CheckCircle2, FileEdit, Upload, Download } from 'lucide-react';
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
  teacher_name?: string;
  subject_name?: string;
  grade_name?: string;
}

const MarksEntry = () => {
  const { token, user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  
  const [marks, setMarks] = useState<Record<number, number>>({});
  const [rawMarks, setRawMarks] = useState<Record<number, string>>({});
  const [maxScore, setMaxScore] = useState<number | string>(100);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importLogs, setImportLogs] = useState<string[]>([]);

  const currentMax = Number(maxScore) || 100;

  useEffect(() => {
    const fetchData = async () => {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [e, g, s, a] = await Promise.all([
        fetch('/api/exams', { headers }).then(r => r.json()),
        fetch('/api/grades', { headers }).then(r => r.json()),
        fetch('/api/subjects', { headers }).then(r => r.json()),
        user?.role === 'Teacher' ? fetch('/api/assignments', { headers }).then(r => r.json()) : Promise.resolve([])
      ]);
      setExams(e);
      
      if (user?.role === 'Teacher') {
        const teacherAssignments = a.filter((as: Assignment) => as.teacher_id === user.id);
        const assignedGradeIds = new Set(teacherAssignments.map((as: Assignment) => as.grade_id));
        const assignedSubjectIds = new Set(teacherAssignments.map((as: Assignment) => as.subject_id));
        
        setGrades(g.filter((gr: Grade) => assignedGradeIds.has(gr.id)));
        setSubjects(s.filter((su: Subject) => {
          const name = su.subject_name.toLowerCase().trim();
          const isExcluded = ['science & technology', 'science and technology', 'music', 'art & craft', 'art and craft', 'physical education'].includes(name);
          return assignedSubjectIds.has(su.id) && !isExcluded;
        }));
      } else {
        setGrades(g);
        setSubjects(s.filter((su: Subject) => {
          const name = su.subject_name.toLowerCase().trim();
          return !['science & technology', 'science and technology', 'music', 'art & craft', 'art and craft', 'physical education'].includes(name);
        }));
      }
    };
    fetchData();
  }, [token, user]);

  useEffect(() => {
    if (selectedGrade) {
      fetch(`/api/students?grade_id=${selectedGrade}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).then(data => {
        setStudents(data.filter((s: Student) => s.grade_id === parseInt(selectedGrade)));
      });
    } else {
      setStudents([]);
    }
  }, [selectedGrade, token]);

  useEffect(() => {
    if (selectedExam && selectedGrade && selectedSubject) {
      fetch(`/api/marks?exam_id=${selectedExam}&grade_id=${selectedGrade}&subject_id=${selectedSubject}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).then(data => {
        const marksMap: Record<number, number> = {};
        const rawMap: Record<number, string> = {};
        data.forEach((m: Mark) => {
          marksMap[m.student_id] = m.score;
          // When loading existing marks, we assume they are percentages
          // We show them as raw scores based on the current maxScore
          const raw = (m.score * currentMax) / 100;
          rawMap[m.student_id] = raw % 1 === 0 ? raw.toString() : raw.toFixed(1);
        });
        setMarks(marksMap);
        setRawMarks(rawMap);
      });
    }
  }, [selectedExam, selectedGrade, selectedSubject, token, currentMax]);

  const handleScoreChange = (studentId: number, rawValue: string) => {
    const newRawMarks = { ...rawMarks, [studentId]: rawValue };
    setRawMarks(newRawMarks);

    const val = parseFloat(rawValue);
    if (isNaN(val)) {
      const newMarks = { ...marks };
      delete newMarks[studentId];
      setMarks(newMarks);
    } else if (val >= 0 && val <= currentMax) {
      const percentage = Math.round((val / currentMax) * 100);
      setMarks({ ...marks, [studentId]: percentage });
    }
  };

  const handleSave = async () => {
    if (!selectedExam || !selectedSubject) return;
    setSaving(true);
    setStatus(null);
    try {
      const payloadMarks = Object.entries(marks).map(([studentId, score]) => ({
        student_id: studentId,
        score
      }));

      const res = await fetch('/api/marks/bulk', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          exam_id: selectedExam,
          subject_id: selectedSubject,
          marks: payloadMarks
        })
      });

      if (res.ok) {
        setStatus({ type: 'success', msg: 'Marks saved successfully!' });
      } else {
        throw new Error('Failed to save');
      }
    } catch {
      setStatus({ type: 'error', msg: 'Failed to save marks.' });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedExam || !selectedSubject) return;

    setIsImporting(true);
    setImportLogs(['Reading marks file...']);
    
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws) as ExcelRow[];
          
          setImportLogs(prev => [...prev, `Found ${data.length} records.`]);
          
          const newMarks = { ...marks };
          const newRawMarks = { ...rawMarks };

          data.forEach(row => {
            const adm = row.AdmissionNo || row.admission_number || row['Adm No'];
            const score = row.Score || row.score || row.Mark || row.mark;
            
            const student = students.find(s => s.admission_number === adm.toString());
            if (student && score !== undefined) {
              const val = parseFloat(score);
              if (!isNaN(val) && val >= 0 && val <= currentMax) {
                const percentage = Math.round((val / currentMax) * 100);
                newMarks[student.id] = percentage;
                newRawMarks[student.id] = val.toString();
              }
            }
          });

          setMarks(newMarks);
          setRawMarks(newRawMarks);
          setImportLogs(prev => [...prev, `✅ Processed. Click "Save All" to commit to database.`]);
        } catch {
           setImportLogs(prev => [...prev, `❌ Error parsing file`]);
        }
      };
      reader.readAsBinaryString(file);
    } catch {
       setImportLogs(prev => [...prev, `❌ Import failed`]);
    }
  };

  const downloadTemplate = () => {
    const data = students.map(s => ({
      'AdmissionNo': s.admission_number,
      'Name': s.name,
      'Score': ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Marks Template");
    XLSX.writeFile(wb, `Marks_Template_${selectedSubject}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Marks Entry</h1>
        <p className="text-slate-500 text-sm">Enter and update student scores for exams.</p>
      </header>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Exam</label>
            <select 
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Select Exam</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.exam_name} ({e.year})</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Grade</label>
            <select 
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Select Grade</option>
              {grades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Subject</label>
            <select 
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Select Subject</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Out Of (Max Score)</label>
            <input 
              type="text"
              inputMode="numeric"
              value={maxScore}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^\d+$/.test(val)) {
                  setMaxScore(val);
                }
              }}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-blue-600"
            />
          </div>
        </div>
      </div>

      {selectedExam && selectedGrade && selectedSubject ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4">
            <h3 className="font-bold text-slate-900">Student List</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {status && (
                <span className={`text-sm flex items-center gap-1 ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {status.msg}
                </span>
              )}
              
              <button 
                onClick={downloadTemplate}
                className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                title="Download class list as template"
              >
                <Download size={18} />
                Template
              </button>

              <label className="cursor-pointer inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
                <Upload size={18} />
                Bulk Import
                <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleBulkImport} />
              </label>

              <button 
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
              >
                <Save size={18} />
                {saving ? 'Saving...' : 'Save All Marks'}
              </button>
            </div>
          </div>

          {isImporting && (
            <div className="bg-slate-900 p-4 text-white font-mono text-[10px] space-y-1 relative">
              <button onClick={() => setIsImporting(false)} className="absolute top-2 right-2 text-slate-500 hover:text-white">
                <X size={14} />
              </button>
              {importLogs.map((log, i) => <div key={i}>{log}</div>)}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="px-6 py-3">Admission No</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3 w-32">Raw Score</th>
                  <th className="px-6 py-3">Converted (%)</th>
                  <th className="px-6 py-3">CBC Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-slate-500">{student.admission_number}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{student.name}</td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2">
                        <input 
                          type="number"
                          step="0.5"
                          min="0"
                          max={currentMax}
                          value={rawMarks[student.id] ?? ''}
                          onChange={(e) => handleScoreChange(student.id, e.target.value)}
                          className="w-20 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-center font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                        <span className="text-slate-400 text-xs font-medium">/ {currentMax}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                      {marks[student.id] !== undefined && (
                        <div className="inline-flex items-center gap-1.5">
                          <span className="font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            {marks[student.id]}%
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {marks[student.id] !== undefined && (
                        <span className={`font-bold px-3 py-1 rounded-full text-xs ${
                          marks[student.id] >= 80 ? 'bg-green-100 text-green-700' :
                          marks[student.id] >= 60 ? 'bg-blue-100 text-blue-700' :
                          marks[student.id] >= 40 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {getCBCGrade(marks[student.id]).level}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-4">
            <FileEdit size={24} />
          </div>
          <h3 className="text-slate-900 font-bold">Ready to enter marks?</h3>
          <p className="text-slate-500 text-sm max-w-xs mx-auto mt-1">
            Please select an exam, grade, and subject from the filters above to load the student list.
          </p>
        </div>
      )}
    </div>
  );
};

export default MarksEntry;
