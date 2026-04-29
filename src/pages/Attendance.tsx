import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useSubscription } from '../useSubscription';
import { useAuth } from '../useAuth';
import { useData, useDataMutation } from '../hooks/useData';
import { TableSkeleton } from '../components/ui/Skeleton';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

const PAGE_SIZE = 50;

const Attendance = () => {
  const { user } = useAuth();
  const { isReadOnly } = useSubscription();
  const [page, setPage] = useState(0);
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [attendanceData, setAttendanceData] = useState<Record<number, { student_id: number; status: AttendanceStatus; remarks: string }>>({});

  // Mutations
  const attendanceMutation = useDataMutation('attendance');

  // Multi-Fetch with Caching
  const gradesQuery = useData<Grade>('grades-all', 'grades', { 
    select: 'id, grade_name',
    orderBy: { column: 'grade_name', ascending: true }
  }, !!user?.school_id);
  const subjectsQuery = useData<Subject>('subjects-all', 'subjects', { select: 'id, subject_name' }, !!user?.school_id);
  
  const assignmentsQuery = useData<TeacherAssignment>('teacher-assignments-active', 'teacher_assignments', {
    select: '*, grades(grade_name), subjects(subject_name)',
    filters: { is_active: true }
  }, !!user?.school_id && user?.role === 'Teacher');

  const isTeacher = user?.role === 'Teacher';
  const assignments = useMemo(() => assignmentsQuery.data || [], [assignmentsQuery.data]);

  const teacherSubjects = useMemo(() => {
    const all = subjectsQuery.data || [];
    if (!isTeacher) return all;
    const assignedIds = new Set(assignments.map(a => a.subject_id));
    return all.filter(s => assignedIds.has(s.id));
  }, [subjectsQuery.data, isTeacher, assignments]);

  const teacherGrades = useMemo(() => {
    const all = gradesQuery.data || [];
    if (!isTeacher) {
      return [...all].sort((a, b) => {
        const numA = parseInt(a.grade_name.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.grade_name.match(/\d+/)?.[0] || '0');
        if (numA !== numB) return numA - numB;
        return a.grade_name.localeCompare(b.grade_name);
      });
    }
    
    let filtered = all;
    if (selectedSubject) {
      const subId = Number(selectedSubject);
      const assignedGradeIds = new Set(assignments.filter(a => a.subject_id === subId).map(a => a.grade_id));
      filtered = all.filter(g => assignedGradeIds.has(g.id));
    } else {
      const assignedGradeIds = new Set(assignments.map(a => a.grade_id));
      filtered = all.filter(g => assignedGradeIds.has(g.id));
    }

    return [...filtered].sort((a, b) => {
      const numA = parseInt(a.grade_name.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.grade_name.match(/\d+/)?.[0] || '0');
      if (numA !== numB) return numA - numB;
      return a.grade_name.localeCompare(b.grade_name);
    });
  }, [gradesQuery.data, isTeacher, assignments, selectedSubject]);

  const studentsQuery = useData<Student>('students-attendance', 'students', {
    select: 'id, name, admission_number, grade_id',
    filters: selectedGrade ? { grade_id: Number(selectedGrade) } : undefined,
    range: { from: page * PAGE_SIZE, to: (page + 1) * PAGE_SIZE - 1 }
  }, !!user?.school_id && !!selectedGrade);

  const students = useMemo(() => (studentsQuery.data || []) as Student[], [studentsQuery.data]);

  // Sync internal attendance state with fetched students
  // Use a ref to track if we've already initialized for the current students list
  const lastStudentsRef = React.useRef<string>('');
  
  React.useEffect(() => {
    const studentIds = students.map(s => s.id).join(',');
    if (students.length > 0 && studentIds !== lastStudentsRef.current) {
      const initial: Record<number, { student_id: number; status: AttendanceStatus; remarks: string }> = {};
      students.forEach((s) => {
        initial[s.id] = { student_id: s.id, status: 'present' as const, remarks: '' };
      });
      setAttendanceData(initial);
      lastStudentsRef.current = studentIds;
    }
  }, [students]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!selectedGrade || !selectedSubject) return alert('Select Grade and Subject');

    try {
      const payload = Object.values(attendanceData).map(record => ({
        ...record,
        grade_id: Number(selectedGrade),
        subject_id: Number(selectedSubject),
        date: selectedDate,
        school_id: user?.school_id
      }));
      await attendanceMutation.mutateAsync({ operation: 'insert', payload });
      alert('Attendance saved!');
    } catch (err: unknown) {
      const error = err as Error;
      alert('Failed: ' + error.message);
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.admission_number.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [students, searchTerm]);

  const handleSubjectChange = (val: string) => {
    setSelectedSubject(val);
    if (isTeacher && val) {
      const subId = Number(val);
      const assignedGradeIds = new Set(assignments.filter(a => a.subject_id === subId).map(a => a.grade_id));
      if (selectedGrade && !assignedGradeIds.has(Number(selectedGrade))) {
        setSelectedGrade('');
      }
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Attendance</h1>
          <p className="text-slate-500 font-medium">Record student presence for {selectedDate}.</p>
        </div>
        
        <div className="flex gap-2">
           <button 
              onClick={handleSubmit}
              disabled={attendanceMutation.isPending || isReadOnly || !selectedGrade || !selectedSubject}
              className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-lg disabled:opacity-50"
            >
              {attendanceMutation.isPending ? 'Saving...' : 'Submit Attendance'}
            </button>
        </div>
      </header>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400">Subject</label>
          <select value={selectedSubject} onChange={e => handleSubjectChange(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold">
            <option value="">Select Subject</option>
            {teacherSubjects.map((s) => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400">Grade</label>
          <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold">
            <option value="">Select Grade</option>
            {teacherGrades.map((g) => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400">Date</label>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400">Search</label>
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold" placeholder="Find student..." />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden min-h-[400px]">
        <div className="p-4 border-b flex items-center justify-between bg-slate-50/30">
           <h3 className="text-sm font-bold text-slate-400">STUDENT LIST</h3>
           <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1 border rounded disabled:opacity-30"><ChevronLeft size={16}/></button>
              <span className="text-xs font-bold">Page {page + 1}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={students.length < PAGE_SIZE} className="p-1 border rounded disabled:opacity-30"><ChevronRight size={16}/></button>
           </div>
        </div>
        {studentsQuery.isLoading ? (
          <div className="p-12"><TableSkeleton rows={10} cols={3} /></div>
        ) : filteredStudents.length > 0 ? (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b">
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Student</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50/30">
                  <td className="px-6 py-5">
                    <p className="font-bold text-slate-900">{student.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono uppercase">{student.admission_number}</p>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-center gap-2">
                      <StatusBtn active={attendanceData[student.id]?.status === 'present'} onClick={() => setAttendanceData(p => ({...p, [student.id]: {...p[student.id], status: 'present'}}))} type="present" icon={CheckCircle2} />
                      <StatusBtn active={attendanceData[student.id]?.status === 'absent'} onClick={() => setAttendanceData(p => ({...p, [student.id]: {...p[student.id], status: 'absent'}}))} type="absent" icon={XCircle} />
                      <StatusBtn active={attendanceData[student.id]?.status === 'late'} onClick={() => setAttendanceData(p => ({...p, [student.id]: {...p[student.id], status: 'late'}}))} type="late" icon={Clock} />
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <input 
                      value={attendanceData[student.id]?.remarks || ''} 
                      onChange={e => setAttendanceData(p => ({...p, [student.id]: {...p[student.id], remarks: e.target.value}}))}
                      className="w-full bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-1 ring-slate-200"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-20 text-center text-slate-400 font-medium">No students found. Select a grade to start.</div>
        )}
      </div>
    </div>
  );
};

interface StatusBtnProps {
  active: boolean;
  onClick: () => void;
  type: 'present' | 'absent' | 'late';
  icon: React.ElementType;
}

const StatusBtn = ({ active, onClick, type, icon: Icon }: StatusBtnProps) => {
  const colors: Record<string, string> = { 
    present: 'bg-emerald-500 text-white', 
    absent: 'bg-red-500 text-white', 
    late: 'bg-amber-500 text-white' 
  };
  return (
    <button onClick={onClick} className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all", active ? colors[type] : "bg-slate-50 text-slate-400 border-transparent")}>
      <Icon size={18} />
    </button>
  );
};

export default Attendance;
