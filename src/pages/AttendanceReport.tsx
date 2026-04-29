import React, { useState, useCallback, useMemo } from 'react';
import { 
  BarChart3, 
  Search,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Edit,
  Trash2,
  X,
  History,
  LayoutDashboard
} from 'lucide-react';
import { cn } from '../lib/utils';
import { fetchWithProxy, writeWithProxy } from '../lib/fetchProxy';
import { useData } from '../hooks/useData';
import { useAuth } from '../useAuth';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Letterhead from '../components/Letterhead';

interface Grade {
  id: number;
  grade_name: string;
}

interface Subject {
  id: number;
  subject_name: string;
}

interface TeacherAssignment {
  id: number;
  teacher_id: number;
  subject_id: number;
  grade_id: number;
}

interface AttendanceProxyItem {
  id: number;
  student_id: number;
  date: string;
  status: string;
  grade_id: number;
  subject_id: number;
  remarks?: string;
  students?: { name: string; admission_number: string };
  subjects?: { subject_name: string };
  grades?: { grade_name: string };
}

interface AttendanceRecord {
  id: number;
  student_id: number;
  student_name: string;
  admission_number: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  remarks?: string;
  subject_name: string;
  grade_name: string;
}

interface StudentSummary {
  id: number;
  name: string;
  admission_number: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  percentage: number;
}

