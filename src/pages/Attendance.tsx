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
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [searchTerm, setSearchTerm] = useState('');

  const [attendanceData, setAttendanceData] = useState<
    Record<number, { student_id: number; status: AttendanceStatus; remarks: string }>
  >({});

  const attendanceMutation = useDataMutation('attendance');

  // ===================== DATA =====================

  const gradesQuery = useData('grades-all', 'grades', {
    select: 'id, grade_name',
    orderBy: { column: 'grade_name', ascending: true }
  }, !!user?.school_id);

  const subjectsQuery = useData('subjects-all', 'subjects', {
    select: 'id, subject_name'
  }, !!user?.school_id);

  const assignmentsQuery = useData('teacher-assignments', 'teacher_assignments', {
    select: '*, grades(grade_name), subjects(subject_name)',
    filters: { is_active: true }
  }, !!user?.school_id && user?.role === 'Teacher');

  const studentsQuery = useData('students-attendance', 'students', {
    select: 'id, name, admission_number, grade_id',
    filters: selectedGrade ? { grade_id: Number(selectedGrade) } : undefined,
    limit: PAGE_SIZE
  }, !!user?.school_id && !!selectedGrade);

  const students = studentsQuery.data || [];

  const assignments = assignmentsQuery.data || [];
  const isTeacher = user?.role === 'Teacher';

  // ===================== INIT ATTENDANCE STATE =====================

  const lastRef = React.useRef('');

  React.useEffect(() => {
    const ids = students.map(s => s.id).join(',');

    if (students.length > 0 && ids !== lastRef.current) {
      const initial: Record<number, any> = {};

      students.forEach(s => {
        initial[s.id] = {
          student_id: s.id,
          status: 'present',
          remarks: ''
        };
      });

      setAttendanceData(initial);
      lastRef.current = ids;
    }
  }, [students]);

  // ===================== FILTER =====================

  const filteredStudents = useMemo(() => {
    return students.filter(s =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.admission_number.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [students, searchTerm]);

  // ===================== SUBJECTS / GRADES =====================

  const teacherSubjects = useMemo(() => {
    if (!isTeacher) return subjectsQuery.data || [];
    const ids = new Set(assignments.map(a => a.subject_id));
    return (subjectsQuery.data || []).filter(s => ids.has(s.id));
  }, [subjectsQuery.data, assignments]);

  const teacherGrades = useMemo(() => {
    if (!isTeacher) return gradesQuery.data || [];
    const ids = new Set(assignments.map(a => a.grade_id));
    return (gradesQuery.data || []).filter(g => ids.has(g.id));
  }, [gradesQuery.data, assignments]);

  // ===================== SUBMIT (FIXED) =====================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isReadOnly) return;
    if (!selectedGrade || !selectedSubject) {
      alert('Select Grade and Subject');
      return;
    }

    try {
      const payload = Object.values(attendanceData).map(record => ({
        student_id: record.student_id,
        status: record.status,
        remarks: record.remarks,
        grade_id: Number(selectedGrade),
        subject_id: Number(selectedSubject),
        date: selectedDate,
        school_id: user?.school_id
      }));

      await attendanceMutation.mutateAsync({
        operation: 'upsert',
        payload,
        onConflict: 'student_id,subject_id,date'
      });

      alert('Attendance saved successfully!');
    } catch (err: any) {
      alert('Failed: ' + err.message);
    }
  };

  // ===================== UI =====================

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">

      {/* HEADER */}
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Attendance</h1>
          <p className="text-slate-500">
            Mark attendance for {selectedDate}
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={attendanceMutation.isPending}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold"
        >
          {attendanceMutation.isPending ? 'Saving...' : 'Submit'}
        </button>
      </header>

      {/* FILTERS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-2xl border">

        <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
          <option value="">Select Subject</option>
          {teacherSubjects.map(s => (
            <option key={s.id} value={s.id}>{s.subject_name}</option>
          ))}
        </select>

        <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}>
          <option value="">Select Grade</option>
          {teacherGrades.map(g => (
            <option key={g.id} value={g.id}>{g.grade_name}</option>
          ))}
        </select>

        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
        />

        <input
          placeholder="Search student"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl border overflow-hidden">

        {studentsQuery.isLoading ? (
          <div className="p-10">
            <TableSkeleton rows={6} cols={3} />
          </div>
        ) : (
          <table className="w-full">

            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase">
                <th className="p-4">Student</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>

            <tbody>
              {filteredStudents.map(student => (
                <tr key={student.id} className="border-t">

                  <td className="p-4">
                    <p className="font-bold">{student.name}</p>
                    <p className="text-xs text-slate-400">
                      {student.admission_number}
                    </p>
                  </td>

                  <td className="p-4 flex gap-2">
                    <button onClick={() =>
                      setAttendanceData(p => ({
                        ...p,
                        [student.id]: { ...p[student.id], status: 'present' }
                      }))
                    }>✔</button>

                    <button onClick={() =>
                      setAttendanceData(p => ({
                        ...p,
                        [student.id]: { ...p[student.id], status: 'absent' }
                      }))
                    }>✖</button>

                    <button onClick={() =>
                      setAttendanceData(p => ({
                        ...p,
                        [student.id]: { ...p[student.id], status: 'late' }
                      }))
                    }>⏰</button>
                  </td>

                  <td className="p-4">
                    <input
                      value={attendanceData[student.id]?.remarks || ''}
                      onChange={e =>
                        setAttendanceData(p => ({
                          ...p,
                          [student.id]: {
                            ...p[student.id],
                            remarks: e.target.value
                          }
                        }))
                      }
                      className="border px-2 py-1 rounded"
                    />
                  </td>

                </tr>
              ))}
            </tbody>

          </table>
        )}
      </div>
    </div>
  );
};

export default Attendance;