import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useSubscription } from '../useSubscription';
import { useAuth } from '../useAuth';
import { useData, useDataMutation } from '../hooks/useData';
import { TableSkeleton } from '../components/ui/Skeleton';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

const PAGE_SIZE = 50;

const Attendance = () => {
  const { user, sessionReady } = useAuth();
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

  const enabled = sessionReady && !!user?.school_id;

  // =========================
  // GRADES (FIXED)
  // =========================
  const gradesQuery = useData<Grade>(
    'grades-all',
    'grades',
    {
      select: 'id, grade_name',
      orderBy: { column: 'grade_name', ascending: true },
      filters: { school_id: user?.school_id },
    },
    enabled
  );

  // =========================
  // SUBJECTS (FIXED)
  // =========================
  const subjectsQuery = useData<Subject>(
    'subjects-all',
    'subjects',
    {
      select: 'id, subject_name',
      filters: { school_id: user?.school_id },
    },
    enabled
  );

  // =========================
  // TEACHER ASSIGNMENTS (RBAC SAFE)
  // =========================
  const assignmentsQuery = useData<any>(
    'teacher-assignments',
    'teacher_assignments',
    {
      select: 'subject_id, grade_id',
      filters: { is_active: true, teacher_id: user?.id },
    },
    enabled && user?.role === 'Teacher'
  );

  const assignments = assignmentsQuery.data || [];

  const isTeacher = user?.role === 'Teacher';

  // =========================
  // FILTERED SUBJECTS (SAFE)
  // =========================
  const teacherSubjects = useMemo(() => {
    const all = subjectsQuery.data || [];

    if (!isTeacher) return all;
    if (!assignments.length) return all; // 🔥 fallback fix

    const allowed = new Set(assignments.map((a: any) => a.subject_id));
    return all.filter((s: any) => allowed.has(s.id));
  }, [subjectsQuery.data, assignments, isTeacher]);

  // =========================
  // FILTERED GRADES (SAFE)
  // =========================
  const teacherGrades = useMemo(() => {
    const all = gradesQuery.data || [];

    if (!isTeacher) return all;
    if (!assignments.length) return all;

    const allowed = new Set(assignments.map((a: any) => a.grade_id));
    return all.filter((g: any) => allowed.has(g.id));
  }, [gradesQuery.data, assignments, isTeacher]);

  // =========================
  // STUDENTS
  // =========================
  const studentsQuery = useData<Student>(
    'students-attendance',
    'students',
    {
      select: 'id, name, admission_number, grade_id',
      filters: selectedGrade ? { grade_id: Number(selectedGrade) } : undefined,
      range: { from: page * PAGE_SIZE, to: (page + 1) * PAGE_SIZE - 1 },
    },
    enabled && !!selectedGrade
  );

  const students = studentsQuery.data || [];

  // =========================
  // INIT ATTENDANCE STATE
  // =========================
  const lastRef = React.useRef('');

  useEffect(() => {
    const ids = students.map((s) => s.id).join(',');

    if (students.length && ids !== lastRef.current) {
      const init: any = {};
      students.forEach((s) => {
        init[s.id] = {
          student_id: s.id,
          status: 'present',
          remarks: '',
        };
      });

      setAttendanceData(init);
      lastRef.current = ids;
    }
  }, [students]);

  // =========================
  // SUBMIT (UPSERT FIXED)
  // =========================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isReadOnly) return;
    if (!selectedGrade || !selectedSubject) {
      alert('Select Grade and Subject');
      return;
    }

    try {
      const payload = Object.values(attendanceData).map((r: any) => ({
        ...r,
        grade_id: Number(selectedGrade),
        subject_id: Number(selectedSubject),
        date: selectedDate,
        school_id: user?.school_id,
      }));

      await attendanceMutation.mutateAsync({
        operation: 'upsert',
        payload,
        onConflict:
          'student_id,subject_id,grade_id,date,school_id',
      });

      alert('Attendance saved successfully');
    } catch (err: any) {
      alert('Failed: ' + err.message);
    }
  };

  // =========================
  // FILTER SEARCH
  // =========================
  const filteredStudents = useMemo(() => {
    return students.filter(
      (s: any) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.admission_number.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [students, searchTerm]);

  // =========================
  // UI
  // =========================
  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Attendance</h1>
          <p className="text-gray-500">{selectedDate}</p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={attendanceMutation.isPending}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl"
        >
          {attendanceMutation.isPending ? 'Saving...' : 'Submit'}
        </button>
      </header>

      {/* DROPDOWNS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-2xl">
        <select
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          className="p-3 bg-gray-100 rounded-xl"
        >
          <option>Select Subject</option>
          {teacherSubjects.map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.subject_name}
            </option>
          ))}
        </select>

        <select
          value={selectedGrade}
          onChange={(e) => setSelectedGrade(e.target.value)}
          className="p-3 bg-gray-100 rounded-xl"
        >
          <option>Select Grade</option>
          {teacherGrades.map((g: any) => (
            <option key={g.id} value={g.id}>
              {g.grade_name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="p-3 bg-gray-100 rounded-xl"
        />

        <input
          placeholder="Search student..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="p-3 bg-gray-100 rounded-xl"
        />
      </div>

      {/* STUDENTS */}
      <div className="bg-white rounded-2xl p-4">
        {studentsQuery.isLoading ? (
          <TableSkeleton rows={10} cols={3} />
        ) : (
          <table className="w-full">
            <tbody>
              {filteredStudents.map((s: any) => (
                <tr key={s.id} className="border-b">
                  <td className="p-3 font-bold">{s.name}</td>

                  <td className="p-3 flex gap-2">
                    <button
                      onClick={() =>
                        setAttendanceData((p) => ({
                          ...p,
                          [s.id]: { ...p[s.id], status: 'present' },
                        }))
                      }
                      className="text-green-600"
                    >
                      Present
                    </button>

                    <button
                      onClick={() =>
                        setAttendanceData((p) => ({
                          ...p,
                          [s.id]: { ...p[s.id], status: 'absent' },
                        }))
                      }
                      className="text-red-600"
                    >
                      Absent
                    </button>

                    <button
                      onClick={() =>
                        setAttendanceData((p) => ({
                          ...p,
                          [s.id]: { ...p[s.id], status: 'late' },
                        }))
                      }
                      className="text-yellow-600"
                    >
                      Late
                    </button>
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