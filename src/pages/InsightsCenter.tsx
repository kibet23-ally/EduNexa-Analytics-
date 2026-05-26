import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../useAuth';

/* ─── CBC Kenya Grading Rubric (8 levels) ───────────────────────────────────── */
const RUBRIC = [
  { min: 90, max: 100, code: 'EE1', label: 'Exceeding Expectations 1', pts: 8, color: '#15803d', bg: '#dcfce7', text: '#14532d' },
  { min: 75, max: 89,  code: 'EE2', label: 'Exceeding Expectations 2', pts: 7, color: '#16a34a', bg: '#d1fae5', text: '#065f46' },
  { min: 58, max: 74,  code: 'ME1', label: 'Meeting Expectations 1',   pts: 6, color: '#2563eb', bg: '#dbeafe', text: '#1e40af' },
  { min: 41, max: 57,  code: 'ME2', label: 'Meeting Expectations 2',   pts: 5, color: '#0ea5e9', bg: '#e0f2fe', text: '#075985' },
  { min: 31, max: 40,  code: 'AE1', label: 'Approaching Expectations 1', pts: 4, color: '#d97706', bg: '#fef3c7', text: '#92400e' },
  { min: 21, max: 30,  code: 'AE2', label: 'Approaching Expectations 2', pts: 3, color: '#f59e0b', bg: '#fffbeb', text: '#78350f' },
  { min: 11, max: 20,  code: 'BE1', label: 'Below Expectations 1',     pts: 2, color: '#dc2626', bg: '#fee2e2', text: '#991b1b' },
  { min: 0,  max: 10,  code: 'BE2', label: 'Below Expectations 2',     pts: 1, color: '#991b1b', bg: '#fecaca', text: '#7f1d1d' },
];

const getRubric = (score: number) =>
  RUBRIC.find(r => score >= r.min && score <= r.max) || RUBRIC[RUBRIC.length - 1];

const getRemarks = (avg: number): { teacher: string; principal: string } => {
  if (avg >= 90) return { teacher: 'Excellent performance. Congratulations! Keep It Up!', principal: 'Outstanding work! You are an example to your peers. Keep excelling!' };
  if (avg >= 75) return { teacher: 'Very good performance. Congratulations! Meeting expectation.', principal: 'Excellent work! Congratulations. Keep It Up!' };
  if (avg >= 58) return { teacher: 'Good performance. Keep working hard to improve further.', principal: 'Good work. Continue putting in the effort to reach higher levels.' };
  if (avg >= 41) return { teacher: 'Fair performance. More effort is needed in several areas.', principal: 'Satisfactory progress. Encourage the learner to work harder.' };
  if (avg >= 31) return { teacher: 'Below average. Learner needs to put in extra effort.', principal: 'More effort needed. Please support the learner at home.' };
  return { teacher: 'Needs urgent improvement. Remedial support is recommended.', principal: 'Urgent attention required. Please meet the class teacher.' };
};

/* ─── Types ──────────────────────────────────────────────────────────────────── */
interface School { id: string; name: string; logo_url?: string; motto?: string; address?: string; phone?: string; email?: string; website?: string; }
interface Grade { id: string; grade_name: string; school_id: string; }
interface Subject { id: string; subject_name: string; subject_code: string; school_id: string; }
interface Exam { id: string; exam_name: string; term: string; year: number; school_id: string; grade_id?: string; is_school_wide: boolean; }
interface Student { id: string; name: string; admission_number: string; gender: string; grade_id: string; school_id: string; }
interface Mark { id: string; student_id: string; subject_id: string; exam_id: string; score: number; school_id: string; teacher_remark?: string; grade_id: string; teacher_id?: string; }
interface AttendanceRecord { id: string; school_id: string; student_id: string; grade_id: string; date: string; status: string; }

/* ─── Logo fetcher ───────────────────────────────────────────────────────────── */
async function fetchLogo(url: string): Promise<{ data: string; fmt: 'PNG' | 'JPEG' } | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const fmt: 'PNG' | 'JPEG' = blob.type.includes('png') ? 'PNG' : 'JPEG';
    const data: string = await new Promise((resolve, reject) => {
      const fr = new FileReader(); fr.onload = () => resolve(fr.result as string); fr.onerror = reject; fr.readAsDataURL(blob);
    });
    return { data, fmt };
  } catch { return null; }
}

