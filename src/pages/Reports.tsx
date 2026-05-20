import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { Exam, Grade, Subject, Mark, Student, School } from '../types';
import { getCBCGrade, getOverallGrade } from '../lib/utils';
import { fetchWithProxy } from '../lib/fetchProxy';
import { useData } from '../hooks/useData';
import {
  FileText, Download, Printer, FileSpreadsheet, User, Save, CheckCircle2,
  Award, TrendingUp, Hash, Target,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Letterhead from '../components/Letterhead';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable: { finalY: number };
}

interface ProcessedStudent extends Student {
  marks: Mark[];
  totalScore: number;
  totalPoints: number;
  meanScore: number;
  avgPoints: number;
  grade: string;
  rank?: number;
}

interface ReportData {
  students: ProcessedStudent[];
  subjects: Subject[];
  exam: Exam;
  grade: Grade;
}

interface SchoolTerm {
  id: number;
  term_name: string;
  year: number;
  closing_date: string | null;
  opening_date: string | null;
  is_current: boolean;
}

type ActiveTab = 'class' | 'reportcard';

/* ────────────────────────────────────────────────────────────────
   REASONABLE, HUMAN-SOUNDING REMARKS
   Tiered by CBC performance band derived from average points (1–8).
   ──────────────────────────────────────────────────────────────── */

type Band = 'EE' | 'ME' | 'AE' | 'BE';

const bandFromPoints = (pts: number): Band => {
  if (pts >= 7) return 'EE';
  if (pts >= 5) return 'ME';
  if (pts >= 3) return 'AE';
  return 'BE';
};

const bandFromScore = (score: number): Band => {
  if (score >= 75) return 'EE';
  if (score >= 58) return 'ME';
  if (score >= 31) return 'AE';
  return 'BE';
};

const TEACHER_SUBJECT_REMARKS: Record<Band, string> = {
  EE: 'Excellent mastery of the concepts. Keep up the impressive work.',
  ME: 'A good grasp of the work. Maintain the steady effort and revise often.',
  AE: 'Fair effort shown. More practice and consistent revision are needed.',
  BE: 'Requires extra support and remedial work. Please seek help promptly.',
};

const CLASS_TEACHER_REMARKS: Record<Band, string> = {
  EE: 'An exemplary learner who shows discipline, focus and consistent academic excellence. Continue setting the pace for others.',
  ME: 'A diligent and well-mannered learner whose progress is steady. With continued focus, even better results are within reach.',
  AE: 'Shows clear potential but needs greater commitment to studies and active class participation. Improvement is well within reach.',
  BE: 'Capable of far more with consistent effort and discipline. Closer partnership between home and school is strongly encouraged.',
};

const PRINCIPAL_REMARKS: Record<Band, string> = {
  EE: 'A truly commendable performance. You are a shining example to your peers — keep aiming higher.',
  ME: 'Encouraging results. With sustained focus and discipline, you will rise to the top tier next term.',
  AE: 'Performance can improve significantly with better study habits and time management. Parental support is highly encouraged.',
  BE: 'We believe in your potential. Let us work together — learner, parents and school — to turn things around next term.',
};

const buildRemarks = (avgPoints: number) => {
  const band = bandFromPoints(avgPoints);
  return {
    teacher: TEACHER_SUBJECT_REMARKS[band],
    classTeacher: CLASS_TEACHER_REMARKS[band],
    principal: PRINCIPAL_REMARKS[band],
  };
};

const defaultSubjectRemark = (score: number) =>
  TEACHER_SUBJECT_REMARKS[bandFromScore(score)];

/* ──────────────────────────────────────────────────────────────── */

