import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAuth } from '../useAuth';
import { useData } from '../hooks/useData';

/* ─── Google Fonts ─────────────────────────────────────────────────────────── */
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Outfit:wght@300;400;500;600;700;800&display=swap');`;

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface School { id: string; name: string; logo_url?: string; motto?: string; address?: string; phone?: string; email?: string; website?: string; primary_color?: string; }
interface Grade { id: string; grade_name: string; school_id: string; }
interface Subject { id: string; subject_name: string; subject_code: string; school_id: string; }
interface Exam { id: string; exam_name: string; term: string; year: number; school_id: string; grade_id: string; is_school_wide: boolean; }
interface Student { id: string; name: string; admission_number: string; gender: string; grade_id: string; school_id: string; }
interface Result { student_id: string; subject_id: string; marks: number; term: string; year: number; school_id: string; }
interface AttendanceRecord { id: string; school_id: string; student_id: string; grade_id: string; date: string; status: string; }
interface Teacher { id: string; name: string; email?: string; school_id: string; subject_id?: string; }

/* ─── Tabs ──────────────────────────────────────────────────────────────────── */
const MAIN_TABS = ['Analytics', 'Reports'] as const;
const ANALYTICS_TABS = ['Overview', 'Academic', 'Attendance', 'Enrollment', 'Teachers'] as const;
const REPORT_TYPES = ['Report Cards', 'Class Analysis', 'Attendance Report', 'Rankings', 'Subject Report', 'Teacher Report'] as const;
type MainTab = typeof MAIN_TABS[number];
type AnalyticsTab = typeof ANALYTICS_TABS[number];
type ReportType = typeof REPORT_TYPES[number];

/* ─── Color palette ─────────────────────────────────────────────────────────── */
const PALETTE = {
  indigo: '#6366f1', violet: '#8b5cf6', cyan: '#06b6d4', emerald: '#10b981',
  amber: '#f59e0b', rose: '#f43f5e', sky: '#0ea5e9', teal: '#14b8a6',
  fuchsia: '#d946ef', lime: '#84cc16',
};
const CHART_COLORS = Object.values(PALETTE);

/* ─── Grade helpers ─────────────────────────────────────────────────────────── */
const gradeFromMarks = (m: number) => {
  if (m >= 80) return { letter: 'A', label: 'Excellent', color: PALETTE.emerald, bg: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' };
  if (m >= 70) return { letter: 'B', label: 'Good', color: PALETTE.cyan, bg: 'bg-cyan-500/10 text-cyan-400 ring-cyan-500/20' };
  if (m >= 60) return { letter: 'C', label: 'Average', color: PALETTE.amber, bg: 'bg-amber-500/10 text-amber-400 ring-amber-500/20' };
  if (m >= 50) return { letter: 'D', label: 'Below Avg', color: '#f97316', bg: 'bg-orange-500/10 text-orange-400 ring-orange-500/20' };
  return { letter: 'E', label: 'Fail', color: PALETTE.rose, bg: 'bg-rose-500/10 text-rose-400 ring-rose-500/20' };
};
const remark = (avg: number) => {
  if (avg >= 80) return 'Outstanding performance. Student demonstrates exceptional mastery of all subjects.';
  if (avg >= 65) return 'Commendable performance. Student is meeting curriculum expectations consistently.';
  if (avg >= 50) return 'Satisfactory progress. Student should focus on improving weak areas.';
  return 'Needs significant improvement. Parental guidance and remedial support recommended.';
};

/* ─── PDF Letterhead ─────────────────────────────────────────────────────────── */
async function toDataURL(url: string): Promise<{ data: string; fmt: 'PNG' | 'JPEG' } | null> {
  try {
    const r = await fetch(url, { mode: 'cors' });
    if (!r.ok) return null;
    const b = await r.blob();
    const fmt: 'PNG' | 'JPEG' = b.type.includes('png') ? 'PNG' : 'JPEG';
    const data: string = await new Promise((res, rej) => {
      const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(b);
    });
    return { data, fmt };
  } catch { return null; }
}

function pdfHeader(doc: jsPDF, school: School | undefined, logo: { data: string; fmt: 'PNG' | 'JPEG' } | null, title: string) {
  const W = doc.internal.pageSize.width;
  const accent: [number, number, number] = school?.primary_color
    ? [parseInt(school.primary_color.slice(1, 3), 16), parseInt(school.primary_color.slice(3, 5), 16), parseInt(school.primary_color.slice(5, 7), 16)]
    : [99, 102, 241];

  doc.setFillColor(10, 14, 26);
  doc.rect(0, 0, W, 52, 'F');
  doc.setFillColor(...accent);
  doc.rect(0, 52, W, 3, 'F');

  if (logo) { try { doc.addImage(logo.data, logo.fmt, 10, 8, 34, 34); } catch { /* noop */ } }
  else {
    doc.setFillColor(...accent);
    doc.roundedRect(10, 8, 34, 34, 4, 4, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text((school?.name || 'S')[0].toUpperCase(), 27, 30, { align: 'center' });
  }

  doc.setTextColor(255, 255, 255); doc.setFontSize(17); doc.setFont('helvetica', 'bold');
  doc.text((school?.name || 'School').toUpperCase(), W / 2, 16, { align: 'center' });
  if (school?.motto) { doc.setTextColor(200, 210, 240); doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.text(`"${school.motto}"`, W / 2, 22, { align: 'center' }); }
  const contacts = [school?.address, school?.phone, school?.email, school?.website].filter(Boolean).join('  •  ');
  if (contacts) { doc.setTextColor(150, 165, 200); doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.text(contacts, W / 2, 28, { align: 'center' }); }
  doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), W / 2, 44, { align: 'center' });
}