/* ─── PDF: full CBC report card matching the sample ─────────────────────────── */
async function generateCBCReportCard(params: {
  school: School | undefined;
  logo: { data: string; fmt: 'PNG' | 'JPEG' } | null;
  student: Student & { rank?: number; totalStudents?: number };
  grade: Grade | undefined;
  exam: Exam | undefined;
  year: string; term: string;
  subjectMarks: { subject_name: string; subject_code: string; score: number; teacher_remark?: string; }[];
  attendance: { total: number; present: number; absent: number; late: number; rate: number };
}) {
  const { school, logo, student, grade, exam, year, term, subjectMarks, attendance } = params;
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = doc.internal.pageSize.width;
  const M = 14; // margin

  /* ── School Header ── */
  // Blue top bar
  doc.setFillColor(0, 32, 96);
  doc.rect(0, 0, W, 28, 'F');

  // Logo left
  if (logo) {
    try { doc.addImage(logo.data, logo.fmt, M, 3, 22, 22); } catch { /* noop */ }
  } else {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(M, 3, 22, 22, 2, 2, 'F');
    doc.setTextColor(0, 32, 96); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text((school?.name || 'S')[0], M + 11, 17, { align: 'center' });
  }

  // School name & contacts centre
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text((school?.name || 'SCHOOL').toUpperCase(), W / 2, 9, { align: 'center' });
  const contacts = [school?.address, school?.phone, school?.email].filter(Boolean).join('   ');
  if (contacts) { doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.text(contacts, W / 2, 15, { align: 'center' }); }
  if (school?.motto) { doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.text(`"${school.motto}"`, W / 2, 21, { align: 'center' }); }

  // Student photo placeholder (right side)
  doc.setFillColor(200, 200, 200);
  doc.rect(W - M - 22, 3, 22, 22, 'F');
  doc.setTextColor(120, 120, 120); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
  doc.text('PHOTO', W - M - 11, 15, { align: 'center' });

  /* ── Report Card Title ── */
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 32, 96); doc.setLineWidth(0.5);
  doc.rect(M, 31, W - M * 2, 9, 'FD');
  doc.setTextColor(0, 32, 96); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('LEARNER ASSESSMENT REPORT CARD', W / 2, 37.5, { align: 'center' });

  /* ── Learner Official Details ── */
  doc.setFillColor(0, 32, 96);
  doc.rect(M, 43, W - M * 2, 6, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text("LEARNER'S OFFICIAL DETAILS", M + 2, 47.5);

  // Details grid
  doc.setFillColor(248, 250, 252);
  doc.rect(M, 49, W - M * 2, 18, 'F');
  doc.setTextColor(0, 0, 0); doc.setFontSize(8); doc.setFont('helvetica', 'normal');

  const col1 = M + 2, col2 = M + 60, col3 = M + 110;
  const r1 = 54, r2 = 60, r3 = 66;

  // Row 1
  doc.setFont('helvetica', 'bold'); doc.text('NAME:', col1, r1);
  doc.setFont('helvetica', 'normal'); doc.text(student.name.toUpperCase(), col1 + 14, r1);
  doc.setFont('helvetica', 'bold'); doc.text('ADM NO:', col2, r1);
  doc.setFont('helvetica', 'normal'); doc.text(student.admission_number, col2 + 17, r1);
  doc.setFont('helvetica', 'bold'); doc.text('GRADE:', col3, r1);
  doc.setFont('helvetica', 'normal'); doc.text(grade?.grade_name?.toUpperCase() || '-', col3 + 14, r1);

  // Row 2
  doc.setFont('helvetica', 'bold'); doc.text('STREAM:', col1, r2);
  doc.setFont('helvetica', 'normal'); doc.text(grade?.grade_name || '-', col1 + 17, r2);
  doc.setFont('helvetica', 'bold'); doc.text('TERM:', col2, r2);
  doc.setFont('helvetica', 'normal'); doc.text(term || exam?.term || '-', col2 + 12, r2);
  doc.setFont('helvetica', 'bold'); doc.text('YEAR:', col3, r2);
  doc.setFont('helvetica', 'normal'); doc.text(year, col3 + 12, r2);

  // Row 3
  doc.setFont('helvetica', 'bold'); doc.text('GENDER:', col1, r3);
  doc.setFont('helvetica', 'normal'); doc.text(student.gender?.toUpperCase() || '-', col1 + 17, r3);
  doc.setFont('helvetica', 'bold'); doc.text('EXAM:', col2, r3);
  doc.setFont('helvetica', 'normal'); doc.text(exam?.exam_name || 'All Exams', col2 + 12, r3);

  /* ── Marks Table ── */
  const tableBody = subjectMarks.map(m => {
    const r = getRubric(m.score);
    return [
      m.subject_name,
      String(m.score),   // MID (using score as mid-term)
      String(m.score),   // AVG
      r.code,            // PL
      String(r.pts),     // PTS
      r.label,           // Performance Level
      m.teacher_remark || '—',
    ];
  });

  autoTable(doc, {
    startY: 70,
    head: [['SUBJECT', 'MID', 'AVG', 'PL', 'PTS', 'PERFORMANCE LEVEL', 'TEACHER']],
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.2, lineColor: [180, 190, 210], lineWidth: 0.2 },
    headStyles: {
      fillColor: [0, 32, 96], textColor: [255, 255, 255],
      fontStyle: 'bold', fontSize: 8, halign: 'center',
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 52 },
      1: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 10, halign: 'center' },
      5: { cellWidth: 55 },
      6: { cellWidth: 28 },
    },
  });

  const fy = (doc as any).lastAutoTable.finalY;

  /* ── Overall Summary Row ── */
  const totalScore = subjectMarks.reduce((a, b) => a + b.score, 0);
  const avg = subjectMarks.length ? totalScore / subjectMarks.length : 0;
  const avgRubric = getRubric(avg);

  doc.setFillColor(240, 240, 240);
  doc.rect(M, fy + 1, W - M * 2, 7, 'F');
  doc.setDrawColor(180, 190, 210); doc.setLineWidth(0.2);
  doc.rect(M, fy + 1, W - M * 2, 7, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0, 0, 0);
  doc.text(`OVERALL AVG: ${avg.toFixed(0)}%`, M + 4, fy + 6);
  doc.text(`P.LEVEL: ${avgRubric.code}`, M + 65, fy + 6);
  doc.text(`RANK: ${student.rank || '-'} / ${student.totalStudents || '-'}`, M + 120, fy + 6);

  /* ── Subject Performance Line Chart (simple) ── */
  const chartY = fy + 12;
  const chartH = 32;
  const chartW = W - M * 2;

  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 32, 96);
  doc.text('Subject Performance Overview (%)', W / 2, chartY + 3, { align: 'center' });

  // Chart area
  doc.setDrawColor(200, 210, 220); doc.setLineWidth(0.2);
  doc.rect(M, chartY + 6, chartW, chartH, 'S');

  // Y-axis labels
  doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
  [0, 20, 40, 60, 80, 100].forEach(v => {
    const y = chartY + 6 + chartH - (v / 100 * chartH);
    doc.text(String(v), M - 1, y + 1, { align: 'right' });
    doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.1);
    doc.line(M, y, M + chartW, y);
  });

  // Plot points and line
  if (subjectMarks.length > 0) {
    const spacing = chartW / (subjectMarks.length + 1);
    const points = subjectMarks.map((m, i) => ({
      x: M + spacing * (i + 1),
      y: chartY + 6 + chartH - (m.score / 100 * chartH),
      score: m.score,
      name: m.subject_name.split(' ')[0],
    }));

    // Line
    doc.setDrawColor(0, 82, 204); doc.setLineWidth(0.6);
    for (let i = 0; i < points.length - 1; i++) {
      doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }

    // Dots and labels
    points.forEach(p => {
      doc.setFillColor(0, 82, 204);
      doc.circle(p.x, p.y, 1.2, 'F');
      doc.setFontSize(5.5); doc.setTextColor(0, 0, 0);
      doc.text(p.name, p.x, chartY + 6 + chartH + 4, { align: 'center' });
    });
  }

  /* ── Attendance Row ── */
  const attY = chartY + chartH + 12;
  doc.setFillColor(232, 240, 254);
  doc.rect(M, attY, W - M * 2, 7, 'F');
  doc.setDrawColor(0, 82, 204); doc.setLineWidth(0.2);
  doc.rect(M, attY, W - M * 2, 7, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(0, 32, 96);
  doc.text(
    `ATTENDANCE:  Sessions: ${attendance.total}   Present: ${attendance.present}   Absent: ${attendance.absent}   Late: ${attendance.late}   Rate: ${attendance.rate}%`,
    W / 2, attY + 5, { align: 'center' },
  );

  /* ── Remarks Section ── */
  const remY = attY + 10;
  const halfW = (W - M * 2 - 4) / 2;
  const remarks = getRemarks(avg);

  // Left — Class Teacher
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(180, 190, 210); doc.setLineWidth(0.3);
  doc.rect(M, remY, halfW, 30, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
  doc.text("Class Teacher's Comment", M + 3, remY + 6);
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(51, 65, 85);
  doc.text(remarks.teacher, M + 3, remY + 12, { maxWidth: halfW - 6 });

  // Signature line
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
  doc.line(M + 3, remY + 23, M + halfW - 5, remY + 23);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(0, 0, 0);
  doc.text('Name: ____________________', M + 3, remY + 28);

  // Right — Principal
  doc.setFillColor(255, 255, 255);
  doc.rect(M + halfW + 4, remY, halfW, 30, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
  doc.text("Principal's Comment", M + halfW + 7, remY + 6);
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(51, 65, 85);
  doc.text(remarks.principal, M + halfW + 7, remY + 12, { maxWidth: halfW - 6 });
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
  doc.line(M + halfW + 7, remY + 23, M + W - M - 5, remY + 23);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(0, 0, 0);
  doc.text('Name: ____________________', M + halfW + 7, remY + 28);

  /* ── Term Dates / Fee Section ── */
  const feeY = remY + 33;
  doc.setDrawColor(180, 190, 210); doc.setLineWidth(0.2);
  doc.rect(M, feeY, W - M * 2, 16, 'S');

  doc.line(W / 2, feeY, W / 2, feeY + 16);
  doc.line(M, feeY + 8, W - M, feeY + 8);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(0, 0, 0);
  doc.text('Term Closed On:', M + 3, feeY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }), M + 35, feeY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Next Term Begins On:', W / 2 + 3, feeY + 5.5);
  doc.setFont('helvetica', 'normal'); doc.text('—', W / 2 + 45, feeY + 5.5);

  doc.setFont('helvetica', 'bold'); doc.text('Fee Balance: Ksh.', M + 3, feeY + 13);
  doc.setFont('helvetica', 'normal'); doc.text('0.00', M + 38, feeY + 13);
  doc.setFont('helvetica', 'bold'); doc.text('Next Term Fee Payable: Ksh.', W / 2 + 3, feeY + 13);
  doc.setFont('helvetica', 'normal'); doc.text('0.00', W / 2 + 55, feeY + 13);

  const totalFeeY = feeY + 16;
  doc.setFillColor(240, 240, 240);
  doc.rect(M, totalFeeY, W - M * 2, 7, 'F');
  doc.rect(M, totalFeeY, W - M * 2, 7, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('Total Fee To Pay Next Term: Ksh. 0.00', W / 2, totalFeeY + 5, { align: 'center' });

  /* ── Authenticity notice ── */
  const noticeY = totalFeeY + 10;
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(0, 32, 96);
  doc.text(
    'This Assessment ReportCard has been issued without alteration. Any alteration invalidates its authenticity.',
    W / 2, noticeY, { align: 'center' },
  );

  /* ── Footer ── */
  const H = doc.internal.pageSize.height;
  doc.setDrawColor(0, 32, 96); doc.setLineWidth(0.4);
  doc.line(M, H - 8, W - M, H - 8);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(100, 116, 139);
  doc.text(`${school?.name || ''} • Powered by EduNexa Analytics`, M, H - 4);
  doc.text(new Date().toLocaleDateString('en-KE', { dateStyle: 'full' }), W - M, H - 4, { align: 'right' });

  doc.save(`ReportCard_${student.name.replace(/\s+/g, '_')}_${year}.pdf`);
}

/* ─── UI Primitives ──────────────────────────────────────────────────────────── */
const Skel = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700/50 ${className}`} />
);

const RubricBadge = ({ score }: { score: number }) => {
  const r = getRubric(score);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ background: r.bg, color: r.text }}>
      {r.code} • {r.pts}pts
    </span>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
export default function InsightsCenter() {
  const { user } = useAuth();
  const sid = user?.school_id;

  const [tab, setTab] = useState<'reportcards' | 'classanalysis' | 'rankings'>('reportcards');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [term, setTerm] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [examId, setExamId] = useState('');
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  const [school, setSchool] = useState<School | undefined>();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [logo, setLogo] = useState<{ data: string; fmt: 'PNG' | 'JPEG' } | null>(null);

  const yearOptions = useMemo(() => { const y = new Date().getFullYear(); return [y, y - 1, y - 2, y - 3].map(String); }, []);

  useEffect(() => {
    if (!sid) return;
    supabase.from('schools').select('id,name,logo_url,motto,address,phone,email,website').eq('id', sid).maybeSingle()
      .then(({ data }) => { if (data) setSchool(data); });
  }, [sid]);

  useEffect(() => {
    if (school?.logo_url) fetchLogo(school.logo_url).then(l => setLogo(l));
  }, [school?.logo_url]);

  useEffect(() => {
    if (!sid) return;
    supabase.from('grades').select('id,grade_name,school_id').eq('school_id', sid).then(({ data }) => setGrades(data || []));
    supabase.from('subjects').select('id,subject_name,subject_code,school_id').eq('school_id', sid).then(({ data }) => setSubjects(data || []));
  }, [sid]);

  useEffect(() => {
    if (!sid) return;
    supabase.from('exams').select('id,exam_name,term,year,school_id,grade_id,is_school_wide')
      .eq('school_id', sid).eq('year', Number(year))
      .then(({ data }) => setExams(data || []));
  }, [sid, year]);

  useEffect(() => {
    if (!sid) return;
    let q = supabase.from('students').select('id,name,admission_number,gender,grade_id,school_id').eq('school_id', sid);
    if (gradeId) q = q.eq('grade_id', gradeId);
    q.then(({ data }) => { setStudents(data || []); setSelectedStudent(null); });
  }, [sid, gradeId]);

  useEffect(() => {
    if (!sid) return;
    setLoading(true);
    let q = supabase.from('marks').select('id,student_id,subject_id,exam_id,score,school_id,teacher_remark,grade_id,teacher_id').eq('school_id', sid);
    if (gradeId) q = q.eq('grade_id', gradeId);
    if (examId) q = q.eq('exam_id', examId);
    q.then(({ data }) => { setMarks(data || []); setLoading(false); });
  }, [sid, gradeId, examId]);

  useEffect(() => {
    if (!sid) return;
    let q = supabase.from('attendance').select('id,school_id,student_id,grade_id,date,status').eq('school_id', sid);
    if (gradeId) q = q.eq('grade_id', gradeId);
    q.then(({ data }) => setAttendance(data || []));
  }, [sid, gradeId]);

  /* ── Rankings ── */
  const rankings = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    marks.forEach(m => {
      if (!map[m.student_id]) map[m.student_id] = { total: 0, count: 0 };
      map[m.student_id].total += m.score; map[m.student_id].count++;
    });
    return students
      .map(s => {
        const d = map[s.id];
        const avg = d ? d.total / d.count : 0;
        return { ...s, avg: Math.round(avg * 10) / 10, total: d?.total || 0, subjects: d?.count || 0 };
      })
      .filter(s => s.subjects > 0)
      .sort((a, b) => b.avg - a.avg)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }, [marks, students]);

  const filteredExams = useMemo(() =>
    exams.filter(e => !gradeId || e.grade_id === gradeId || e.is_school_wide),
    [exams, gradeId]);

  const filteredStudents = useMemo(() => {
    if (!search) return students;
    const s = search.toLowerCase();
    return students.filter(st => st.name.toLowerCase().includes(s) || st.admission_number.includes(s));
  }, [students, search]);

  const filteredRankings = useMemo(() => {
    if (!search) return rankings;
    const s = search.toLowerCase();
    return rankings.filter(r => r.name.toLowerCase().includes(s) || r.admission_number.includes(s));
  }, [rankings, search]);

  /* ── Helpers ── */
  const getStudentMarks = useCallback((studentId: string) => {
    return subjects.map(subj => {
      const m = marks.find(mk => mk.student_id === studentId && mk.subject_id === subj.id);
      return m ? { subject_name: subj.subject_name, subject_code: subj.subject_code, score: m.score, teacher_remark: m.teacher_remark } : null;
    }).filter(Boolean) as { subject_name: string; subject_code: string; score: number; teacher_remark?: string }[];
  }, [marks, subjects]);

  const getStudentAttendance = useCallback((studentId: string) => {
    const sa = attendance.filter(a => a.student_id === studentId && new Date(a.date).getFullYear() === Number(year));
    return {
      total: sa.length,
      present: sa.filter(a => a.status === 'present').length,
      absent: sa.filter(a => a.status === 'absent').length,
      late: sa.filter(a => a.status === 'late').length,
      rate: sa.length ? Math.round(sa.filter(a => a.status === 'present').length / sa.length * 100) : 0,
    };
  }, [attendance, year]);

  /* ── PDF generation ── */
  const handleGenReportCard = useCallback(async (student: Student) => {
    const rank = rankings.find(r => r.id === student.id);
    await generateCBCReportCard({
      school, logo,
      student: { ...student, rank: rank?.rank, totalStudents: rankings.length },
      grade: grades.find(g => g.id === student.grade_id),
      exam: exams.find(e => e.id === examId),
      year, term,
      subjectMarks: getStudentMarks(student.id),
      attendance: getStudentAttendance(student.id),
    });
  }, [school, logo, grades, exams, examId, year, term, rankings, getStudentMarks, getStudentAttendance]);

  const handleGenClassAnalysis = useCallback(async () => {
    if (!gradeId) { alert('Please select a grade first'); return; }
    const gradeName = grades.find(g => g.id === gradeId)?.grade_name || 'Class';
    const doc = new jsPDF('p', 'mm', 'a4');
    const W = doc.internal.pageSize.width, M = 14;

    // Header
    doc.setFillColor(0, 32, 96); doc.rect(0, 0, W, 28, 'F');
    if (logo) { try { doc.addImage(logo.data, logo.fmt, M, 3, 22, 22); } catch { /* noop */ } }
    doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text((school?.name || 'SCHOOL').toUpperCase(), W / 2, 9, { align: 'center' });
    if (school?.motto) { doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.text(`"${school.motto}"`, W / 2, 20, { align: 'center' }); }
    doc.setFillColor(255, 255, 255); doc.setDrawColor(0, 32, 96); doc.setLineWidth(0.5);
    doc.rect(M, 31, W - M * 2, 9, 'FD');
    doc.setTextColor(0, 32, 96); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text(`CLASS PERFORMANCE ANALYSIS — ${gradeName.toUpperCase()}`, W / 2, 37.5, { align: 'center' });

    // Summary
    const allScores = marks.map(m => m.score);
    const avg = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
    const pass = allScores.length ? allScores.filter(s => s >= 41).length / allScores.length * 100 : 0;
    const exam = exams.find(e => e.id === examId);

    doc.setFillColor(232, 240, 254); doc.rect(M, 43, W - M * 2, 10, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(0, 32, 96);
    doc.text(`${gradeName}  •  ${exam?.exam_name || 'All Exams'}  •  Year ${year}  •  ${term || 'All Terms'}  •  Students: ${students.length}  •  Mean: ${avg.toFixed(1)}%  •  Pass Rate: ${pass.toFixed(0)}%`, W / 2, 50, { align: 'center' });

    // Subject analysis table
    const rows = subjects.map(subj => {
      const sm = marks.filter(m => m.subject_id === subj.id);
      if (!sm.length) return null;
      const a = sm.reduce((x, b) => x + b.score, 0) / sm.length;
      const r = getRubric(a);
      const p = sm.filter(m => m.score >= 41).length / sm.length * 100;
      const dist = RUBRIC.map(rb => sm.filter(m => m.score >= rb.min && m.score <= rb.max).length);
      return [subj.subject_name, sm.length, a.toFixed(1) + '%', r.code, String(r.pts), r.label, p.toFixed(0) + '%', ...dist];
    }).filter(Boolean);

    autoTable(doc, {
      startY: 57,
      head: [['Learning Area', 'Count', 'Mean', 'PL', 'Pts', 'Performance Level', 'Pass%', 'EE1', 'EE2', 'ME1', 'ME2', 'AE1', 'AE2', 'BE1', 'BE2']],
      body: rows as any,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [0, 32, 96], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 42 }, 1: { halign: 'center' }, 2: { halign: 'center', fontStyle: 'bold' }, 3: { halign: 'center', fontStyle: 'bold' }, 4: { halign: 'center' } },
    });

    const y2 = (doc as any).lastAutoTable.finalY + 8;
    autoTable(doc, {
      startY: y2,
      head: [['Performance Level', 'Code', 'Pts', 'Score Range', 'Count', '%']],
      body: RUBRIC.map(r => {
        const count = allScores.filter(s => s >= r.min && s <= r.max).length;
        return [r.label, r.code, r.pts, `${r.min} - ${r.max}`, count, allScores.length ? (count / allScores.length * 100).toFixed(1) + '%' : '0%'];
      }),
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [0, 32, 96], textColor: [255, 255, 255], fontStyle: 'bold' },
      tableWidth: 140,
    });

    const H = doc.internal.pageSize.height;
    doc.setDrawColor(0, 32, 96); doc.setLineWidth(0.4);
    doc.line(M, H - 8, W - M, H - 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(100, 116, 139);
    doc.text(`${school?.name || ''} • Generated by EduNexa Analytics`, M, H - 4);
    doc.text(new Date().toLocaleDateString('en-KE', { dateStyle: 'full' }), W - M, H - 4, { align: 'right' });

    doc.save(`ClassAnalysis_${gradeName}_${year}.pdf`);
  }, [school, logo, grades, gradeId, subjects, marks, students, year, term, examId, exams]);

  const handleBulkPDF = useCallback(async () => {
    if (!filteredStudents.length) return;
    setBulkLoading(true); setBulkProgress(0);
    for (let i = 0; i < Math.min(filteredStudents.length, 100); i++) {
      await handleGenReportCard(filteredStudents[i]);
      setBulkProgress(Math.round((i + 1) / Math.min(filteredStudents.length, 100) * 100));
      await new Promise(r => setTimeout(r, 200));
    }
    setBulkLoading(false); setBulkProgress(0);
  }, [filteredStudents, handleGenReportCard]);

  const exportExcel = useCallback(() => {
    const data = rankings.map(s => ({
      Rank: s.rank, Name: s.name, 'Adm No': s.admission_number,
      Gender: s.gender, Class: grades.find(g => g.id === s.grade_id)?.grade_name || '',
      Average: s.avg, Code: getRubric(s.avg).code, Level: getRubric(s.avg).label, Points: getRubric(s.avg).pts,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rankings');
    XLSX.writeFile(wb, `Rankings_${grades.find(g => g.id === gradeId)?.grade_name || 'All'}_${year}.xlsx`);
  }, [rankings, grades, gradeId, year]);

  /* ─── RENDER ─────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-5 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-5 rounded-full" style={{ background: 'linear-gradient(to bottom, #1d4ed8, #7c3aed)' }} />
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: '#1d4ed8' }}>Insights Center</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Academic Reports</h1>
            <p className="text-xs text-slate-500 mt-0.5">{school?.name || '…'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { val: year, set: setYear, opts: yearOptions.map(y => ({ v: y, l: y })), ph: 'Year' },
              { val: term, set: setTerm, opts: [{ v: '', l: 'All Terms' }, { v: 'Term 1', l: 'Term 1' }, { v: 'Term 2', l: 'Term 2' }, { v: 'Term 3', l: 'Term 3' }], ph: 'Term' },
              { val: gradeId, set: (v: string) => { setGradeId(v); setExamId(''); }, opts: [{ v: '', l: 'All Grades' }, ...grades.map(g => ({ v: g.id, l: g.grade_name }))], ph: 'Grade' },
              { val: examId, set: setExamId, opts: [{ v: '', l: 'All Exams' }, ...filteredExams.map(e => ({ v: e.id, l: e.exam_name }))], ph: 'Exam' },
            ].map(f => (
              <select key={f.ph} value={f.val} onChange={e => f.set(e.target.value)}
                className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer">
                {f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto mt-4 flex gap-1">
          {([
            { key: 'reportcards', label: '📄 Report Cards' },
            { key: 'classanalysis', label: '📊 Class Analysis' },
            { key: 'rankings', label: '🏆 Rankings' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t.key ? 'text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              style={tab === t.key ? { background: '#002060' } : {}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>

            {/* ════ REPORT CARDS ════ */}
            {tab === 'reportcards' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div>
                      <h2 className="font-bold text-slate-900 dark:text-white">Student Report Cards</h2>
                      <p className="text-xs text-slate-500 mt-0.5">{filteredStudents.length} students · CBC 8-level grading</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <div className="relative">
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student…"
                          className="pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 text-slate-700 dark:text-slate-200 w-44" />
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                      </div>
                      <button onClick={handleBulkPDF} disabled={bulkLoading || !filteredStudents.length}
                        className="px-4 py-2 rounded-xl text-white text-xs font-semibold transition-colors disabled:opacity-50"
                        style={{ background: '#002060' }}>
                        {bulkLoading ? `Generating… ${bulkProgress}%` : `⬇ Bulk PDF (${Math.min(filteredStudents.length, 100)})`}
                      </button>
                    </div>
                  </div>

                  {bulkLoading && (
                    <div className="mb-4 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${bulkProgress}%`, background: '#002060' }} />
                    </div>
                  )}

                  {loading ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-20" />)}
                    </div>
                  ) : filteredStudents.length > 0 ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredStudents.map(s => {
                        const sMarks = getStudentMarks(s.id);
                        const avg = sMarks.length ? sMarks.reduce((a, b) => a + b.score, 0) / sMarks.length : null;
                        const rank = rankings.find(r => r.id === s.id);
                        const r = avg !== null ? getRubric(avg) : null;
                        const isSelected = selectedStudent?.id === s.id;
                        return (
                          <div key={s.id} onClick={() => setSelectedStudent(isSelected ? null : s)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-blue-800 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:border-blue-400'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                                  style={{ background: r ? r.color : '#94a3b8' }}>{s.name[0]}</div>
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{s.name}</div>
                                  <div className="text-[10px] text-slate-500">{s.admission_number}</div>
                                </div>
                              </div>
                              {r && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: r.bg, color: r.text }}>{r.code}</span>}
                            </div>
                            {avg !== null && (
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${avg}%`, background: r?.color }} />
                                </div>
                                <span className="text-xs font-bold">{avg.toFixed(1)}%</span>
                                {rank && <span className="text-[10px] text-slate-400">#{rank.rank}</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-slate-400 text-sm">
                      {gradeId ? 'No students found' : 'Select a grade to load students'}
                    </div>
                  )}
                </div>

                {/* Preview */}
                <AnimatePresence>
                  {selectedStudent && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                      <div className="flex items-start justify-between flex-wrap gap-3 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedStudent.name}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {selectedStudent.admission_number} · {selectedStudent.gender} · {grades.find(g => g.id === selectedStudent.grade_id)?.grade_name}
                            {rankings.find(r => r.id === selectedStudent.id) && ` · Rank #${rankings.find(r => r.id === selectedStudent.id)?.rank} of ${rankings.length}`}
                          </p>
                        </div>
                        <button onClick={() => handleGenReportCard(selectedStudent)}
                          className="px-4 py-2 rounded-xl text-white text-xs font-bold transition-colors" style={{ background: '#002060' }}>
                          ⬇ Download PDF
                        </button>
                      </div>

                      {(() => {
                        const sMarks = getStudentMarks(selectedStudent.id);
                        const att = getStudentAttendance(selectedStudent.id);
                        const avg = sMarks.length ? sMarks.reduce((a, b) => a + b.score, 0) / sMarks.length : 0;
                        const remarks = getRemarks(avg);
                        return sMarks.length > 0 ? (
                          <div className="space-y-4">
                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr style={{ background: '#002060' }}>
                                    {['Subject', 'Score', 'PL', 'Pts', 'Performance Level', 'Teacher Remark'].map(h => (
                                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-yellow-400">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {sMarks.map(m => {
                                    const r = getRubric(m.score);
                                    return (
                                      <tr key={m.subject_name} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                        <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">{m.subject_name}</td>
                                        <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">{m.score}</td>
                                        <td className="px-3 py-2.5"><RubricBadge score={m.score} /></td>
                                        <td className="px-3 py-2.5 font-bold text-center" style={{ color: r.color }}>{r.pts}</td>
                                        <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300">{r.label}</td>
                                        <td className="px-3 py-2.5 text-xs text-slate-500 italic">{m.teacher_remark || '—'}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr style={{ background: '#002060' }}>
                                    <td colSpan={1} className="px-3 py-2 text-xs font-bold text-yellow-400">OVERALL</td>
                                    <td className="px-3 py-2 font-bold text-white">{avg.toFixed(1)}%</td>
                                    <td className="px-3 py-2"><RubricBadge score={avg} /></td>
                                    <td className="px-3 py-2 font-bold text-white text-center">{getRubric(avg).pts}</td>
                                    <td colSpan={2} className="px-3 py-2 text-xs text-slate-300">{sMarks.length} learning areas · Rank #{rankings.find(r => r.id === selectedStudent.id)?.rank || '-'}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                            <div className="grid md:grid-cols-3 gap-3">
                              <div className="rounded-xl p-3 border" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
                                <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#1e40af' }}>Attendance</div>
                                <div className="grid grid-cols-2 gap-1 text-xs">
                                  {[['Sessions', att.total], ['Present', att.present], ['Absent', att.absent], ['Rate', `${att.rate}%`]].map(([k, v]) => (
                                    <div key={k as string} className="flex justify-between">
                                      <span className="text-slate-500">{k}</span>
                                      <span className="font-semibold text-slate-800">{v}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="rounded-xl p-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                                <div className="text-[10px] font-bold uppercase" style={{ color: '#002060' }}>Class Teacher's Remarks</div>
                                <p className="text-xs italic text-slate-600 dark:text-slate-300 mt-1">{remarks.teacher}</p>
                              </div>
                              <div className="rounded-xl p-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                                <div className="text-[10px] font-bold uppercase" style={{ color: '#002060' }}>Principal's Remarks</div>
                                <p className="text-xs italic text-slate-600 dark:text-slate-300 mt-1">{remarks.principal}</p>
                              </div>
                            </div>
                          </div>
                        ) : <div className="text-center py-10 text-slate-400 text-sm">No marks recorded for current filters</div>;
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ════ CLASS ANALYSIS ════ */}
            {tab === 'classanalysis' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white">Class Performance Analysis</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Subject means, distribution and CBC performance levels</p>
                  </div>
                  <button onClick={handleGenClassAnalysis}
                    className="px-4 py-2 rounded-xl text-white text-xs font-bold" style={{ background: '#002060' }}>
                    ⬇ Download PDF
                  </button>
                </div>
                {!gradeId ? (
                  <div className="text-center py-16 text-slate-400 text-sm">Select a grade to view class analysis</div>
                ) : loading ? (
                  <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skel key={i} className="h-12" />)}</div>
                ) : (
                  <div className="space-y-5">
                    {(() => {
                      const scores = marks.map(m => m.score);
                      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
                      const pass = scores.length ? scores.filter(s => s >= 41).length / scores.length * 100 : 0;
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { l: 'Students', v: students.length, c: '#002060' },
                            { l: 'Mean Score', v: avg.toFixed(1) + '%', c: getRubric(avg).color },
                            { l: 'Pass Rate', v: pass.toFixed(0) + '%', c: '#15803d' },
                            { l: 'Grade', v: `${getRubric(avg).code}`, c: getRubric(avg).color },
                          ].map(k => (
                            <div key={k.l} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{k.l}</div>
                              <div className="text-xl font-bold" style={{ color: k.c }}>{k.v}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: '#002060' }}>
                            {['#', 'Learning Area', 'Entries', 'Mean', 'PL', 'Pts', 'Level', 'Pass%'].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-yellow-400">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {subjects.map((subj, i) => {
                            const sm = marks.filter(m => m.subject_id === subj.id);
                            if (!sm.length) return null;
                            const avg = sm.reduce((a, b) => a + b.score, 0) / sm.length;
                            const r = getRubric(avg);
                            const pass = sm.filter(m => m.score >= 41).length / sm.length * 100;
                            return (
                              <tr key={subj.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                                <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">{subj.subject_name}</td>
                                <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">{sm.length}</td>
                                <td className="px-3 py-2.5 font-bold" style={{ color: r.color }}>{avg.toFixed(1)}%</td>
                                <td className="px-3 py-2.5"><RubricBadge score={avg} /></td>
                                <td className="px-3 py-2.5 font-bold text-center" style={{ color: r.color }}>{r.pts}</td>
                                <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300">{r.label}</td>
                                <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: pass >= 41 ? '#15803d' : '#dc2626' }}>{pass.toFixed(0)}%</td>
                              </tr>
                            );
                          }).filter(Boolean)}
                        </tbody>
                      </table>
                    </div>

                    {/* Distribution */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {RUBRIC.map(r => {
                        const count = marks.filter(m => m.score >= r.min && m.score <= r.max).length;
                        const pct = marks.length ? Math.round(count / marks.length * 100) : 0;
                        return (
                          <div key={r.code} className="rounded-xl p-3 border" style={{ background: r.bg, borderColor: r.color + '40' }}>
                            <div className="text-xs font-bold" style={{ color: r.text }}>{r.code}</div>
                            <div className="text-[10px] mb-1" style={{ color: r.text + 'aa' }}>{r.min}–{r.max}</div>
                            <div className="text-2xl font-black" style={{ color: r.text }}>{count}</div>
                            <div className="text-[10px]" style={{ color: r.text + 'aa' }}>{pct}%</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ════ RANKINGS ════ */}
            {tab === 'rankings' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white">Student Rankings</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{filteredRankings.length} students ranked · CBC grading</p>
                  </div>
                  <div className="flex gap-2">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                      className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 text-slate-700 dark:text-slate-200 w-36" />
                    <button onClick={exportExcel}
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                      Excel
                    </button>
                  </div>
                </div>

                {filteredRankings.length >= 3 && (
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[filteredRankings[1], filteredRankings[0], filteredRankings[2]].map((s, i) => {
                      const podium = [2, 1, 3][i];
                      const bgs = ['#64748b', '#002060', '#b45309'];
                      const heights = ['h-24', 'h-32', 'h-20'];
                      return (
                        <div key={s.id} className={`flex flex-col items-center ${i === 1 ? 'order-2' : i === 0 ? 'order-1' : 'order-3'}`}>
                          <div className={`w-full ${heights[i]} rounded-t-2xl flex flex-col items-center justify-end pb-3 text-white shadow-lg`}
                            style={{ background: bgs[i] }}>
                            <div className="text-3xl font-black">#{podium}</div>
                          </div>
                          <div className="w-full p-3 text-center rounded-b-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                            <div className="text-sm font-bold truncate text-slate-800 dark:text-slate-100">{s.name}</div>
                            <div className="text-[10px] text-slate-500">{s.admission_number}</div>
                            <div className="text-lg font-black mt-1" style={{ color: getRubric(s.avg).color }}>{s.avg}%</div>
                            <RubricBadge score={s.avg} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {loading ? (
                  <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-12" />)}</div>
                ) : filteredRankings.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: '#002060' }}>
                          {['Rank', 'Student', 'Adm No', 'Gender', 'Class', 'Score', 'PL', 'Pts', 'Level', ''].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-yellow-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRankings.map(s => {
                          const r = getRubric(s.avg);
                          const medals = ['text-yellow-500', 'text-slate-400', 'text-amber-700'];
                          return (
                            <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className={`px-3 py-3 font-black text-sm ${s.rank <= 3 ? medals[s.rank - 1] : 'text-slate-400'}`}>#{s.rank}</td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                    style={{ background: r.color }}>{s.name[0]}</div>
                                  <span className="font-medium text-slate-800 dark:text-slate-100">{s.name}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-slate-500 font-mono text-xs">{s.admission_number}</td>
                              <td className="px-3 py-3 text-slate-500 text-xs">{s.gender}</td>
                              <td className="px-3 py-3 text-slate-600 dark:text-slate-300 text-xs">{grades.find(g => g.id === s.grade_id)?.grade_name}</td>
                              <td className="px-3 py-3 font-bold" style={{ color: r.color }}>{s.avg}%</td>
                              <td className="px-3 py-3"><RubricBadge score={s.avg} /></td>
                              <td className="px-3 py-3 font-bold text-center" style={{ color: r.color }}>{r.pts}</td>
                              <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">{r.label}</td>
                              <td className="px-3 py-3">
                                <button onClick={() => { setSelectedStudent(s); setTab('reportcards'); }}
                                  className="text-xs font-semibold" style={{ color: '#002060' }}>
                                  Report →
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-16 text-slate-400 text-sm">
                    {gradeId ? 'No ranked students' : 'Select a grade and exam to view rankings'}
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}