const Reports = () => {
  const { user } = useAuth();
  const [selectedExam, setSelectedExam]       = useState('');
  const [selectedGrade, setSelectedGrade]     = useState('');
  const [reportData, setReportData]           = useState<ReportData | null>(null);
  const [activeTab, setActiveTab]             = useState<ActiveTab>('class');
  const [selectedStudent, setSelectedStudent] = useState<ProcessedStudent | null>(null);
  const [schoolTerms, setSchoolTerms]         = useState<SchoolTerm[]>([]);
  const [selectedTerm, setSelectedTerm]       = useState<SchoolTerm | null>(null);
  const [teacherRemarks, setTeacherRemarks]   = useState<Record<number, string>>({});
  const [ctRemark, setCtRemark]               = useState('');
  const [principalRemark, setPrincipalRemark] = useState('');
  const [savingRemarks, setSavingRemarks]     = useState(false);
  const [remarksSaved, setRemarksSaved]       = useState(false);
  const [studentSearch, setStudentSearch]     = useState('');

  const examsQuery = useData<Exam>('exams-list-reports', 'exams', {
    select: 'id, exam_name, term, year',
    orderBy: { column: 'year', ascending: false },
  }, !!user?.school_id);

  const gradesQuery = useData<Grade>('grades-list-reports', 'grades', {
    select: 'id, grade_name',
    orderBy: { column: 'grade_name', ascending: true },
  }, !!user?.school_id);

  const schoolsQuery = useData<School>('school-info-reports', 'schools', { select: '*' }, !!user?.school_id);

  const exams  = useMemo(() => examsQuery.data || [], [examsQuery.data]);
  const grades = useMemo(() => {
    const d = gradesQuery.data || [];
    return [...d].sort((a, b) => {
      const numA = parseInt(a.grade_name.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.grade_name.match(/\d+/)?.[0] || '0');
      if (numA !== numB) return numA - numB;
      return a.grade_name.localeCompare(b.grade_name);
    });
  }, [gradesQuery.data]);

  const schoolInfo = useMemo(() =>
    (schoolsQuery.data as School[])?.find(s => s.id === user?.school_id) || null,
    [schoolsQuery.data, user?.school_id],
  );

  useEffect(() => {
    if (!user?.school_id) return;
    supabase.from('school_terms')
      .select('*')
      .eq('school_id', user.school_id)
      .order('year', { ascending: false })
      .then(({ data }) => {
        setSchoolTerms(data || []);
        const current = (data || []).find((t: SchoolTerm) => t.is_current);
        if (current) setSelectedTerm(current);
      });
  }, [user?.school_id]);

  const loadReportData = React.useCallback(async () => {
    try {
      if (!selectedExam || !selectedGrade) return;

      const [studentsRes, marksRes, subjectsRes] = await Promise.all([
        fetchWithProxy('students', { filters: { grade_id: Number(selectedGrade) } }),
        fetchWithProxy('marks',    { filters: { exam_id:  Number(selectedExam) } }),
        fetchWithProxy('subjects'),
      ]);

      const data = {
        students: studentsRes.data || [],
        marks:    marksRes.data    || [],
        subjects: subjectsRes.data || [],
      };

      const filteredSubjects = (data.subjects || []).filter((sub: Subject) => {
        const name = sub.subject_name.toLowerCase().trim();
        return !['science & technology', 'science and technology', 'music',
          'art & craft', 'art and craft', 'physical education'].includes(name);
      });

      const processedStudents: ProcessedStudent[] = data.students.map((s: Student) => {
        const sMarks = data.marks.filter((m: Mark) =>
          m.student_id === s.id && filteredSubjects.some(sub => sub.id === m.subject_id));
        const totalScore  = sMarks.reduce((acc: number, m: Mark) => acc + m.score, 0);
        const totalPoints = sMarks.reduce((acc: number, m: Mark) => acc + getCBCGrade(m.score).points, 0);
        const meanScore   = totalScore / 9;
        const avgPoints   = meanScore;
        return {
          ...s, marks: sMarks, totalScore, totalPoints,
          avgPoints, meanScore, grade: getOverallGrade(avgPoints),
        };
      }).sort((a: ProcessedStudent, b: ProcessedStudent) => b.totalScore - a.totalScore);

      processedStudents.forEach((s, i) => { s.rank = i + 1; });

      setReportData({
        ...data,
        subjects: filteredSubjects,
        students: processedStudents,
        exam:  exams.find(e => e.id.toString() === selectedExam)!,
        grade: grades.find(g => g.id.toString() === selectedGrade)!,
      });
      setSelectedStudent(null);
    } catch (error) {
      console.error('Reports fetch error:', error);
    }
  }, [selectedExam, selectedGrade, exams, grades]);

  useEffect(() => { Promise.resolve().then(() => loadReportData()); }, [loadReportData]);

  // Load existing per-subject teacher remarks + saved CT/Principal remarks (with reasonable defaults)
  useEffect(() => {
    if (!selectedStudent || !selectedExam) return;

    supabase.from('marks')
      .select('subject_id, teacher_remark')
      .eq('student_id', selectedStudent.id)
      .eq('exam_id', Number(selectedExam))
      .then(({ data }) => {
        const map: Record<number, string> = {};
        (data || []).forEach((m: { subject_id: number; teacher_remark: string | null }) => {
          if (m.teacher_remark) map[m.subject_id] = m.teacher_remark;
        });
        setTeacherRemarks(map);
      });

    supabase.from('report_remarks')
      .select('class_teacher_remark, principal_remark')
      .eq('student_id', selectedStudent.id)
      .eq('exam_id', Number(selectedExam))
      .maybeSingle()
      .then(({ data }) => {
        const auto = buildRemarks(selectedStudent.avgPoints);
        setCtRemark(data?.class_teacher_remark || auto.classTeacher);
        setPrincipalRemark(data?.principal_remark || auto.principal);
      });
  }, [selectedStudent, selectedExam]);

  const handleSaveRemarks = async () => {
    if (!selectedStudent || !selectedExam || !user?.school_id) return;
    setSavingRemarks(true);
    await supabase.from('report_remarks').upsert({
      school_id:            user.school_id,
      student_id:           selectedStudent.id,
      exam_id:              Number(selectedExam),
      class_teacher_remark: ctRemark,
      principal_remark:     principalRemark,
      updated_at:           new Date().toISOString(),
    }, { onConflict: 'student_id,exam_id' });
    setSavingRemarks(false);
    setRemarksSaved(true);
    setTimeout(() => setRemarksSaved(false), 3000);
  };

  const handleTeacherRemark = async (subjectId: number, markId: number, value: string) => {
    setTeacherRemarks(prev => ({ ...prev, [subjectId]: value }));
    await supabase.from('marks').update({ teacher_remark: value }).eq('id', markId);
  };

  const filteredStudents = useMemo(() =>
    (reportData?.students || []).filter(s =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.admission_number.toLowerCase().includes(studentSearch.toLowerCase()),
    ), [reportData, studentSearch]);

  /* ── PDF helpers ────────────────────────────────────────────── */

const drawPremiumLetterhead = (doc: jsPDF, title: string) => {
    const schoolTitle   = (schoolInfo?.name || user?.school_name || 'SCHOOL').toUpperCase();
    const schoolAddress = schoolInfo?.address || '';
    const schoolMotto   = schoolInfo?.motto ? `Motto: ${schoolInfo.motto}` : '';

    // Banner
    doc.setFillColor(15, 23, 42);            // slate-900
    doc.rect(0, 0, 210, 34, 'F');
    doc.setFillColor(37, 99, 235);           // blue-600 accent stripe
    doc.rect(0, 34, 210, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text(schoolTitle, 105, 13, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    if (schoolAddress) doc.text(schoolAddress, 105, 19, { align: 'center' });
    doc.setFont('helvetica', 'italic');
    if (schoolMotto)   doc.text(schoolMotto,   105, 24, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(191, 219, 254);         // blue-200
    doc.text(title, 105, 31, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  };

  /* ── PDF: Individual Report Card ───────────────────────────── */
  const generateSingleReportCard = (student: ProcessedStudent) => {
    if (!reportData) return;
    const doc = new jsPDF() as jsPDFWithAutoTable;
    const exam  = reportData.exam;
    const grade = reportData.grade;

    drawPremiumLetterhead(doc, 'STUDENT PROGRESS REPORT');

    // Student details
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 42, 182, 30, 2, 2, 'FD');

    const col1x = 18, col2x = 78, col3x = 138;
    const row1y = 50, row2y = 60;

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('STUDENT NAME',  col1x, row1y);
    doc.text('ADMISSION NO.', col2x, row1y);
    doc.text('GENDER',        col3x, row1y);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(student.name,             col1x, row1y + 5);
    doc.text(student.admission_number, col2x, row1y + 5);
    doc.text(student.gender || '—',    col3x, row1y + 5);

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('GRADE / CLASS', col1x, row2y + 4);
    doc.text('EXAM',          col2x, row2y + 4);
    doc.text('TERM & YEAR',   col3x, row2y + 4);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(grade?.grade_name || '—',             col1x, row2y + 9);
    doc.text(exam?.exam_name || '—',               col2x, row2y + 9);
    doc.text(`Term ${exam?.term}, ${exam?.year}`,  col3x, row2y + 9);

    // Marks table — NO "Grade Remarks" column
    const tableBody = reportData.subjects.map((sub: Subject) => {
      const mark      = student.marks.find(m => m.subject_id === sub.id);
      const score     = mark?.score ?? null;
      const gradeInfo = score !== null ? getCBCGrade(score) : null;
      const savedRemark = teacherRemarks[sub.id] || mark?.teacher_remark || '';
      const tRemark   = savedRemark || (score !== null ? defaultSubjectRemark(score) : '—');
      return [
        sub.subject_name,
        score !== null ? `${score}/100` : '—',
        gradeInfo ? gradeInfo.level : '—',
        gradeInfo ? String(gradeInfo.points) : '—',
        tRemark,
      ];
    });

    autoTable(doc, {
      startY: 78,
      head: [['Learning Area', 'Marks', 'Grade', 'Pts', "Teacher's Remark"]],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8.5, fontStyle: 'bold', halign: 'center' },
      styles: { fontSize: 8.5, cellPadding: 3, textColor: [30, 41, 59], lineColor: [226, 232, 240] },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 78, fontStyle: 'italic', textColor: [71, 85, 105] },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const finalY = doc.lastAutoTable.finalY;

    // Summary
    const totalMax   = reportData.subjects.length * 100;
    const totalPct   = totalMax > 0 ? Math.round((student.totalScore / totalMax) * 100) : 0;
    const overallGrd = getCBCGrade(student.avgPoints);

    doc.setFillColor(37, 99, 235);
    doc.rect(14, finalY + 3, 182, 11, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `TOTAL: ${student.totalScore}/${totalMax}   |   PERCENTAGE: ${totalPct}%   |   GRADE: ${overallGrd.level}   |   PTS: ${overallGrd.points}   |   POSITION: ${student.rank} of ${reportData.students.length}`,
      105, finalY + 10, { align: 'center' },
    );
    doc.setTextColor(0, 0, 0);

    // Grading scale
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('GRADING SCALE:', 14, finalY + 21);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'EE1 (90–100%, 8pts)   EE2 (75–89%, 7pts)   ME1 (58–74%, 6pts)   ME2 (41–57%, 5pts)   AE1 (31–40%, 4pts)   AE2 (21–30%, 3pts)   BE1 (11–20%, 2pts)   BE2 (0–10%, 1pt)',
      14, finalY + 26, { maxWidth: 182 },
    );

    // Remarks
    const remarksY = finalY + 34;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, remarksY, 88, 32, 2, 2, 'FD');
    doc.roundedRect(108, remarksY, 88, 32, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text("CLASS TEACHER'S REMARKS", 18, remarksY + 6);
    doc.text("PRINCIPAL'S REMARKS",     112, remarksY + 6);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(ctRemark,        18,  remarksY + 13, { maxWidth: 80 });
    doc.text(principalRemark, 112, remarksY + 13, { maxWidth: 80 });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.line(18,  remarksY + 28, 90,  remarksY + 28);
    doc.line(112, remarksY + 28, 184, remarksY + 28);
    doc.text('Class Teacher Signature', 18,  remarksY + 31);
    doc.text("Principal's Signature",   112, remarksY + 31);

    if (selectedTerm) {
      const datesY = remarksY + 38;
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(191, 219, 254);
      doc.roundedRect(14, datesY, 182, 14, 2, 2, 'FD');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 58, 138);
      const closingStr = selectedTerm.closing_date
        ? new Date(selectedTerm.closing_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'To be announced';
      const openingStr = selectedTerm.opening_date
        ? new Date(selectedTerm.opening_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'To be announced';
      doc.text(`School Closing Date: ${closingStr}`,   18,  datesY + 6);
      doc.text(`School Reopening Date: ${openingStr}`, 112, datesY + 6);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text('Wishing all learners and families a restful and rewarding break.', 105, datesY + 11, { align: 'center' });
    }

    doc.save(`ReportCard_${student.name.replace(/\s+/g, '_')}.pdf`);
  };

 /* ── PDF: All Report Cards ──────────────────────────────────── */
  const generateReportCards = () => {
    if (!reportData) return;
    const doc = new jsPDF() as jsPDFWithAutoTable;
    const exam  = reportData.exam;
    const grade = reportData.grade;

    reportData.students.forEach((student: ProcessedStudent, index: number) => {
      if (index > 0) doc.addPage();
      drawPremiumLetterhead(doc, 'STUDENT PROGRESS REPORT');

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 42, 182, 22, 2, 2, 'FD');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('NAME',     18, 49); doc.text('ADM NO.',   78, 49);
      doc.text('GRADE',   138, 49); doc.text('POSITION', 172, 49);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.text(student.name,                                  18,  56);
      doc.text(student.admission_number,                       78,  56);
      doc.text(grade?.grade_name || '—',                       138, 56);
      doc.text(`${student.rank}/${reportData.students.length}`, 172, 56);
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('EXAM', 18, 61);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.text(`${exam?.exam_name} — Term ${exam?.term}, ${exam?.year}`, 30, 61);

      const tableBody = reportData.subjects.map((sub: Subject) => {
        const mark      = student.marks.find(m => m.subject_id === sub.id);
        const score     = mark?.score ?? null;
        const gradeInfo = score !== null ? getCBCGrade(score) : null;
        const savedRemark = mark?.teacher_remark || '';
        const tRemark   = savedRemark || (score !== null ? defaultSubjectRemark(score) : '—');
        return [
          sub.subject_name,
          score !== null ? `${score}/100` : '—',
          gradeInfo ? gradeInfo.level : '—',
          gradeInfo ? String(gradeInfo.points) : '—',
          tRemark,
        ];
      });

      autoTable(doc, {
        startY: 68,
        head: [['Learning Area', 'Marks', 'Grade', 'Pts', "Teacher's Remark"]],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2.2, textColor: [30, 41, 59], lineColor: [226, 232, 240] },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold' },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
          3: { cellWidth: 14, halign: 'center' },
          4: { cellWidth: 78, fontStyle: 'italic' },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      const fy = doc.lastAutoTable.finalY;
      const totalMax = reportData.subjects.length * 100;
      const totalPct = totalMax > 0 ? Math.round((student.totalScore / totalMax) * 100) : 0;
      const og = getCBCGrade(student.avgPoints);

      doc.setFillColor(37, 99, 235);
      doc.rect(14, fy + 2, 182, 10, 'F');
      doc.setTextColor(255);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `TOTAL: ${student.totalScore}/${totalMax}   |   ${totalPct}%   |   GRADE: ${og.level}   |   PTS: ${og.points}`,
        105, fy + 8.5, { align: 'center' },
      );
      doc.setTextColor(0, 0, 0);

      const auto = buildRemarks(student.avgPoints);
      const ry = fy + 17;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, ry, 88, 28, 2, 2, 'FD');
      doc.roundedRect(108, ry, 88, 28, 2, 2, 'FD');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text("CLASS TEACHER'S REMARKS", 18,  ry + 5);
      doc.text("PRINCIPAL'S REMARKS",     112, ry + 5);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(auto.classTeacher, 18,  ry + 11, { maxWidth: 80 });
      doc.text(auto.principal,    112, ry + 11, { maxWidth: 80 });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.line(18,  ry + 25, 90,  ry + 25);
      doc.line(112, ry + 25, 184, ry + 25);
      doc.text('Class Teacher Signature', 18,  ry + 27.5);
      doc.text("Principal's Signature",   112, ry + 27.5);

      if (selectedTerm) {
        const dy = ry + 33;
        doc.setFillColor(239, 246, 255);
        doc.setDrawColor(191, 219, 254);
        doc.roundedRect(14, dy, 182, 12, 2, 2, 'FD');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 58, 138);
        const closingStr = selectedTerm.closing_date
          ? new Date(selectedTerm.closing_date).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
          : 'To be announced';
        const openingStr = selectedTerm.opening_date
          ? new Date(selectedTerm.opening_date).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
          : 'To be announced';
        doc.text(`Closing: ${closingStr}`,   18,  dy + 7);
        doc.text(`Reopening: ${openingStr}`, 112, dy + 7);
      }
    });

    doc.save(`Report_Cards_${grade?.grade_name}_${exam?.exam_name}.pdf`);
  };

  /* ── Excel + Rankings (unchanged behaviour) ─────────────────── */
  const exportToExcel = () => {
    if (!reportData) return;
    const headers = ['Rank', 'Name', 'Admission No', 'Class',
      ...reportData.subjects.map((s: Subject) => s.subject_name),
      'Total Score', 'Avg Points', 'Grade'];
    const rows = reportData.students.map((s: ProcessedStudent) => {
      const row: (string | number)[] = [s.rank || '-', s.name, s.admission_number, s.grade_name || reportData.grade.grade_name];
      reportData.subjects.forEach((sub: Subject) => {
        const mark = s.marks.find((m: Mark) => m.subject_id === sub.id);
        row.push(mark ? mark.score : '-');
      });
      row.push(s.totalScore, s.avgPoints.toFixed(1), s.grade);
      return row;
    });
    const schoolTitle   = (schoolInfo?.name || user?.school_name || 'EDU NEXA ANALYTICS').toUpperCase();
    const schoolAddress = schoolInfo?.address || '';
    const schoolMotto   = schoolInfo?.motto ? `Motto: ${schoolInfo.motto}` : '';
    const letterhead = [
      [schoolTitle], [schoolAddress], [schoolMotto], [''],
      [`CLASS RESULTS: ${reportData.grade.grade_name} - ${reportData.exam.exam_name}`],
      [''], headers,
    ];
    const ws = XLSX.utils.aoa_to_sheet([...letterhead, ...rows]);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: headers.length - 1 } },
    ];
    ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 15 }, { wch: 15 },
      ...reportData.subjects.map(() => ({ wch: 12 })), { wch: 12 }, { wch: 12 }, { wch: 10 }];
    ws['!pageSetup'] = { orientation: 'landscape' };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Class Results');
    XLSX.writeFile(wb, `Rankings_Report_${reportData.grade.grade_name}_${reportData.exam.exam_name}.xlsx`);
  };

  const generateRankingsReport = () => {
    if (!reportData) return;
    const doc = new jsPDF('l', 'mm', 'a4') as jsPDFWithAutoTable;
    const exam = reportData.exam; const grade = reportData.grade;
    const marginLeft = 15; const marginTop = 20;
    const schoolTitle   = (schoolInfo?.name || user?.school_name || 'SCHOOL').toUpperCase();
    const schoolAddress = schoolInfo?.address || '';
    const schoolMotto   = schoolInfo?.motto ? `Motto: ${schoolInfo.motto}` : '';
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(schoolTitle, 148, marginTop, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    if (schoolAddress) doc.text(schoolAddress, 148, marginTop + 6, { align: 'center' });
    doc.setFont('helvetica', 'italic');
    if (schoolMotto) doc.text(schoolMotto, 148, marginTop + 11, { align: 'center' });
    doc.line(marginLeft, marginTop + 15, 282, marginTop + 15);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('STUDENT RANKINGS REPORT', 148, marginTop + 23, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    const subY = marginTop + 30;
    doc.text(`Grade: ${grade.grade_name}`, marginLeft, subY);
    doc.text(`Exam: ${exam.exam_name}`, marginLeft, subY + 5);
    doc.text(`Term: ${exam.term} | Year: ${exam.year}`, 148, subY, { align: 'center' });
    doc.text(`Total Students: ${reportData.students.length}`, 282, subY, { align: 'right' });
    const validStudents = reportData.students.filter(s => s.marks && s.marks.length > 0);
    const headers = ['Rank', 'Name', 'Adm No', ...reportData.subjects.map((s: Subject) => s.subject_code), 'Total', 'Avg Pts', 'Grade'];
    const body = validStudents.map((s: ProcessedStudent) => {
      const row: (string | number)[] = [s.rank || '-', s.name, s.admission_number];
      reportData.subjects.forEach((sub: Subject) => {
        const mark = s.marks.find((m: Mark) => m.subject_id === sub.id);
        row.push(mark ? mark.score : '-');
      });
      row.push(s.totalScore, s.avgPoints.toFixed(1), s.grade); return row;
    });
    autoTable(doc, {
      startY: subY + 12, head: [headers], body,
      theme: 'grid', showHead: 'everyPage',
      styles: { fontSize: 8, cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 }, halign: 'center', lineWidth: 0.1 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center' },
      columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 50, halign: 'left' }, 2: { cellWidth: 20 } },
      margin: { left: marginLeft, right: marginLeft, top: marginTop, bottom: marginTop },
    });
    const fy = doc.lastAutoTable.finalY + 10;
    if (fy < 180) {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text('Class Teacher Signature: ________________________', marginLeft, fy);
      doc.text('Principal Signature: ________________________', 200, fy);
    }
    doc.save(`Rankings_Report_${grade.grade_name}_${exam.exam_name}.pdf`);
  };

  const printClassResults = () => {
    if (!reportData) return;
    const doc = new jsPDF('l', 'mm', 'a4') as jsPDFWithAutoTable;
    const exam = reportData.exam; const grade = reportData.grade;
    const marginLeft = 15; const marginTop = 20;
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`${(user?.school_name || 'SCHOOL').toUpperCase()} - CLASS RESULTS`, 148, marginTop, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`${grade?.grade_name} | ${exam?.exam_name} | Term ${exam?.term} ${exam?.year}`, 148, marginTop + 7, { align: 'center' });
    const validStudents = reportData.students.filter(s => s.marks && s.marks.length > 0);
    const headers = ['Rank', 'Name', 'Adm No', ...reportData.subjects.map((s: Subject) => s.subject_code), 'Total', 'Avg Pts', 'Grade', 'Pts'];
    const body = validStudents.map((s: ProcessedStudent) => {
      const row: (string | number)[] = [s.rank || '-', s.name, s.admission_number];
      reportData.subjects.forEach((sub: Subject) => {
        const mark = s.marks.find((m: Mark) => m.subject_id === sub.id);
        row.push(mark ? mark.score : '-');
      });
      row.push(s.totalScore, s.avgPoints.toFixed(1), s.grade, s.totalPoints); return row;
    });
    autoTable(doc, {
      startY: marginTop + 15, head: [headers], body, theme: 'grid', showHead: 'everyPage',
      styles: { fontSize: 8, cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 }, halign: 'center', lineWidth: 0.1 },
      headStyles: { fillColor: [15, 23, 42] },
      columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 50, halign: 'left' }, 2: { cellWidth: 20 } },
      margin: { left: marginLeft, right: marginLeft, top: marginTop, bottom: marginTop },
    });
    doc.save(`Class_Results_${selectedGrade}.pdf`);
  };

  /* ── UI ─────────────────────────────────────────────────────── */

  return (
    <div className="space-y-8">
      <Letterhead />

      {/* Hero */}
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900 to-blue-800 p-7 text-white shadow-xl">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-200">Academic Office</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">Reports &amp; Exports</h1>
            <p className="mt-1 text-sm text-blue-100/80">
              Generate premium report cards, class rankings, and data exports — ready to print or share.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 backdrop-blur">
            <Award size={18} className="text-blue-200" />
            <span className="text-xs font-bold uppercase tracking-wider text-blue-100">CBC Aligned</span>
          </div>
        </div>
      </header>

      {/* Controls */}
       <div className="grid grid-cols-1 gap-5 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm md:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Exam</label>
          <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-sm font-medium outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10">
            <option value="">Select exam</option>
            {exams.map(e => <option key={e.id} value={e.id}>{e.exam_name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Grade</label>
          <select value={selectedGrade} onChange={e => { setSelectedGrade(e.target.value); setSelectedStudent(null); }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-sm font-medium outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10">
            <option value="">Select grade</option>
            {grades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Term (for dates)</label>
          <select value={selectedTerm?.id || ''}
            onChange={e => setSelectedTerm(schoolTerms.find(t => t.id === Number(e.target.value)) || null)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-sm font-medium outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10">
            <option value="">No term selected</option>
            {schoolTerms.map(t => <option key={t.id} value={t.id}>{t.term_name} {t.year}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {([
          { key: 'class',      label: 'Class Results' },
          { key: 'reportcard', label: 'Report Cards' },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`-mb-px border-b-2 px-6 py-3 text-sm font-bold transition-all ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── CLASS RESULTS TAB ── */}
      {activeTab === 'class' && (
        reportData ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-5">
                  <div>
                    <h3 className="font-bold text-slate-900">Class Results Preview</h3>
                    <p className="text-xs text-slate-500">{reportData.grade.grade_name} · {reportData.exam.exam_name}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={exportToExcel}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100">
                      <FileSpreadsheet size={14}/> Excel
                    </button>
                    <button onClick={generateRankingsReport}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100">
                      <FileText size={14}/> Rankings PDF
                    </button>
                    <button onClick={printClassResults}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100">
                      <Printer size={14}/> Print
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="px-3 py-3">Rank</th>
                        <th className="px-3 py-3">Name</th>
                        {reportData.subjects.map((sub: Subject) => (
                          <th key={sub.id} className="px-3 py-3 text-center">{sub.subject_code}</th>
                        ))}
                        <th className="px-3 py-3 text-center">Total</th>
                        <th className="px-3 py-3 text-center">Avg Pts</th>
                        <th className="px-3 py-3 text-center">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData.students.map((s: ProcessedStudent) => (
                        <tr key={s.id} className="transition hover:bg-blue-50/40">
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ${
                              s.rank === 1 ? 'bg-amber-100 text-amber-700' :
                              s.rank === 2 ? 'bg-slate-200 text-slate-700' :
                              s.rank === 3 ? 'bg-orange-100 text-orange-700' :
                              'bg-slate-50 text-slate-500'
                            }`}>{s.rank}</span>
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-800">{s.name}</td>
                          {reportData.subjects.map((sub: Subject) => {
                            const mark = s.marks.find((m: Mark) => m.subject_id === sub.id);
                            return <td key={sub.id} className="px-3 py-2.5 text-center text-slate-600">{mark ? mark.score : '—'}</td>;
                          })}
                          <td className="px-3 py-2.5 text-center font-bold text-slate-800">{s.totalScore}</td>
                          <td className="px-3 py-2.5 text-center font-bold text-slate-700">{s.avgPoints.toFixed(1)}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700">{s.grade}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-900">
                  <FileText size={20} className="text-blue-600"/>
                  Download All Report Cards
                </h3>
                <p className="mb-4 text-sm text-slate-500">
                  Generate all {reportData.students.length} student report cards as a single, print-ready PDF.
                </p>
                <button onClick={generateReportCards}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition hover:shadow-blue-500/50">
                  <Download size={18}/> Download All ({reportData.students.length})
                </button>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-6 text-white shadow-lg">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-blue-200">School Letterhead Preview</h4>
                <div className="space-y-1 border-l-2 border-blue-400/60 pl-4 text-[11px] opacity-90">
                  <p className="text-sm font-black tracking-wide">{(schoolInfo?.name || user?.school_name || 'EDUNEXA SCHOOL').toUpperCase()}</p>
                  <p>{schoolInfo?.address || ''}</p>
                  <p className="italic text-blue-200">Motto: {schoolInfo?.motto || 'Strive to Excel'}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-16 text-center">
            <FileText size={48} className="mx-auto mb-4 text-slate-300"/>
            <h3 className="font-bold text-slate-900">Select parameters to generate reports</h3>
            <p className="mt-1 text-sm text-slate-500">Choose an exam and grade to load the results preview.</p>
          </div>
        )
      )}

      {/* ── REPORT CARDS TAB ── */}
      {activeTab === 'reportcard' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Student list */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <h3 className="mb-2 text-sm font-bold text-slate-800">Select Student</h3>
              <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                placeholder="Search by name or adm no…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"/>
            </div>
            <div className="max-h-[560px] divide-y divide-slate-50 overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">
                  {reportData ? 'No students found.' : 'Select an exam and grade first.'}
                </div>
              ) : filteredStudents.map(s => (
                <button key={s.id} onClick={() => setSelectedStudent(s)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                    selectedStudent?.id === s.id ? 'border-l-4 border-blue-600 bg-blue-50/70' : 'border-l-4 border-transparent hover:bg-slate-50'
                  }`}>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                    selectedStudent?.id === s.id ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {s.rank}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{s.name}</p>
                    <p className="text-[10px] text-slate-400">{s.admission_number}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-xs font-black text-blue-700">{s.grade}</p>
                    <p className="text-[10px] text-slate-400">{s.totalScore} pts</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview + editor */}
          <div className="space-y-5 lg:col-span-2">
            {selectedStudent && reportData ? (
              <>
                {/* Premium student header */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900 to-blue-700 p-6 text-white shadow-xl">
                  <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-400/20 blur-3xl" />
                  <div className="relative flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur">
                        <User size={26}/>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200">Student Report</p>
                        <h2 className="text-2xl font-black tracking-tight">{selectedStudent.name}</h2>
                        <p className="text-sm text-blue-100/80">
                          {reportData.grade?.grade_name} · Adm {selectedStudent.admission_number} · {selectedStudent.gender}
                        </p>
                        <p className="text-xs text-blue-200/80">
                          {reportData.exam?.exam_name} — Term {reportData.exam?.term}, {reportData.exam?.year}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/10 px-5 py-3 text-right ring-1 ring-white/20 backdrop-blur">
                      <p className="text-4xl font-black leading-none">{getCBCGrade(selectedStudent.avgPoints).level}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wider text-blue-200">Overall Grade</p>
                    </div>
                  </div>

                  {/* Stat chips */}
                  <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { icon: Target,     label: 'Total',      value: `${selectedStudent.totalScore}/${reportData.subjects.length * 100}` },
                      { icon: TrendingUp, label: 'Percentage', value: `${Math.round((selectedStudent.totalScore / (reportData.subjects.length * 100)) * 100)}%` },
                      { icon: Hash,       label: 'Position',   value: `${selectedStudent.rank} / ${reportData.students.length}` },
                      { icon: Award,      label: 'Avg Points', value: selectedStudent.avgPoints.toFixed(1) },
                    ].map(stat => (
                      <div key={stat.label} className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-200">
                          <stat.icon size={12}/> {stat.label}
                        </div>
                        <p className="mt-1 text-lg font-black">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Marks table — Grade Remarks column removed */}
                 <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
                  <div className="border-b border-slate-100 p-4">
                    <h3 className="text-sm font-bold text-slate-800">Learning Areas &amp; Marks</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="border-b bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Learning Area</th>
                          <th className="px-4 py-3 text-center">Marks</th>
                          <th className="px-4 py-3 text-center">Grade</th>
                          <th className="px-4 py-3 text-center">Points</th>
                          <th className="px-4 py-3">Teacher&apos;s Remark</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {reportData.subjects.map((sub: Subject) => {
                          const mark      = selectedStudent.marks.find(m => m.subject_id === sub.id);
                          const score     = mark?.score ?? null;
                          const gradeInfo = score !== null ? getCBCGrade(score) : null;
                          const placeholder = score !== null ? defaultSubjectRemark(score) : 'Add remark…';
                          return (
                            <tr key={sub.id} className="transition hover:bg-blue-50/30">
                              <td className="px-4 py-3 text-sm font-semibold text-slate-800">{sub.subject_name}</td>
                              <td className="px-4 py-3 text-center font-mono font-bold text-slate-700">
                                {score !== null ? `${score}/100` : '—'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {gradeInfo ? (
                                  <span className={`rounded-lg px-2 py-0.5 text-xs font-black ${
                                    gradeInfo.points >= 7 ? 'bg-emerald-100 text-emerald-700' :
                                    gradeInfo.points >= 5 ? 'bg-blue-100 text-blue-700' :
                                    gradeInfo.points >= 3 ? 'bg-amber-100 text-amber-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>{gradeInfo.level}</span>
                                ) : '—'}
                              </td>
                              <td className="px-4 py-3 text-center text-sm font-bold text-slate-600">
                                {gradeInfo?.points ?? '—'}
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  value={teacherRemarks[sub.id] || mark?.teacher_remark || ''}
                                  onChange={e => mark && handleTeacherRemark(sub.id, mark.id, e.target.value)}
                                  placeholder={placeholder}
                                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs italic text-slate-700 placeholder:not-italic placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                          <td className="px-4 py-3 text-sm font-black">TOTAL</td>
                          <td className="px-4 py-3 text-center font-mono font-black">
                            {selectedStudent.totalScore}/{reportData.subjects.length * 100}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="rounded-lg bg-white/20 px-2 py-0.5 text-xs font-black">
                              {getCBCGrade(selectedStudent.avgPoints).level}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-black">
                            {getCBCGrade(selectedStudent.avgPoints).points}
                          </td>
                          <td className="px-4 py-3 text-xs italic text-slate-300">
                            {Math.round((selectedStudent.totalScore / (reportData.subjects.length * 100)) * 100)}% overall
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Grading scale */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">CBC Grading Scale</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'EE1', range: '90–100%', pts: 8, color: 'bg-emerald-100 text-emerald-700' },
                      { label: 'EE2', range: '75–89%',  pts: 7, color: 'bg-emerald-100 text-emerald-700' },
                      { label: 'ME1', range: '58–74%',  pts: 6, color: 'bg-blue-100 text-blue-700' },
                      { label: 'ME2', range: '41–57%',  pts: 5, color: 'bg-blue-100 text-blue-700' },
                      { label: 'AE1', range: '31–40%',  pts: 4, color: 'bg-amber-100 text-amber-700' },
                      { label: 'AE2', range: '21–30%',  pts: 3, color: 'bg-amber-100 text-amber-700' },
                      { label: 'BE1', range: '11–20%',  pts: 2, color: 'bg-red-100 text-red-700' },
                      { label: 'BE2', range: '0–10%',   pts: 1, color: 'bg-red-100 text-red-700' },
                    ].map(g => (
                      <span key={g.label} className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${g.color}`}>
                        {g.label} ({g.range}) = {g.pts} pts
                      </span>
                    ))}
                  </div>
                </div>

                {/* CT & Principal Remarks */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-blue-700">Class Teacher&apos;s Remarks</p>
                    <textarea value={ctRemark} onChange={e => setCtRemark(e.target.value)} rows={4}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-2.5 text-sm leading-relaxed text-slate-700 transition focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"/>
                    <div className="mt-3 border-t border-dashed border-slate-200 pt-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">Class Teacher Signature: _______________</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-blue-700">Principal&apos;s Remarks</p>
                    <textarea value={principalRemark} onChange={e => setPrincipalRemark(e.target.value)} rows={4}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-2.5 text-sm leading-relaxed text-slate-700 transition focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"/>
                    <div className="mt-3 border-t border-dashed border-slate-200 pt-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">Principal Signature: _______________</p>
                    </div>
                  </div>
                </div>

                {/* Term dates */}
                {selectedTerm && (
                  <div className="grid gap-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">School Closing Date</p>
                      <p className="mt-0.5 text-sm font-bold text-blue-900">
                        {selectedTerm.closing_date
                          ? new Date(selectedTerm.closing_date).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
                          : 'To be announced'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">School Reopening Date</p>
                      <p className="mt-0.5 text-sm font-bold text-blue-900">
                        {selectedTerm.opening_date
                          ? new Date(selectedTerm.opening_date).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
                          : 'To be announced'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={handleSaveRemarks} disabled={savingRemarks}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-900 disabled:opacity-50">
                    {savingRemarks
                      ? <><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"/> Saving…</>
                      : remarksSaved
                      ? <><CheckCircle2 size={14}/> Saved</>
                      : <><Save size={14}/> Save Remarks</>}
                  </button>
                  <button onClick={() => generateSingleReportCard(selectedStudent)}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition hover:shadow-blue-500/50">
                    <Download size={14}/> Download PDF
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-16 text-center">
                <User size={40} className="mx-auto mb-3 text-slate-300"/>
                <p className="font-medium text-slate-400">Select a student from the list to view their report card.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;