function pdfFooter(doc: jsPDF, school: School | undefined) {
  const W = doc.internal.pageSize.width, H = doc.internal.pageSize.height;
  doc.setDrawColor(80, 90, 120); doc.setLineWidth(0.4); doc.line(12, H - 16, W - 12, H - 16);
  doc.setTextColor(130, 140, 170); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.text(`${school?.name || ''} • Powered by EduNexa Analytics`, 12, H - 10);
  doc.text(new Date().toLocaleDateString('en-KE', { dateStyle: 'long' }), W - 12, H - 10, { align: 'right' });
}

/* ─── Primitives ─────────────────────────────────────────────────────────────── */
const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-700/40 rounded-xl ${className}`} />
);

const GlassPanel = ({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <div
    onClick={onClick}
    className={`relative rounded-2xl border border-white/8 bg-white/3 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${onClick ? 'cursor-pointer' : ''} ${className}`}
  >
    {children}
  </div>
);

const Chip = ({ children, color = 'indigo' }: { children: React.ReactNode; color?: string }) => (
  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ring-1 ring-inset"
    style={{ background: `${color}15`, color, ringColor: `${color}30` }}>
    {children}
  </span>
);

interface KPIProps { label: string; value: string | number; sub?: string; delta?: number; accent: string; icon: string; loading?: boolean; }
const KPI: React.FC<KPIProps> = ({ label, value, sub, delta, accent, icon, loading }) => (
  <GlassPanel className="p-5 overflow-hidden">
    <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
    <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-3xl opacity-20" style={{ background: accent }} />
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold tracking-[0.15em] text-slate-400 uppercase">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      {loading ? <Skeleton className="h-9 w-28 mb-1" /> : (
        <div className="text-[2rem] font-bold leading-none text-white" style={{ fontFamily: "'DM Serif Display', serif" }}>{value}</div>
      )}
      {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
      {delta !== undefined && !loading && (
        <div className={`flex items-center gap-1 text-[11px] font-semibold mt-2 ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}% vs last term
        </div>
      )}
    </div>
  </GlassPanel>
);

const CustomTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur px-3 py-2.5 shadow-2xl text-xs">
      <div className="font-semibold text-slate-200 mb-1.5">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-semibold text-white">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

