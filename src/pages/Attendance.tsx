import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useAuth } from '../useAuth';
import { useData, useDataMutation } from '../hooks/useData';
import { TableSkeleton } from '../components/ui/Skeleton';

type Status = 'present' | 'absent' | 'late' | 'excused';

const Attendance = () => {
  const { user } = useAuth();

  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');

  const [attendanceMap, setAttendanceMap] = useState<Record<number, any>>({});

  const attendanceMutation = useDataMutation('attendance');

  // ===================== DATA =====================

  const studentsQuery = useData('students', 'students', {
    select: 'id, name, admission_number, grade_id',
    filters: grade ? { grade_id: Number(grade) } : undefined
  }, !!user?.school_id && !!grade);

  const existingAttendanceQuery = useData('existing-attendance', 'attendance', {
    filters: {
      grade_id: Number(grade || 0),
      subject_id: Number(subject || 0),
      date
    }
  }, !!user?.school_id && !!grade && !!subject);

  const students = studentsQuery.data || [];
  const existing = existingAttendanceQuery.data || [];

  // ===================== LOAD EXISTING (EDIT MODE) =====================

  useEffect(() => {
    if (!students.length) return;

    const map: Record<number, any> = {};

    students.forEach(s => {
      const found = existing.find((a: any) => a.student_id === s.id);

      map[s.id] = {
        student_id: s.id,
        status: found?.status || 'present',
        remarks: found?.remarks || ''
      };
    });

    setAttendanceMap(map);
  }, [students, existing]);

  // ===================== FILTER =====================

  const filtered = useMemo(() => {
    return students.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.admission_number.toLowerCase().includes(search.toLowerCase())
    );
  }, [students, search]);

  // ===================== SAVE (UPSERT ONLY) =====================

  const handleSave = async () => {
    if (!grade || !subject) return alert('Select grade & subject');

    const payload = Object.values(attendanceMap).map(r => ({
      student_id: r.student_id,
      status: r.status,
      remarks: r.remarks,
      grade_id: Number(grade),
      subject_id: Number(subject),
      date,
      school_id: user?.school_id
    }));

    await attendanceMutation.mutateAsync({
      operation: 'upsert',
      payload,
      onConflict: 'student_id,subject_id,date'
    });

    alert('Attendance saved');
  };

  // ===================== UI =====================

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">

      {/* HEADER */}
      <div className="flex justify-between">
        <div>
          <h1 className="text-3xl font-bold">Class Attendance</h1>
          <p className="text-gray-500">Google Classroom Style Marking</p>
        </div>

        <button
          onClick={handleSave}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold"
        >
          Save Attendance
        </button>
      </div>

      {/* CONTROLS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-2xl border">

        <select value={subject} onChange={e => setSubject(e.target.value)}>
          <option value="">Select Subject</option>
        </select>

        <select value={grade} onChange={e => setGrade(e.target.value)}>
          <option value="">Select Grade</option>
        </select>

        <input type="date" value={date} onChange={e => setDate(e.target.value)} />

        <input
          placeholder="Search student"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl border overflow-hidden">

        {studentsQuery.isLoading ? (
          <TableSkeleton rows={6} cols={3} />
        ) : (
          <table className="w-full">

            <thead className="bg-gray-50 text-left text-xs uppercase">
              <tr>
                <th className="p-4">Student</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map(student => (
                <tr key={student.id} className="border-t">

                  {/* STUDENT */}
                  <td className="p-4">
                    <p className="font-bold">{student.name}</p>
                    <p className="text-xs text-gray-400">
                      {student.admission_number}
                    </p>
                  </td>

                  {/* STATUS */}
                  <td className="p-4 flex gap-2">

                    <button
                      onClick={() =>
                        setAttendanceMap(p => ({
                          ...p,
                          [student.id]: { ...p[student.id], status: 'present' }
                        }))
                      }
                      className={attendanceMap[student.id]?.status === 'present' ? 'text-green-600' : ''}
                    >
                      <CheckCircle2 />
                    </button>

                    <button
                      onClick={() =>
                        setAttendanceMap(p => ({
                          ...p,
                          [student.id]: { ...p[student.id], status: 'absent' }
                        }))
                      }
                      className={attendanceMap[student.id]?.status === 'absent' ? 'text-red-600' : ''}
                    >
                      <XCircle />
                    </button>

                    <button
                      onClick={() =>
                        setAttendanceMap(p => ({
                          ...p,
                          [student.id]: { ...p[student.id], status: 'late' }
                        }))
                      }
                      className={attendanceMap[student.id]?.status === 'late' ? 'text-amber-600' : ''}
                    >
                      <Clock />
                    </button>

                  </td>

                  {/* REMARKS */}
                  <td className="p-4">
                    <input
                      value={attendanceMap[student.id]?.remarks || ''}
                      onChange={e =>
                        setAttendanceMap(p => ({
                          ...p,
                          [student.id]: {
                            ...p[student.id],
                            remarks: e.target.value
                          }
                        }))
                      }
                      className="border rounded px-2 py-1 w-full"
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