const AttendanceReport = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'summary' | 'logs'>('summary');
  
  // Edit/Delete state
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const gradesQuery = useData<Grade>('grades-list-att', 'grades', {
    select: 'id, grade_name',
    orderBy: { column: 'grade_name', ascending: true }
  }, !!user?.school_id);

  const subjectsQuery = useData<Subject>('subjects-list-att', 'subjects', {
    select: 'id, subject_name',
    orderBy: { column: 'subject_name', ascending: true }
  }, !!user?.school_id);

  const assignmentsQuery = useData<TeacherAssignment>('assignments-list-att', 'teacher_assignments', {
    filters: { is_active: true }
  }, !!user?.school_id && user.role === 'Teacher');

  const allGrades = useMemo(() => {
    const data = gradesQuery.data || [];
    return [...data].sort((a, b) => {
      const numA = parseInt(a.grade_name.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.grade_name.match(/\d+/)?.[0] || '0');
      if (numA !== numB) return numA - numB;
      return a.grade_name.localeCompare(b.grade_name);
    });
  }, [gradesQuery.data]);

  const assignments = useMemo(() => assignmentsQuery.data || [], [assignmentsQuery.data]);
  const isTeacher = user?.role === 'Teacher';

  const subjects = useMemo(() => {
    const sData = subjectsQuery.data || [];
    if (!isTeacher) return sData;
    const assignedIds = new Set(assignments.map(a => Number(a.subject_id)));
    return sData.filter(s => assignedIds.has(s.id));
  }, [subjectsQuery.data, isTeacher, assignments]);

  // Derived grades based on subject in Report
  const currentGrades = useMemo(() => {
    if (!isTeacher) return allGrades;
    if (assignments.length === 0) return [];
    
    if (selectedSubject) {
      const subjectId = Number(selectedSubject);
      const relevantGradeIds = assignments
        .filter(a => Number(a.subject_id) === subjectId)
        .map(a => Number(a.grade_id));
      return allGrades.filter(g => relevantGradeIds.includes(g.id));
    }
    
    const assignedGradeIds = new Set(assignments.map(a => Number(a.grade_id)));
    return allGrades.filter(g => assignedGradeIds.has(g.id));
  }, [allGrades, assignments, isTeacher, selectedSubject]);

  // Handle grade reset when subject changes in Report
  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubject(subjectId);
    if (isTeacher && subjectId && selectedGrade && (assignments.length > 0)) {
      const subId = Number(subjectId);
      const relevantGradeIds = assignments
        .filter(a => Number(a.subject_id) === subId)
        .map(a => Number(a.grade_id));
      
      if (!relevantGradeIds.includes(Number(selectedGrade))) {
        setSelectedGrade('');
      }
    }
  };

  const fetchAttendance = useCallback(async () => {
    if (!user?.school_id) return;

    if (isTeacher && assignments.length === 0) {
      setAttendance([]);
      return;
    }

    setLoading(true);
    try {
      const filters: Record<string, unknown> = {};
      if (selectedGrade) filters.grade_id = Number(selectedGrade);
      if (selectedSubject) filters.subject_id = Number(selectedSubject);
      
      const result = await fetchWithProxy('attendance', {
        select: '*, students:student_id(name, admission_number), subjects:subject_id(subject_name), grades:grade_id(grade_name)',
        filters: filters
      });
      let filteredData = result.data || [];

      if (isTeacher) {
        const assignedGrades = new Set(assignments.map(a => Number(a.grade_id)));
        const assignedSubjects = new Set(assignments.map(a => Number(a.subject_id)));
        
        filteredData = filteredData.filter((r: AttendanceProxyItem) => 
          assignedGrades.has(Number(r.grade_id)) && 
          assignedSubjects.has(Number(r.subject_id))
        );
      }

      if (startDate || endDate) {
        filteredData = (filteredData as { date: string }[]).filter((r) => {
          if (startDate && r.date < startDate) return false;
          if (endDate && r.date > endDate) return false;
          return true;
        });
      }
      
      const processed: AttendanceRecord[] = (filteredData as AttendanceProxyItem[]).map((item) => ({
        id: item.id,
        student_id: item.student_id,
        student_name: item.students?.name || 'Unknown',
        admission_number: item.students?.admission_number || 'N/A',
        date: item.date,
        status: item.status as 'present' | 'absent' | 'late' | 'excused',
        remarks: item.remarks || '',
        subject_name: item.subjects?.subject_name || 'N/A',
        grade_name: item.grades?.grade_name || 'N/A'
      }));
      
      setAttendance(processed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load attendance records.';
      if (!attendance.length) setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedGrade, selectedSubject, startDate, endDate, isTeacher, assignments, user?.school_id, attendance.length]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    
    setActionLoading(true);
    try {
      await writeWithProxy('attendance', 'update', 
        { status: editingRecord.status, remarks: editingRecord.remarks },
        { id: editingRecord.id }
      );

      setFeedback({ type: 'success', message: 'Attendance record updated successfully' });
      setEditingRecord(null);
      fetchAttendance();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Update failed' });
    } finally {
      setActionLoading(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    
    setActionLoading(true);
    try {
      await writeWithProxy('attendance', 'delete', null, { id: deletingId });
      setFeedback({ type: 'success', message: 'Record deleted successfully' });
      setDeletingId(null);
      fetchAttendance();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Delete failed' });
    } finally {
      setActionLoading(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  useEffect(() => {
    const load = async () => { await fetchAttendance(); };
    load();
  }, [fetchAttendance]);

  const studentSummaries: StudentSummary[] = useMemo(() => {
    const map = new Map<number, StudentSummary>();
    
    attendance.forEach(record => {
      if (!map.has(record.student_id)) {
        map.set(record.student_id, {
          id: record.student_id,
          name: record.student_name,
          admission_number: record.admission_number,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          total: 0,
          percentage: 0
        });
      }
      
      const summary = map.get(record.student_id)!;
      summary.total += 1;
      summary[record.status] += 1;
    });

    const result = Array.from(map.values()).map(s => ({
      ...s,
      percentage: s.total > 0 ? (s.present / s.total) * 100 : 0
    }));

    return result.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.admission_number.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [attendance, searchTerm]);

  const totalStats = {
    present: studentSummaries.reduce((acc, s) => acc + s.present, 0),
    absent: studentSummaries.reduce((acc, s) => acc + s.absent, 0),
    late: studentSummaries.reduce((acc, s) => acc + s.late, 0),
    excused: studentSummaries.reduce((acc, s) => acc + s.excused, 0),
  };

  const chartData = [
    { name: 'Present', value: totalStats.present, color: '#10B981' },
    { name: 'Absent', value: totalStats.absent, color: '#EF4444' },
    { name: 'Late', value: totalStats.late, color: '#F59E0B' },
    { name: 'Excused', value: totalStats.excused, color: '#3B82F6' },
  ].filter(d => d.value > 0);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <Letterhead />
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Attendance Intelligence</h1>
          <p className="text-slate-500 mt-1 font-medium">Detailed trends and student performance analysis.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
          <button 
            onClick={() => setViewMode('summary')}
            className={cn(
              "px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all",
              viewMode === 'summary' ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <LayoutDashboard size={14} /> Summary
          </button>
          <button 
            onClick={() => setViewMode('logs')}
            className={cn(
              "px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all",
              viewMode === 'logs' ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <History size={14} /> Raw Logs
          </button>
        </div>
      </header>

      {feedback && (
        <div className={cn(
          "fixed top-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-xl z-50 flex items-center gap-3 animate-in fade-in slide-in-from-top-4",
          feedback.type === 'success' ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
        )}>
          {feedback.type === 'success' ? <TrendingUp size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm font-bold uppercase tracking-wider">{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Filters & Summary */}
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-6 gap-6 items-end">
            {error && (
              <div className="md:col-span-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-4">
                <AlertCircle className="text-red-500 shrink-0" size={24} />
                <div>
                  <p className="text-red-900 font-bold text-sm">Action Required</p>
                  <p className="text-red-700 text-xs">{error}</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Subject</label>
              <select 
                value={selectedSubject} 
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              >
                <option value="">All Subjects</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Grade</label>
              <select 
                value={selectedGrade} 
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              >
                <option value="">All Grades</option>
                {currentGrades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">From</label>
              <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">To</label>
              <input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>

            <div className="relative">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Search</label>
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Student..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 pl-10 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              </div>
            </div>

            <button 
              onClick={() => {
                setSelectedGrade('');
                setSelectedSubject('');
                setStartDate('');
                setEndDate('');
                setSearchTerm('');
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all h-[44px]"
            >
              Reset
            </button>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-900 text-lg flex items-center gap-3">
                {viewMode === 'summary' ? (
                  <>
                    <BarChart3 className="text-primary" size={24} />
                    Class Performance Breakdown
                  </>
                ) : (
                  <>
                    <History className="text-primary" size={24} />
                    Raw Attendance Logs
                  </>
                )}
              </h3>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Showing {viewMode === 'summary' ? studentSummaries.length : attendance.length} Items
              </p>
            </div>

            <div className="overflow-x-auto relative min-h-[400px]">
              {loading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-20 flex flex-col items-center justify-center">
                  <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Refreshing Data...</p>
                </div>
              )}
              
              {viewMode === 'summary' ? (
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Student</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Sessions</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Presence</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {studentSummaries.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center font-black",
                              s.percentage < 80 ? 'bg-red-500 text-white' : 'bg-primary text-white'
                            )}>
                              {s.present}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{s.name}</p>
                              <p className="text-[10px] font-black text-slate-400 uppercase">{s.admission_number}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-center">
                          <span className="text-sm font-bold text-slate-600">{s.total} Classes</span>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex flex-col items-center gap-1.5">
                            <div className="w-full max-w-[120px] h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full transition-all duration-1000",
                                  s.percentage >= 95 ? 'bg-emerald-500' :
                                  s.percentage >= 80 ? 'bg-primary' : 'bg-red-500'
                                )}
                                style={{ width: `${s.percentage}%` }}
                              ></div>
                            </div>
                            <span className={cn(
                              "text-xs font-black",
                              s.percentage < 80 ? 'text-red-500' : 'text-slate-900'
                            )}>
                              {s.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          {s.percentage < 80 ? (
                            <div className="flex items-center gap-2 text-red-500 bg-red-50 px-3 py-1.5 rounded-xl w-fit">
                              <TrendingDown size={14} />
                              <span className="text-[10px] font-black uppercase tracking-widest italic">Action Required</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-emerald-500 bg-emerald-50 px-3 py-1.5 rounded-xl w-fit">
                              <TrendingUp size={14} />
                              <span className="text-[10px] font-black uppercase tracking-widest italic">Engaged</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Date/Student</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Context</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {attendance.filter(r => 
                      r.student_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      r.admission_number.toLowerCase().includes(searchTerm.toLowerCase())
                    ).map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                          <p className="font-bold text-slate-900 mt-1">{r.student_name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-600">{r.subject_name}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase">{r.grade_name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className={cn(
                            "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5",
                            r.status === 'present' ? 'bg-emerald-50 text-emerald-600' :
                            r.status === 'absent' ? 'bg-red-50 text-red-600' :
                            r.status === 'late' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                          )}>
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              r.status === 'present' ? 'bg-emerald-600' :
                              r.status === 'absent' ? 'bg-red-600' :
                              r.status === 'late' ? 'bg-amber-600' : 'bg-blue-600'
                            )}></div>
                            {r.status}
                          </div>
                          {r.remarks && <p className="text-[10px] text-slate-400 mt-1 truncate max-w-[150px]">"{r.remarks}"</p>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setEditingRecord(r)}
                              className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                            >
                              <Edit size={18} />
                            </button>
                            <button 
                              onClick={() => setDeletingId(r.id)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              
              {((viewMode === 'summary' && studentSummaries.length === 0) || (viewMode === 'logs' && attendance.length === 0)) && (
                <div className="p-20 text-center">
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No records found for current filters</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
            <h4 className="text-sm font-black uppercase text-slate-400 tracking-widest mb-6">Distribution Overview</h4>
            <div className="w-full h-48">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                  <BarChart3 size={40} className="mb-2 opacity-50" />
                  <p className="text-[10px] font-bold uppercase">No data</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 w-full mt-6">
              {chartData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                  <span className="text-[10px] font-black uppercase text-slate-500">{d.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-red-50 p-8 rounded-3xl border border-red-100 flex items-start gap-4">
            <AlertCircle className="text-red-500 shrink-0" size={24} />
            <div>
              <h4 className="text-sm font-black text-red-900 uppercase tracking-widest">Compliance Alert</h4>
              <p className="text-xs font-medium text-red-700 mt-2 leading-relaxed">
                {studentSummaries.filter(s => s.percentage < 80).length} students are currently below the required 80% threshold. Automated parents notification is recommended.
              </p>
            </div>
          </div>

          <div className="bg-primary p-8 rounded-3xl text-white shadow-xl shadow-primary/20 group cursor-default overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 bg-white/10 rounded-full group-hover:scale-125 transition-transform duration-700"></div>
            <h4 className="font-display font-bold text-xl mb-2 relative z-10">Export Data</h4>
            <p className="text-white/60 text-xs font-medium relative z-10">Generate a professional PDF report for the current selection.</p>
            <button className="mt-8 bg-accent text-primary px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-transform shadow-lg relative z-10">
              Download CSV <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-display font-bold text-slate-900">Edit Attendance</h3>
                <p className="text-slate-500 text-sm font-medium mt-1">Manual adjustment for student record.</p>
              </div>
              <button onClick={() => setEditingRecord(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={24} className="text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleUpdate} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Student</label>
                  <div className="bg-slate-50 px-4 py-3 rounded-xl">
                    <p className="text-sm font-bold text-slate-600">{editingRecord.student_name}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Date</label>
                  <div className="bg-slate-50 px-4 py-3 rounded-xl">
                    <p className="text-sm font-bold text-slate-600">{new Date(editingRecord.date).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['present', 'absent', 'late', 'excused'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditingRecord({...editingRecord, status: s})}
                      className={cn(
                        "px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest border-2 transition-all",
                        editingRecord.status === s 
                          ? s === 'present' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' :
                            s === 'absent' ? 'border-red-500 bg-red-50 text-red-600' :
                            s === 'late' ? 'border-amber-50 bg-amber-50 text-amber-600' : 'border-blue-500 bg-blue-50 text-blue-600'
                          : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Remarks</label>
                <textarea
                  value={editingRecord.remarks || ''}
                  onChange={(e) => setEditingRecord({...editingRecord, remarks: e.target.value})}
                  placeholder="Optional notes or reason..."
                  rows={3}
                  className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="flex-1 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 px-8 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="text-red-500" size={32} />
              </div>
              <h3 className="text-xl font-display font-bold text-slate-900">Delete Record?</h3>
              <p className="text-slate-500 text-sm font-medium mt-2">
                Are you sure you want to delete this attendance record? This action cannot be undone.
              </p>
              
              <div className="flex flex-col gap-3 mt-8">
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="w-full px-8 py-4 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {actionLoading ? 'Deleting...' : 'Yes, Delete Record'}
                </button>
                <button
                  onClick={() => setDeletingId(null)}
                  className="w-full px-8 py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceReport;