const SectionHeading = ({ title, action }: { title: string; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-3">
      <div className="w-1 h-5 rounded-full bg-gradient-to-b from-indigo-400 to-violet-500" />
      <h3 className="text-sm font-semibold text-slate-200 tracking-tight">{title}</h3>
    </div>
    {action}
  </div>
);

const FilterBar = ({ year, setYear, term, setTerm, gradeId, setGradeId, grades, yearOptions }: any) => (
  <div className="flex flex-wrap gap-2">
    {[
      { val: year, set: setYear, opts: yearOptions.map((y: string) => ({ v: y, l: y })), ph: 'Year' },
      { val: term, set: setTerm, opts: [{ v: '', l: 'All Terms' }, { v: 'Term 1', l: 'Term 1' }, { v: 'Term 2', l: 'Term 2' }, { v: 'Term 3', l: 'Term 3' }], ph: 'Term' },
      { val: gradeId, set: setGradeId, opts: [{ v: '', l: 'All Grades' }, ...grades.map((g: Grade) => ({ v: g.id, l: g.grade_name }))], ph: 'Grade' },
    ].map(f => (
      <select key={f.ph} value={f.val} onChange={e => f.set(e.target.value)}
        className="text-xs bg-slate-800/60 border border-white/8 text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 cursor-pointer hover:border-white/20 transition-colors">
        {f.opts.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    ))}
  </div>
);

/* ─── Report Preview Modal ───────────────────────────────────────────────────── */
const Modal = ({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) => (
  <AnimatePresence>
    {open && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}>
        <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
          className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
          onClick={e => e.stopPropagation()}>
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/8 bg-slate-900/95 backdrop-blur">
            <h2 className="font-semibold text-slate-100" style={{ fontFamily: "'DM Serif Display', serif" }}>{title}</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors text-xl leading-none">×</button>
          </div>
          <div className="p-6">{children}</div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
export default function InsightsCenter() {
  const { user } = useAuth();
  const sid = user?.school_id;

  /* ── Global filters ── */
  const [mainTab, setMainTab] = useState<MainTab>('Analytics');
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('Overview');
  const [reportType, setReportType] = useState<ReportType>('Report Cards');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [term, setTerm] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ open: boolean; title: string; content: React.ReactNode }>({ open: false, title: '', content: null });
  const PAGE_SIZE = 20;

  const yearOptions = useMemo(() => { const y = new Date().getFullYear(); return [y, y - 1, y - 2, y - 3].map(String); }, []);

  /* ── Data queries — all scoped by school_id ── */
  const { data: schools = [], loading: schoolLoading } = useData<School>('ins-school', 'schools', { filters: { id: sid } }, !!sid, 600000);
  const school = schools[0];

  const { data: grades = [], loading: gradesLoading } = useData<Grade>('ins-grades', 'grades', { filters: { school_id: sid } }, !!sid, 300000);
  const { data: subjects = [] } = useData<Subject>('ins-subjects', 'subjects', { filters: { school_id: sid } }, !!sid, 300000);
  const { data: teachers = [] } = useData<Teacher>('ins-teachers', 'teachers', { filters: { school_id: sid } }, !!sid, 300000);

  const studentFilters: any = { school_id: sid };
  if (gradeId) studentFilters.grade_id = gradeId;
  const { data: students = [], loading: studentsLoading } = useData<Student>('ins-students', 'students', { filters: studentFilters }, !!sid, 120000);

  const resultFilters: any = { school_id: sid, year: Number(year) };
  if (term) resultFilters.term = term;
  const { data: results = [], loading: resultsLoading } = useData<Result>('ins-results', 'results', { filters: resultFilters }, !!sid, 60000);

  const attFilters: any = { school_id: sid };
  const { data: attendance = [], loading: attLoading } = useData<AttendanceRecord>('ins-att', 'attendance', { filters: attFilters }, !!sid, 120000);

  /* ── Derived analytics ── */
  const filteredResults = useMemo(() => {
    let r = results;
    if (gradeId) { const ids = new Set(students.map(s => s.id)); r = r.filter(x => ids.has(x.student_id)); }
    return r;
  }, [results, gradeId, students]);

  const filteredStudents = useMemo(() =>
    gradeId ? students.filter(s => s.grade_id === gradeId) : students,
    [students, gradeId]);

  const kpis = useMemo(() => {
    const avg = filteredResults.length ? filteredResults.reduce((a, b) => a + b.marks, 0) / filteredResults.length : 0;
    const pass = filteredResults.length ? filteredResults.filter(r => r.marks >= 50).length / filteredResults.length * 100 : 0;
    const attRecords = attendance.filter(a => {
      const d = new Date(a.date); return d.getFullYear() === Number(year);
    });
    const attRate = attRecords.length ? attRecords.filter(a => a.status === 'present').length / attRecords.length * 100 : 0;
    return { avg: Math.round(avg * 10) / 10, pass: Math.round(pass), attRate: Math.round(attRate * 10) / 10 };
  }, [filteredResults, attendance, year]);

  const genderDist = useMemo(() => {
    const m = students.filter(s => s.gender?.toLowerCase() === 'male').length;
    const f = students.filter(s => s.gender?.toLowerCase() === 'female').length;
    return [{ name: 'Male', value: m, fill: PALETTE.indigo }, { name: 'Female', value: f, fill: PALETTE.fuchsia }];
  }, [students]);

  const subjectAverages = useMemo(() =>
    subjects.map(subj => {
      const sr = filteredResults.filter(r => r.subject_id === subj.id);
      const avg = sr.length ? sr.reduce((a, b) => a + b.marks, 0) / sr.length : 0;
      return { name: subj.subject_code || subj.subject_name, full: subj.subject_name, avg: Math.round(avg * 10) / 10, count: sr.length };
    }).filter(s => s.count > 0).sort((a, b) => b.avg - a.avg),
    [filteredResults, subjects]);

  const gradeDistribution = useMemo(() => {
    const d = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    filteredResults.forEach(r => { d[gradeFromMarks(r.marks).letter as keyof typeof d]++; });
    return [
      { name: 'A (80+)', value: d.A, fill: PALETTE.emerald },
      { name: 'B (70-79)', value: d.B, fill: PALETTE.cyan },
      { name: 'C (60-69)', value: d.C, fill: PALETTE.amber },
      { name: 'D (50-59)', value: d.D, fill: '#f97316' },
      { name: 'E (<50)', value: d.E, fill: PALETTE.rose },
    ];
  }, [filteredResults]);

  const enrollmentTrend = useMemo(() =>
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => ({
      month: m,
      students: Math.max(0, students.length - (11 - i) * Math.floor(students.length * 0.02)),
    })),
    [students.length]);

  const termTrend = useMemo(() => ['Term 1', 'Term 2', 'Term 3'].map(t => {
    const tr = results.filter(r => r.term === t);
    const avg = tr.length ? tr.reduce((a, b) => a + b.marks, 0) / tr.length : 0;
    return { term: t, avg: Math.round(avg * 10) / 10 };
  }), [results]);

  const attTrend = useMemo(() => {
    const byDate: Record<string, { present: number; total: number }> = {};
    attendance.forEach(a => {
      if (!byDate[a.date]) byDate[a.date] = { present: 0, total: 0 };
      byDate[a.date].total++;
      if (a.status === 'present') byDate[a.date].present++;
    });
    return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([date, v]) => ({
      date: new Date(date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }),
      rate: Math.round(v.present / v.total * 100),
    }));
  }, [attendance]);

  const gradeBreakdown = useMemo(() =>
    grades.map(g => {
      const gStudents = students.filter(s => s.grade_id === g.id);
      const gResults = results.filter(r => gStudents.some(s => s.id === r.student_id));
      const avg = gResults.length ? gResults.reduce((a, b) => a + b.marks, 0) / gResults.length : 0;
      const att = attendance.filter(a => a.grade_id === g.id && new Date(a.date).getFullYear() === Number(year));
      const attRate = att.length ? att.filter(a => a.status === 'present').length / att.length * 100 : 0;
      return { name: g.grade_name, students: gStudents.length, avg: Math.round(avg * 10) / 10, attRate: Math.round(attRate), id: g.id };
    }).filter(g => g.students > 0),
    [grades, students, results, attendance, year]);

  const studentRankings = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filteredResults.forEach(r => {
      if (!map[r.student_id]) map[r.student_id] = { total: 0, count: 0 };
      map[r.student_id].total += r.marks; map[r.student_id].count++;
    });
    return filteredStudents.map(s => {
      const d = map[s.id]; const avg = d ? d.total / d.count : 0;
      return { ...s, avg: Math.round(avg * 10) / 10, total: d?.total || 0, subjectCount: d?.count || 0 };
    }).filter(s => s.subjectCount > 0).sort((a, b) => b.avg - a.avg).map((s, i) => ({ ...s, rank: i + 1 }));
  }, [filteredResults, filteredStudents]);

  /* ── Filtered + paginated table data ── */
      autoTable(doc, {
      startY: y2 + 4, head: [['Grade', 'Students']],
      body: gradeDistribution.map(d => [d.name, d.value]),
      theme: 'striped', styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [10, 14, 26], textColor: [99, 102, 241], fontStyle: 'bold' },
      tableWidth: 80,
    });

    pdfFooter(doc, school);
    doc.save(`ClassAnalysis_${gName}_${year}.pdf`);
  }, [school, logo, grades, gradeId, year, term, kpis, subjectAverages, gradeDistribution]);

  /* ── Excel Export ── */
  const exportExcel = useCallback((type: string) => {
    let data: any[] = []; let name = type;
    if (type === 'Rankings') data = studentRankings.map(s => ({ Rank: s.rank, Name: s.name, Adm: s.admission_number, Gender: s.gender, Average: s.avg, Total: s.total, Subjects: s.subjectCount }));
    else if (type === 'Subjects') data = subjectAverages.map(s => ({ Subject: s.full, Code: s.name, Average: s.avg, Entries: s.count, Grade: gradeFromMarks(s.avg).letter }));
    else if (type === 'Attendance') data = filteredStudents.map(s => {
      const sa = attendance.filter(a => a.student_id === s.id && new Date(a.date).getFullYear() === Number(year));
      return { Name: s.name, Adm: s.admission_number, Sessions: sa.length, Present: sa.filter(a => a.status === 'present').length, Absent: sa.filter(a => a.status === 'absent').length, Rate: `${sa.length ? Math.round(sa.filter(a => a.status === 'present').length / sa.length * 100) : 0}%` };
    });
    else data = filteredStudents.map(s => {
      const row: any = { Name: s.name, Adm: s.admission_number, Gender: s.gender };
      subjects.forEach(sub => {
        const r = filteredResults.find(r => r.student_id === s.id && r.subject_id === sub.id);
        row[sub.subject_code || sub.subject_name] = r?.marks ?? '-';
      });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, name);
    XLSX.writeFile(wb, `${(school?.name || 'EduNexa').replace(/\s+/g, '_')}_${name}_${year}.xlsx`);
  }, [studentRankings, subjectAverages, filteredStudents, attendance, subjects, filteredResults, year, school]);

  /* ── Report Card Modal Preview ── */
  const showReportCard = (student: any) => {
    const sData = subjects.map(subj => {
      const res = filteredResults.find(r => r.student_id === student.id && r.subject_id === subj.id);
      return { ...subj, marks: res?.marks ?? null };
    }).filter(s => s.marks !== null);
    const avg = sData.length ? sData.reduce((a, b) => a + (b.marks || 0), 0) / sData.length : 0;
    const sa = attendance.filter(a => a.student_id === student.id && new Date(a.date).getFullYear() === Number(year));
    const attRate = sa.length ? Math.round(sa.filter(a => a.status === 'present').length / sa.length * 100) : 0;

    setModal({
      open: true, title: `${student.name} — Report Card`,
      content: (
        <div className="space-y-5 text-sm">
          {/* Student header */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-800/60 border border-white/8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg">
              {student.name?.[0]}
            </div>
            <div>
              <div className="font-bold text-slate-100 text-base">{student.name}</div>
              <div className="text-xs text-slate-400 mt-0.5">{student.admission_number} · {student.gender} · {grades.find(g => g.id === student.grade_id)?.grade_name}</div>
              <div className="text-xs text-slate-500 mt-0.5">{year} · {term || 'All Terms'} · Rank #{student.rank || '-'}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-2xl font-bold" style={{ color: gradeFromMarks(avg).color }}>{avg.toFixed(1)}%</div>
              <div className={`text-xs font-bold px-2 py-0.5 rounded-full ring-1 ring-inset mt-1 ${gradeFromMarks(avg).bg}`}>Grade {gradeFromMarks(avg).letter}</div>
            </div>
          </div>

          {/* Subjects table */}
          <div className="overflow-x-auto rounded-xl border border-white/8">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/8 bg-slate-800/40 text-slate-400 uppercase tracking-wider text-[10px]">
                  {['Subject', 'Code', 'Marks', 'Grade', 'Status'].map(h => <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {sData.map(r => {
                  const g = gradeFromMarks(r.marks!);
                  return (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/3">
                      <td className="px-3 py-2.5 text-slate-200">{r.subject_name}</td>
                      <td className="px-3 py-2.5 text-slate-400 font-mono">{r.subject_code}</td>
                      <td className="px-3 py-2.5 font-bold text-white">{r.marks}</td>
                      <td className="px-3 py-2.5"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ring-1 ring-inset ${g.bg}`}>{g.letter}</span></td>
                      <td className="px-3 py-2.5"><span className={`text-[10px] font-semibold ${(r.marks || 0) >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>{(r.marks || 0) >= 50 ? 'Pass' : 'Fail'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Attendance */}
          <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-800/40 border border-white/8 text-xs">
            <span className="text-slate-400">Attendance:</span>
            <span className="font-bold text-white">{attRate}%</span>
            <span className="text-slate-500">({sa.filter(a => a.status === 'present').length} of {sa.length} sessions)</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={() => genReportCard({ ...student, rank: studentRankings.find(r => r.id === student.id)?.rank })}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors">
              Download PDF
            </button>
          </div>
        </div>
      ),
    });
  };

  /* ─── RENDER ──────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen text-slate-100" style={{ fontFamily: "'Outfit', sans-serif", background: 'radial-gradient(ellipse at 20% 0%, #1a1040 0%, #0a0e1a 50%, #060b18 100%)' }}>
      <style>{FONT_IMPORT}</style>

      {/* Ambient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-0">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-[120px] opacity-20" style={{ background: PALETTE.indigo }} />
        <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] rounded-full blur-[100px] opacity-15" style={{ background: PALETTE.violet }} />
        <div className="absolute -bottom-40 left-1/3 w-[400px] h-[400px] rounded-full blur-[120px] opacity-10" style={{ background: PALETTE.cyan }} />
      </div>

      <div className="relative z-10 max-w-[1500px] mx-auto p-4 md:p-6 space-y-5">

        {/* ── Page Header ── */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(to bottom, ${PALETTE.indigo}, ${PALETTE.violet})` }} />
              <span className="text-[10px] font-semibold tracking-[0.2em] text-indigo-400 uppercase">Intelligence Platform</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white leading-none" style={{ fontFamily: "'DM Serif Display', serif" }}>
              Insights Center
            </h1>
            <p className="text-sm text-slate-400 mt-1.5">
              {schoolLoading ? '...' : school?.name} <span className="text-slate-600 mx-1">·</span> Real-time academic intelligence
            </p>
          </div>
          <div className="flex items-center gap-3">
            <FilterBar year={year} setYear={setYear} term={term} setTerm={setTerm} gradeId={gradeId} setGradeId={setGradeId} grades={grades} yearOptions={yearOptions} />
          </div>
        </motion.div>

        {/* ── Main Tab Bar ── */}
        <div className="flex gap-1 p-1 rounded-2xl bg-white/4 border border-white/8 w-fit">
          {MAIN_TABS.map(t => (
            <button key={t} onClick={() => setMainTab(t)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${mainTab === t ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:text-slate-200'}`}>
              {t}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={mainTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>

            {/* ════════════════ ANALYTICS ════════════════ */}
            {mainTab === 'Analytics' && (
              <div className="space-y-5">
                {/* Analytics sub-tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {ANALYTICS_TABS.map(t => (
                    <button key={t} onClick={() => setAnalyticsTab(t)}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${analyticsTab === t ? 'bg-white/10 border-indigo-500/60 text-indigo-300' : 'border-white/8 text-slate-500 hover:text-slate-300 hover:border-white/15'}`}>
                      {t}
                    </button>
                  ))}
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  <KPI label="Total Students" value={students.length} sub={`${grades.length} classes`} accent={PALETTE.indigo} icon="👥" loading={studentsLoading} />
                  <KPI label="Mean Score" value={`${kpis.avg}%`} sub="Current filters" delta={2.4} accent={PALETTE.emerald} icon="📊" loading={resultsLoading} />
                  <KPI label="Pass Rate" value={`${kpis.pass}%`} sub="≥50 marks" accent={PALETTE.cyan} icon="✅" loading={resultsLoading} />
                  <KPI label="Attendance" value={`${kpis.attRate}%`} sub="Annual rate" accent={PALETTE.amber} icon="📅" loading={attLoading} />
                  <KPI label="Teachers" value={teachers.length} sub={`${subjects.length} subjects`} accent={PALETTE.violet} icon="🎓" />
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={analyticsTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>

                    {/* OVERVIEW */}
                    {analyticsTab === 'Overview' && (
                      <div className="space-y-5">
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {/* Grade distribution pie */}
                          <GlassPanel className="p-5">
                            <SectionHeading title="Grade Distribution" />
                            <ResponsiveContainer width="100%" height={220}>
                              <PieChart>
                                <Pie data={gradeDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                                  {gradeDistribution.map((d, i) => <Cell key={i} fill={d.fill} />)}
                                </Pie>
                                <Tooltip content={<CustomTip />} />
                                <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-[11px] text-slate-400">{v}</span>} />
                              </PieChart>
                            </ResponsiveContainer>
                          </GlassPanel>

                          {/* Gender distribution */}
                          <GlassPanel className="p-5">
                            <SectionHeading title="Gender Distribution" />
                            <div className="flex items-center justify-center h-[220px]">
                              <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                  <Pie data={genderDist} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value">
                                    {genderDist.map((d, i) => <Cell key={i} fill={d.fill} />)}
                                  </Pie>
                                  <Tooltip content={<CustomTip />} />
                                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-[11px] text-slate-400">{v}</span>} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          </GlassPanel>

                          {/* Term trend */}
                          <GlassPanel className="p-5">
                            <SectionHeading title="Term Average Trend" />
                            <ResponsiveContainer width="100%" height={220}>
                              <AreaChart data={termTrend}>
                                <defs>
                                  <linearGradient id="termGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={PALETTE.indigo} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={PALETTE.indigo} stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e2640" />
                                <XAxis dataKey="term" stroke="#4b5680" fontSize={11} />
                                <YAxis stroke="#4b5680" fontSize={11} />
                                <Tooltip content={<CustomTip />} />
                                <Area type="monotone" dataKey="avg" name="Average" stroke={PALETTE.indigo} fill="url(#termGrad)" strokeWidth={2.5} dot={{ fill: PALETTE.indigo, r: 4 }} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </GlassPanel>
                        </div>

                        {/* Class breakdown table */}
                        <GlassPanel className="p-5">
                          <SectionHeading title="Class Performance Overview" />
                          {gradesLoading ? <Skeleton className="h-40" /> : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left border-b border-white/8 text-[11px] uppercase tracking-wider text-slate-500">
                                    {['Class', 'Students', 'Mean Score', 'Grade', 'Attendance', 'Performance'].map(h => <th key={h} className="py-2.5 px-3 font-semibold">{h}</th>)}
                                  </tr>
                                </thead>
                                <tbody>
                                  {gradeBreakdown.map(g => (
                                    <tr key={g.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                                      <td className="py-3 px-3 font-semibold text-slate-100">{g.name}</td>
                                      <td className="py-3 px-3 text-slate-300">{g.students}</td>
                                      <td className="py-3 px-3 font-bold text-white">{g.avg}%</td>
                                      <td className="py-3 px-3">
                                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ring-1 ring-inset ${gradeFromMarks(g.avg).bg}`}>{gradeFromMarks(g.avg).letter}</span>
                                      </td>
                                      <td className="py-3 px-3 text-slate-300">{g.attRate}%</td>
                                      <td className="py-3 px-3 w-36">
                                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                          <div className="h-full rounded-full" style={{ width: `${Math.min(g.avg, 100)}%`, background: gradeFromMarks(g.avg).color }} />
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </GlassPanel>
                      </div>
                    )}

                    {/* ACADEMIC */}
                    {analyticsTab === 'Academic' && (
                      <div className="space-y-5">
                        <div className="grid md:grid-cols-2 gap-4">
                          <GlassPanel className="p-5">
                            <SectionHeading title="Subject Mean Scores" />
                            {resultsLoading ? <Skeleton className="h-64" /> : (
                              <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={subjectAverages} layout="vertical">
                                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2640" horizontal={false} />
                                  <XAxis type="number" domain={[0, 100]} stroke="#4b5680" fontSize={11} />
                                  <YAxis type="category" dataKey="name" stroke="#4b5680" fontSize={10} width={55} />
                                  <Tooltip content={<CustomTip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                  <Bar dataKey="avg" name="Average" radius={[0, 6, 6, 0]}>
                                    {subjectAverages.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                          </GlassPanel>

                          <GlassPanel className="p-5">
                            <SectionHeading title="Subject Radar" />
                            {subjectAverages.length > 0 ? (
                              <ResponsiveContainer width="100%" height={280}>
                                <RadarChart data={subjectAverages.slice(0, 8).map(s => ({ subject: s.name, avg: s.avg }))}>
                                  <PolarGrid stroke="#1e2640" />
                                  <PolarAngleAxis dataKey="subject" stroke="#4b5680" fontSize={10} />
                                  <PolarRadiusAxis stroke="#2a3050" fontSize={9} />
                                  <Radar dataKey="avg" stroke={PALETTE.indigo} fill={PALETTE.indigo} fillOpacity={0.2} />
                                  <Tooltip content={<CustomTip />} />
                                </RadarChart>
                              </ResponsiveContainer>
                            ) : <div className="h-64 flex items-center justify-center text-slate-500 text-sm">No data</div>}
                          </GlassPanel>
                        </div>

                        {/* Top performers */}
                        <GlassPanel className="p-5">
                          <SectionHeading title="Top 10 Students" action={<Chip color={PALETTE.indigo}>{studentRankings.length} ranked</Chip>} />
                          <div className="space-y-2">
                            {studentRankings.slice(0, 10).map((s, i) => (
                              <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/4 transition-colors cursor-pointer" onClick={() => showReportCard(s)}>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${i < 3 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white' : 'bg-white/8 text-slate-400'}`}>#{i + 1}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-slate-100 truncate">{s.name}</div>
                                  <div className="text-[11px] text-slate-500">{s.admission_number} · {grades.find(g => g.id === s.grade_id)?.grade_name}</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-white">{s.avg}%</div>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ring-1 ring-inset ${gradeFromMarks(s.avg).bg}`}>{gradeFromMarks(s.avg).letter}</span>
                                </div>
                                <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${s.avg}%`, background: gradeFromMarks(s.avg).color }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </GlassPanel>
                      </div>
                    )}

                    {/* ATTENDANCE */}
                    {analyticsTab === 'Attendance' && (
                      <div className="space-y-5">
                        <GlassPanel className="p-5">
                          <SectionHeading title="30-Day Attendance Rate" />
                          {attLoading ? <Skeleton className="h-56" /> : attTrend.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                              <AreaChart data={attTrend}>
                                <defs>
                                  <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={PALETTE.emerald} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={PALETTE.emerald} stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e2640" />
                                <XAxis dataKey="date" stroke="#4b5680" fontSize={9} interval="preserveStartEnd" />
                                <YAxis stroke="#4b5680" fontSize={11} domain={[0, 100]} unit="%" />
                                <Tooltip content={<CustomTip />} />
                                <Area type="monotone" dataKey="rate" name="Rate" stroke={PALETTE.emerald} fill="url(#attGrad)" strokeWidth={2} />
                              </AreaChart>
                            </ResponsiveContainer>
                          ) : <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No attendance data</div>}
                        </GlassPanel>

                        {/* Attendance by class */}
                        <GlassPanel className="p-5">
                          <SectionHeading title="Attendance by Class" />
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={gradeBreakdown}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e2640" />
                              <XAxis dataKey="name" stroke="#4b5680" fontSize={11} />
                              <YAxis stroke="#4b5680" fontSize={11} domain={[0, 100]} unit="%" />
                              <Tooltip content={<CustomTip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                              <Bar dataKey="attRate" name="Attendance Rate" radius={[6, 6, 0, 0]}>
                                {gradeBreakdown.map((d, i) => <Cell key={i} fill={d.attRate >= 80 ? PALETTE.emerald : d.attRate >= 60 ? PALETTE.amber : PALETTE.rose} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </GlassPanel>
                      </div>
                    )}

                    {/* ENROLLMENT */}
                    {analyticsTab === 'Enrollment' && (
                      <div className="space-y-5">
                        <GlassPanel className="p-5">
                          <SectionHeading title="Enrollment Trend (This Year)" action={<Chip color={PALETTE.cyan}>{students.length} total</Chip>} />
                          <ResponsiveContainer width="100%" height={260}>
                            <LineChart data={enrollmentTrend}>
                              <defs>
                                <linearGradient id="enrGrad" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor={PALETTE.cyan} />
                                  <stop offset="100%" stopColor={PALETTE.violet} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e2640" />
                              <XAxis dataKey="month" stroke="#4b5680" fontSize={11} />
                              <YAxis stroke="#4b5680" fontSize={11} />
                              <Tooltip content={<CustomTip />} />
                              <Line type="monotone" dataKey="students" name="Students" stroke={PALETTE.cyan} strokeWidth={2.5} dot={{ fill: PALETTE.cyan, r: 4 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </GlassPanel>

                        {/* By class */}
                        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {gradeBreakdown.map((g, i) => (
                            <GlassPanel key={g.id} className="p-4">
                              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{g.name}</div>
                              <div className="text-2xl font-bold text-white" style={{ fontFamily: "'DM Serif Display', serif" }}>{g.students}</div>
                              <div className="text-xs text-slate-500 mt-0.5">students enrolled</div>
                              <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.min((g.students / Math.max(...gradeBreakdown.map(x => x.students))) * 100, 100)}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                              </div>
                            </GlassPanel>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* TEACHERS */}
                    {analyticsTab === 'Teachers' && (
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <KPI label="Total Teachers" value={teachers.length} accent={PALETTE.violet} icon="👩‍🏫" />
                          <KPI label="Subjects" value={subjects.length} accent={PALETTE.cyan} icon="📚" />
                          <KPI label="Classes" value={grades.length} accent={PALETTE.emerald} icon="🏫" />
                          <KPI label="Avg Class Size" value={grades.length ? Math.round(students.length / grades.length) : 0} sub="students/class" accent={PALETTE.amber} icon="📐" />
                        </div>
                        <GlassPanel className="p-5">
                          <SectionHeading title="Teacher Directory" />
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left border-b border-white/8 text-[11px] uppercase tracking-wider text-slate-500">
                                  {['#', 'Name', 'Email', 'Subject'].map(h => <th key={h} className="py-2.5 px-3 font-semibold">{h}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {teachers.map((t, i) => (
                                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/3">
                                    <td className="py-3 px-3 text-slate-500">{i + 1}</td>
                                    <td className="py-3 px-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: `${CHART_COLORS[i % CHART_COLORS.length]}40`, border: `1px solid ${CHART_COLORS[i % CHART_COLORS.length]}40` }}>{t.name?.[0]}</div>
                                        <span className="font-medium text-slate-100">{t.name}</span>
                                      </div>
                                    </td>
                                    <td className="py-3 px-3 text-slate-400">{t.email || '—'}</td>
                                    <td className="py-3 px-3 text-slate-300">{subjects.find(s => s.id === t.subject_id)?.subject_name || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </GlassPanel>
                      </div>
                    )}

                  </motion.div>
                </AnimatePresence>
              </div>
            )}

            {/* ════════════════ REPORTS ════════════════ */}
            {mainTab === 'Reports' && (
              <div className="grid lg:grid-cols-[220px_1fr] gap-4">
                {/* Report type sidebar */}
                <div className="space-y-1">
                  {REPORT_TYPES.map(t => (
                    <button key={t} onClick={() => setReportType(t)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all ${reportType === t ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-white/4 border border-transparent'}`}>
                      {t}
                    </button>
                  ))}
                </div>

                {/* Report content */}
                <GlassPanel className="p-5">
                  {/* Toolbar */}
                  <div className="flex flex-col sm:flex-row gap-3 mb-5">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${reportType}…`}
                        className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors" />
                    </div>
                    <div className="flex gap-2">
                      {reportType === 'Report Cards' && (
                        <button onClick={() => exportExcel('Results')} className="px-3 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-xs font-semibold text-slate-300 transition-colors border border-white/8">Excel</button>
                      )}
                      {reportType === 'Rankings' && (
                        <>
                          <button onClick={() => exportExcel('Rankings')} className="px-3 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-xs font-semibold text-slate-300 transition-colors border border-white/8">Excel</button>
                        </>
                      )}
                      {reportType === 'Class Analysis' && (
                        <button onClick={genClassAnalysis} className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors">PDF</button>
                      )}
                      {reportType === 'Attendance Report' && (
                        <button onClick={() => exportExcel('Attendance')} className="px-3 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-xs font-semibold text-slate-300 transition-colors border border-white/8">Excel</button>
                      )}
                      {reportType === 'Subject Report' && (
                        <button onClick={() => exportExcel('Subjects')} className="px-3 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-xs font-semibold text-slate-300 transition-colors border border-white/8">Excel</button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs text-slate-500">{tableData.length} records{search ? ` matching "${search}"` : ''}</div>
                    <div className="text-xs text-slate-500">Page {page} of {totalPages || 1}</div>
                  </div>

                  {/* Tables per report type */}
                  <AnimatePresence mode="wait">
                    <motion.div key={reportType} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

                      {/* REPORT CARDS */}
                      {reportType === 'Report Cards' && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left border-b border-white/8 text-[11px] uppercase tracking-wider text-slate-500">
                                {['Student', 'Adm No', 'Gender', 'Class', 'Actions'].map(h => <th key={h} className="py-2.5 px-3 font-semibold">{h}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {pagedData.map((s: any) => (
                                <tr key={s.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                                  <td className="py-3 px-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br from-indigo-500 to-violet-600">{s.name?.[0]}</div>
                                      <span className="font-medium text-slate-100">{s.name}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-slate-400 font-mono text-xs">{s.admission_number}</td>
                                  <td className="py-3 px-3 text-slate-400">{s.gender}</td>
                                  <td className="py-3 px-3 text-slate-300">{grades.find(g => g.id === s.grade_id)?.grade_name || '—'}</td>
                                  <td className="py-3 px-3">
                                    <div className="flex gap-2">
                                      <button onClick={() => showReportCard(s)} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-semibold">View</button>
                                      <button onClick={() => genReportCard(s)} className="text-xs text-violet-400 hover:text-violet-300 transition-colors font-semibold">PDF</button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* RANKINGS */}
                      {reportType === 'Rankings' && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left border-b border-white/8 text-[11px] uppercase tracking-wider text-slate-500">
                                {['Rank', 'Student', 'Adm No', 'Gender', 'Class', 'Average', 'Grade', ''].map(h => <th key={h} className="py-2.5 px-3 font-semibold">{h}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {(pagedData as any[]).map((s: any) => {
                                const g = gradeFromMarks(s.avg);
                                const medalColors = ['text-amber-400', 'text-slate-300', 'text-orange-400'];
                                return (
                                  <tr key={s.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                                    <td className={`py-3 px-3 font-black ${s.rank <= 3 ? medalColors[s.rank - 1] : 'text-slate-500'}`}>#{s.rank}</td>
                                    <td className="py-3 px-3 font-medium text-slate-100">{s.name}</td>
                                    <td className="py-3 px-3 text-slate-400 font-mono text-xs">{s.admission_number}</td>
                                    <td className="py-3 px-3 text-slate-400">{s.gender}</td>
                                    <td className="py-3 px-3 text-slate-300">{grades.find(gr => gr.id === s.grade_id)?.grade_name || '—'}</td>
                                    <td className="py-3 px-3 font-bold text-white">{s.avg}%</td>
                                    <td className="py-3 px-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ring-1 ring-inset ${g.bg}`}>{g.letter}</span></td>
                                    <td className="py-3 px-3"><button onClick={() => showReportCard(s)} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">Report →</button></td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* CLASS ANALYSIS */}
                      {reportType === 'Class Analysis' && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left border-b border-white/8 text-[11px] uppercase tracking-wider text-slate-500">
                                {['Class', 'Students', 'Mean Score', 'Grade', 'Attendance', 'Performance'].map(h => <th key={h} className="py-2.5 px-3 font-semibold">{h}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {(pagedData as any[]).map(g => (
                                <tr key={g.id} className="border-b border-white/5 hover:bg-white/3">
                                  <td className="py-3 px-3 font-semibold text-slate-100">{g.name}</td>
                                  <td className="py-3 px-3 text-slate-300">{g.students}</td>
                                  <td className="py-3 px-3 font-bold text-white">{g.avg}%</td>
                                  <td className="py-3 px-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ring-1 ring-inset ${gradeFromMarks(g.avg).bg}`}>{gradeFromMarks(g.avg).letter}</span></td>
                                  <td className="py-3 px-3 text-slate-300">{g.attRate}%</td>
                                  <td className="py-3 px-3 w-36">
                                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                      <div className="h-full rounded-full" style={{ width: `${Math.min(g.avg, 100)}%`, background: gradeFromMarks(g.avg).color }} />
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* ATTENDANCE REPORT */}
                      {reportType === 'Attendance Report' && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left border-b border-white/8 text-[11px] uppercase tracking-wider text-slate-500">
                                {['Student', 'Adm No', 'Sessions', 'Present', 'Absent', 'Rate'].map(h => <th key={h} className="py-2.5 px-3 font-semibold">{h}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {(pagedData as any[]).map(s => (
                                <tr key={s.id} className="border-b border-white/5 hover:bg-white/3">
                                  <td className="py-3 px-3 font-medium text-slate-100">{s.name}</td>
                                  <td className="py-3 px-3 text-slate-400 font-mono text-xs">{s.admission_number}</td>
                                  <td className="py-3 px-3 text-slate-300">{s.sessions}</td>
                                  <td className="py-3 px-3 text-emerald-400 font-semibold">{s.present}</td>
                                  <td className="py-3 px-3 text-rose-400 font-semibold">{s.absent}</td>
                                  <td className="py-3 px-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${s.rate}%`, background: s.rate >= 80 ? PALETTE.emerald : s.rate >= 60 ? PALETTE.amber : PALETTE.rose }} />
                                      </div>
                                      <span className={`text-xs font-bold ${s.rate >= 80 ? 'text-emerald-400' : s.rate >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>{s.rate}%</span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* SUBJECT REPORT */}
                      {reportType === 'Subject Report' && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left border-b border-white/8 text-[11px] uppercase tracking-wider text-slate-500">
                                {['#', 'Subject', 'Code', 'Mean Score', 'Grade', 'Entries', 'Bar'].map(h => <th key={h} className="py-2.5 px-3 font-semibold">{h}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {(pagedData as any[]).map((s, i) => {
                                const g = gradeFromMarks(s.avg);
                                return (
                                  <tr key={s.name} className="border-b border-white/5 hover:bg-white/3">
                                    <td className="py-3 px-3 text-slate-500">{(page - 1) * PAGE_SIZE + i + 1}</td>
                                    <td className="py-3 px-3 font-medium text-slate-100">{s.full}</td>
                                    <td className="py-3 px-3 text-slate-400 font-mono text-xs">{s.name}</td>
                                    <td className="py-3 px-3 font-bold text-white">{s.avg}%</td>
                                    <td className="py-3 px-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ring-1 ring-inset ${g.bg}`}>{g.letter}</span></td>
                                    <td className="py-3 px-3 text-slate-400">{s.count}</td>
                                    <td className="py-3 px-3 w-32">
                                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${Math.min(s.avg, 100)}%`, background: g.color }} />
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* TEACHER REPORT */}
                      {reportType === 'Teacher Report' && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left border-b border-white/8 text-[11px] uppercase tracking-wider text-slate-500">
                                {['#', 'Teacher', 'Email', 'Subject', 'Subject Mean'].map(h => <th key={h} className="py-2.5 px-3 font-semibold">{h}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {teachers.filter(t => !search || t.name?.toLowerCase().includes(search.toLowerCase())).map((t, i) => {
                                const subj = subjects.find(s => s.id === t.subject_id);
                                const subjAvg = subj ? subjectAverages.find(sa => sa.full === subj.subject_name)?.avg ?? 0 : 0;
                                return (
                                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/3">
                                    <td className="py-3 px-3 text-slate-500">{i + 1}</td>
                                    <td className="py-3 px-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: `${CHART_COLORS[i % CHART_COLORS.length]}40`, border: `1px solid ${CHART_COLORS[i % CHART_COLORS.length]}40` }}>{t.name?.[0]}</div>
                                        <span className="font-medium text-slate-100">{t.name}</span>
                                      </div>
                                    </td>
                                    <td className="py-3 px-3 text-slate-400 text-xs">{t.email || '—'}</td>
                                    <td className="py-3 px-3 text-slate-300">{subj?.subject_name || '—'}</td>
                                    <td className="py-3 px-3">
                                      {subjAvg > 0 ? (
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-white">{subjAvg}%</span>
                                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ring-1 ring-inset ${gradeFromMarks(subjAvg).bg}`}>{gradeFromMarks(subjAvg).letter}</span>
                                        </div>
                                      ) : <span className="text-slate-600">No data</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                    </motion.div>
                  </AnimatePresence>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-5 pt-4 border-t border-white/8">
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/8 hover:bg-white/12 disabled:opacity-30 text-slate-300 transition-colors border border-white/8">← Prev</button>
                      <div className="flex gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const p = page <= 3 ? i + 1 : page + i - 2;
                          if (p < 1 || p > totalPages) return null;
                          return (
                            <button key={p} onClick={() => setPage(p)}
                              className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${page === p ? 'bg-indigo-600 text-white' : 'bg-white/8 text-slate-400 hover:bg-white/12 border border-white/8'}`}>{p}</button>
                          );
                        })}
                      </div>
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/8 hover:bg-white/12 disabled:opacity-30 text-slate-300 transition-colors border border-white/8">Next →</button>
                    </div>
                  )}
                </GlassPanel>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Report Card Modal */}
      <Modal open={modal.open} onClose={() => setModal(m => ({ ...m, open: false }))} title={modal.title}>
        {modal.content}
      </Modal>
    </div>
  );
}
                          