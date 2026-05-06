import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { Exam, Grade, Subject, Mark, Student, School } from '../types';
import { getCBCGrade, getOverallGrade, getRemarks } from '../lib/utils';
import { fetchWithProxy } from '../lib/fetchProxy';
import { useData } from '../hooks/useData';
import { FileText, Download, Printer, FileSpreadsheet, User, ChevronDown, Save, CheckCircle2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Letterhead from '../components/Letterhead';
import { supabase } from '../lib/supabase';

interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable: { finalY: number };
}
import * as XLSX from 'xlsx';

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

interface TeacherRemark {
  subject_id: number;
  remark: string;
}

type ActiveTab = 'class' | 'reportcard';

const Reports = () => {
  const { user } = useAuth();
  const [selectedExam, setSelectedExam]     = useState('');
  const [selectedGrade, setSelectedGrade]   = useState('');
  const [reportData, setReportData]         = useState<ReportData | null>(null);
  const [activeTab, setActiveTab]           = useState<ActiveTab>('class');
  const [selectedStudent, setSelectedStudent] = useState<ProcessedStudent | null>(null);
  const [schoolTerms, setSchoolTerms]       = useState<SchoolTerm[]>([]);
  const [selectedTerm, setSelectedTerm]     = useState<SchoolTerm | null>(null);
  const [teacherRemarks, setTeacherRemarks] = useState<Record<number, string>>({});
  const [ctRemark, setCtRemark]             = useState('');
  const [principalRemark, setPrincipalRemark] = useState('');
  const [savingRemarks, setSavingRemarks]   = useState(false);
  const [remarksSaved, setRemarksSaved]     = useState(false);
  const [studentSearch, setStudentSearch]   = useState('');

  const examsQuery = useData<Exam>('exams-list-reports', 'exams', {
    select: 'id, exam_name, term, year',
    orderBy: { column: 'year', ascending: false }
  }, !!user?.school_id);

  const gradesQuery = useData<Grade>('grades-list-reports', 'grades', {
    select: 'id, grade_name',
    orderBy: { column: 'grade_name', ascending: true }
  }, !!user?.school_id);

  const schoolsQuery = useData<School>('school-info-reports', 'schools', {
    select: '*'
  }, !!user?.school_id);

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
    [schoolsQuery.data, user?.school_id]
  );

  // Load school terms
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
        fetchWithProxy('marks', { filters: { exam_id: Number(selectedExam) } }),
        fetchWithProxy('subjects')
      ]);

      const data = {
        students: studentsRes.data || [],
        marks:    marksRes.data || [],
        subjects: subjectsRes.data || []
      };

      const filteredSubjects = (data.subjects || []).filter((sub: Subject) => {
        const name = sub.subject_name.toLowerCase().trim();
        return !['science & technology', 'science and technology', 'music',
                 'art & craft', 'art and craft', 'physical education'].includes(name);
      });

      const processedStudents: ProcessedStudent[] = data.students.map((s: Student) => {
        const sMarks = data.marks.filter((m: Mark) =>
          m.student_id === s.id && filteredSubjects.some(sub => sub.id === m.subject_id)
        );
        const totalScore  = sMarks.reduce((acc: number, m: Mark) => acc + m.score, 0);
        const totalPoints = sMarks.reduce((acc: number, m: Mark) => acc + getCBCGrade(m.score).points, 0);
        const meanScore   = totalScore / 9;
        const avgPoints   = meanScore;
        return {
          ...s, marks: sMarks, totalScore, totalPoints,
          avgPoints, meanScore, grade: getOverallGrade(avgPoints)
        };
      }).sort((a: ProcessedStudent, b: ProcessedStudent) => b.totalScore - a.totalScore);

      processedStudents.forEach((s: ProcessedStudent, i: number) => { s.rank = i + 1; });

      setReportData({
        ...data,
        subjects: filteredSubjects,
        students: processedStudents,
        exam:  exams.find(e => e.id.toString() === selectedExam)!,
        grade: grades.find(g => g.id.toString() === selectedGrade)!
      });
      setSelectedStudent(null);
    } catch (error) {
      console.error('Reports fetch error:', error);
    }
  }, [selectedExam, selectedGrade, exams, grades]);

  useEffect(() => { Promise.resolve().then(() => loadReportData()); }, [loadReportData]);

  // Load teacher remarks when student selected
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

    // Load saved remarks
    supabase.from('report_remarks')
      .select('class_teacher_remark, principal_remark')
      .eq('student_id', selectedStudent.id)
      .eq('exam_id', Number(selectedExam))
      .maybeSingle()
      .then(({ data }) => {
        const pct = selectedStudent.totalScore > 0
          ? (selectedStudent.totalScore / (reportData?.subjects.length || 1) / 100) * 100
          : 0;
        const auto = getRemarks(selectedStudent.avgPoints);
        setCtRemark(data?.class_teacher_remark || auto.teacher);
        setPrincipalRemark(data?.principal_remark || auto.principal);
      });
  }, [selectedStudent, selectedExam]);

  // Save remarks
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

  // Update teacher remark for a subject
  const handleTeacherRemark = async (subjectId: number, markId: number, value: string) => {
    setTeacherRemarks(prev => ({ ...prev, [subjectId]: value }));
    await supabase.from('marks').update({ teacher_remark: value }).eq('id', markId);
  };

  // Filtered students for report card tab
  const filteredStudents = useMemo(() =>
    (reportData?.students || []).filter(s =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.admission_number.toLowerCase().includes(studentSearch.toLowerCase())
    ), [reportData, studentSearch]);

  // ── PDF: Individual Report Card ───────────────────────────
  const generateSingleReportCard = (student: ProcessedStudent) => {
    if (!reportData) return;
    const doc = new jsPDF() as jsPDFWithAutoTable;
    const exam  = reportData.exam;
    const grade = reportData.grade;

    const schoolTitle   = (schoolInfo?.name || user?.school_name || 'SCHOOL').toUpperCase();
    const schoolAddress = schoolInfo?.address || '';
    const schoolMotto   = schoolInfo?.motto ? `Motto: ${schoolInfo.motto}` : '';

    // ── Letterhead ──────────────────────────────────────────
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, 210, 38, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(schoolTitle, 105, 14, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (schoolAddress) doc.text(schoolAddress, 105, 21, { align: 'center' });
    if (schoolMotto)   doc.text(schoolMotto,   105, 27, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('STUDENT PROGRESS REPORT', 105, 34, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    // ── Student Details Box ──────────────────────────────────
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 42, 182, 30, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const col1x = 18, col2x = 75, col3x = 132;
    const row1y = 50, row2y = 58, row3y = 66;

    doc.setTextColor(100, 116, 139);
    doc.text('STUDENT NAME',    col1x, row1y - 2);
    doc.text('ADMISSION NO.',   col2x, row1y - 2);
    doc.text('GENDER',          col3x, row1y - 2);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(student.name,              col1x, row1y + 4);
    doc.text(student.admission_number,  col2x, row1y + 4);
    doc.text(student.gender || '—',     col3x, row1y + 4);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.text('GRADE / CLASS',   col1x, row2y + 2);
    doc.text('EXAM',            col2x, row2y + 2);
    doc.text('TERM & YEAR',     col3x, row2y + 2);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(grade?.grade_name || '—',          col1x, row2y + 8);
    doc.text(exam?.exam_name || '—',            col2x, row2y + 8);
    doc.text(`Term ${exam?.term}, ${exam?.year}`, col3x, row2y + 8);

    // Position
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('POSITION IN CLASS', col1x, row3y + 2);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(`${student.rank} out of ${reportData.students.length}`, col1x, row3y + 8);

    // ── Marks Table ──────────────────────────────────────────
    const tableBody = reportData.subjects.map((sub: Subject) => {
      const mark      = student.marks.find(m => m.subject_id === sub.id);
      const score     = mark?.score ?? null;
      const gradeInfo = score !== null ? getCBCGrade(score) : null;
      const tRemark   = teacherRemarks[sub.id] || mark?.teacher_remark || '';
      return [
        sub.subject_name,
        score !== null ? `${score}/100` : '—',
        gradeInfo ? gradeInfo.level : '—',
        gradeInfo ? String(gradeInfo.points) : '—',
        gradeInfo ? getGradeRemarks(gradeInfo.level) : '—',
        tRemark || '—',
      ];
    });

    autoTable(doc, {
      startY: 76,
      head: [['Learning Area', 'Marks', 'Grade', 'Pts', 'Grade Remarks', "Teacher's Remark"]],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 10, halign: 'center' },
        4: { cellWidth: 45, fontStyle: 'italic', textColor: [71, 85, 105] },
        5: { cellWidth: 45, fontStyle: 'italic', textColor: [71, 85, 105] },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const finalY = doc.lastAutoTable.finalY;

    // ── Summary Row ──────────────────────────────────────────
    const totalMax   = reportData.subjects.length * 100;
    const totalPct   = totalMax > 0 ? Math.round((student.totalScore / totalMax) * 100) : 0;
    const overallGrd = getCBCGrade(student.avgPoints);

    doc.setFillColor(30, 58, 138);
    doc.rect(14, finalY + 2, 182, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: ${student.totalScore}/${totalMax}   |   PERCENTAGE: ${totalPct}%   |   OVERALL GRADE: ${overallGrd.level}   |   POINTS: ${overallGrd.points}`, 105, finalY + 8.5, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    // ── Grading Scale Reference ──────────────────────────────
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('GRADING SCALE:', 14, finalY + 18);
    doc.setFont('helvetica', 'normal');
    const scaleText = 'EE1(90-100%,8pts)  EE2(75-89%,7pts)  ME1(58-74%,6pts)  ME2(41-57%,5pts)  AE1(31-40%,4pts)  AE2(21-30%,3pts)  BE1(11-20%,2pts)  BE2(0-10%,1pt)';
    doc.text(scaleText, 14, finalY + 23, { maxWidth: 182 });

    // ── Remarks ──────────────────────────────────────────────
    const remarksY = finalY + 32;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, remarksY, 88, 30, 2, 2, 'FD');
    doc.roundedRect(108, remarksY, 88, 30, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text("CLASS TEACHER'S REMARKS", 18, remarksY + 6);
    doc.text("PRINCIPAL'S REMARKS", 112, remarksY + 6);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(ctRemark, 18, remarksY + 13, { maxWidth: 80 });
    doc.text(principalRemark, 112, remarksY + 13, { maxWidth: 80 });

    // Signature lines
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.line(18, remarksY + 27, 90, remarksY + 27);
    doc.line(112, remarksY + 27, 184, remarksY + 27);
    doc.text('Class Teacher Signature', 18, remarksY + 30);
    doc.text("Principal's Signature", 112, remarksY + 30);

    // ── Term Dates ───────────────────────────────────────────
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
      doc.text(`School Closing Date: ${closingStr}`, 18, datesY + 6);
      doc.text(`School Reopening Date: ${openingStr}`, 112, datesY + 6);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text('Wishing all students and families a wonderful holiday!', 105, datesY + 11, { align: 'center' });
    }

    doc.save(`ReportCard_${student.name.replace(/\s+/g, '_')}.pdf`);
  };

  // ── PDF: All Report Cards ─────────────────────────────────
  const generateReportCards = () => {
    if (!reportData) return;
    const doc = new jsPDF() as jsPDFWithAutoTable;
    const exam  = reportData.exam;
    const grade = reportData.grade;
    const schoolTitle   = (schoolInfo?.name || user?.school_name || 'SCHOOL').toUpperCase();
    const schoolAddress = schoolInfo?.address || '';
    const schoolMotto   = schoolInfo?.motto ? `Motto: ${schoolInfo.motto}` : '';

    reportData.students.forEach((student: ProcessedStudent, index: number) => {
      if (index > 0) doc.addPage();

      // Letterhead
      doc.setFillColor(30, 58, 138);
      doc.rect(0, 0, 210, 38, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(schoolTitle, 105, 14, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      if (schoolAddress) doc.text(schoolAddress, 105, 21, { align: 'center' });
      if (schoolMotto)   doc.text(schoolMotto,   105, 27, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('STUDENT PROGRESS REPORT', 105, 34, { align: 'center' });
      doc.setTextColor(0, 0, 0);

      // Student details
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(200, 200, 200);
      doc.roundedRect(14, 42, 182, 22, 2, 2, 'FD');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('NAME',         18, 49); doc.text('ADM NO.',   75, 49);
      doc.text('GRADE',       132, 49); doc.text('POSITION', 162, 49);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.text(student.name,             18, 56);
      doc.text(student.admission_number, 75, 56);
      doc.text(grade?.grade_name || '—', 132, 56);
      doc.text(`${student.rank}/${reportData.students.length}`, 162, 56);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('EXAM', 18, 62);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.text(`${exam?.exam_name} — Term ${exam?.term}, ${exam?.year}`, 18, 62);

      // Marks table
      const tableBody = reportData.subjects.map((sub: Subject) => {
        const mark      = student.marks.find(m => m.subject_id === sub.id);
        const score     = mark?.score ?? null;
        const gradeInfo = score !== null ? getCBCGrade(score) : null;
        return [
          sub.subject_name,
          score !== null ? `${score}/100` : '—',
          gradeInfo ? gradeInfo.level : '—',
          gradeInfo ? String(gradeInfo.points) : '—',
          gradeInfo ? getGradeRemarks(gradeInfo.level) : '—',
          mark?.teacher_remark || '—',
        ];
      });

      autoTable(doc, {
        startY: 68,
        head: [['Learning Area', 'Marks', 'Grade', 'Pts', 'Grade Remarks', "Teacher's Remark"]],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59] },
        columnStyles: {
          0: { cellWidth: 40, fontStyle: 'bold' },
          1: { cellWidth: 18, halign: 'center' },
          2: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
          3: { cellWidth: 10, halign: 'center' },
          4: { cellWidth: 45, fontStyle: 'italic' },
          5: { cellWidth: 45, fontStyle: 'italic' },
        },
      });

      const fy = doc.lastAutoTable.finalY;
      const totalMax = reportData.subjects.length * 100;
      const totalPct = totalMax > 0 ? Math.round((student.totalScore / totalMax) * 100) : 0;
      const og = getCBCGrade(student.avgPoints);

      // Summary
      doc.setFillColor(30, 58, 138);
      doc.rect(14, fy + 2, 182, 9, 'F');
      doc.setTextColor(255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`TOTAL: ${student.totalScore}/${totalMax}  |  ${totalPct}%  |  GRADE: ${og.level}  |  POINTS: ${og.points}`, 105, fy + 8, { align: 'center' });
      doc.setTextColor(0, 0, 0);

      // Auto remarks
      const auto = getRemarks(student.avgPoints);
      const ry = fy + 16;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, ry, 88, 26, 2, 2, 'FD');
      doc.roundedRect(108, ry, 88, 26, 2, 2, 'FD');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text("CLASS TEACHER'S REMARKS", 18, ry + 5);
      doc.text("PRINCIPAL'S REMARKS",     112, ry + 5);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(auto.teacher,    18,  ry + 11, { maxWidth: 80 });
      doc.text(auto.principal,  112, ry + 11, { maxWidth: 80 });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.line(18, ry + 24, 90,  ry + 24);
      doc.line(112, ry + 24, 184, ry + 24);
      doc.text('Class Teacher Signature', 18, ry + 27);
      doc.text("Principal's Signature",  112, ry + 27);

      // Term dates
      if (selectedTerm) {
        const dy = ry + 32;
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
        doc.text(`Closing: ${closingStr}`, 18, dy + 7);
        doc.text(`Reopening: ${openingStr}`, 112, dy + 7);
      }
    });

    doc.save(`Report_Cards_${grade?.grade_name}_${exam?.exam_name}.pdf`);
  };

  // ── Excel Export ──────────────────────────────────────────
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
      [''], headers
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
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center' },
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
      headStyles: { fillColor: [30, 58, 138] },
      columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 50, halign: 'left' }, 2: { cellWidth: 20 } },
      margin: { left: marginLeft, right: marginLeft, top: marginTop, bottom: marginTop },
    });
    doc.save(`Class_Results_${selectedGrade}.pdf`);
  };

  return (
    <div className="space-y-6">
      <Letterhead />

      <header>
        <h1 className="text-2xl font-bold text-slate-900">Reports & Exports</h1>
        <p className="text-slate-500 text-sm">Generate report cards, class lists, and data exports.</p>
      </header>

      {/* Controls */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase">Exam</label>
          <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">Select Exam</option>
            {exams.map(e => <option key={e.id} value={e.id}>{e.exam_name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase">Grade</label>
          <select value={selectedGrade} onChange={e => { setSelectedGrade(e.target.value); setSelectedStudent(null); }}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">Select Grade</option>
            {grades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase">Term (for dates)</label>
          <select value={selectedTerm?.id || ''} onChange={e => setSelectedTerm(schoolTerms.find(t => t.id === Number(e.target.value)) || null)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
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
            className={`px-5 py-2.5 text-sm font-bold border-b-2 -mb-px transition-all ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── CLASS RESULTS TAB ───────────────────────────────── */}
      {activeTab === 'class' && (
        reportData ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-bold text-slate-900">Preview: Class Results</h3>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={exportToExcel}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100">
                      <FileSpreadsheet size={14}/> Excel
                    </button>
                    <button onClick={generateRankingsReport}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100">
                      <FileText size={14}/> Rankings PDF
                    </button>
                    <button onClick={printClassResults}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100">
                      <Printer size={14}/> Print
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                        <th className="px-3 py-2">Rank</th>
                        <th className="px-3 py-2">Name</th>
                        {reportData.subjects.map((sub: Subject) => (
                          <th key={sub.id} className="px-3 py-2">{sub.subject_code}</th>
                        ))}
                        <th className="px-3 py-2">Total</th>
                        <th className="px-3 py-2">Avg Pts</th>
                        <th className="px-3 py-2">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData.students.map((s: ProcessedStudent) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-bold">{s.rank}</td>
                          <td className="px-3 py-2 font-medium">{s.name}</td>
                          {reportData.subjects.map((sub: Subject) => {
                            const mark = s.marks.find((m: Mark) => m.subject_id === sub.id);
                            return <td key={sub.id} className="px-3 py-2">{mark ? mark.score : '-'}</td>;
                          })}
                          <td className="px-3 py-2 font-bold">{s.totalScore}</td>
                          <td className="px-3 py-2 font-bold">{s.avgPoints.toFixed(1)}</td>
                          <td className="px-3 py-2">
                            <span className="font-bold text-blue-600">{s.grade}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <FileText size={20} className="text-blue-600"/>
                  Download All Report Cards
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Generate all {reportData.students.length} student report cards as a single PDF.
                </p>
                <button onClick={generateReportCards}
                  className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-200">
                  <Download size={18}/> Download All ({reportData.students.length})
                </button>
              </div>
              <div className="bg-blue-900 p-6 rounded-xl text-white">
                <h4 className="font-bold mb-2">School Letterhead</h4>
                <div className="text-[10px] space-y-1 opacity-80 border-l-2 border-blue-400 pl-4">
                  <p className="font-bold text-xs opacity-100">{(schoolInfo?.name || user?.school_name || 'EDUNEXA SCHOOL').toUpperCase()}</p>
                  <p>{schoolInfo?.address || ''}</p>
                  <p className="italic">Motto: {schoolInfo?.motto || 'Strive to Excel'}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
            <FileText size={48} className="mx-auto text-slate-300 mb-4"/>
            <h3 className="text-slate-900 font-bold">Select parameters to generate reports</h3>
            <p className="text-slate-500 text-sm mt-1">Choose an exam and grade to load the results preview.</p>
          </div>
        )
      )}

      {/* ── REPORT CARDS TAB ────────────────────────────────── */}
      {activeTab === 'reportcard' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Student list */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm mb-2">Select Student</h3>
              <div className="relative">
                <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                  placeholder="Search by name or adm no…"
                  className="w-full pl-3 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-400"/>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[500px] divide-y divide-slate-50">
              {filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  {reportData ? 'No students found.' : 'Select an exam and grade first.'}
                </div>
              ) : filteredStudents.map(s => (
                <button key={s.id} onClick={() => setSelectedStudent(s)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3 ${
                    selectedStudent?.id === s.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    selectedStudent?.id === s.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {s.rank}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                    <p className="text-[10px] text-slate-400">{s.admission_number}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-xs font-bold text-blue-600">{s.grade}</p>
                    <p className="text-[10px] text-slate-400">{s.totalScore}pts</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Report card preview + editor */}
          <div className="lg:col-span-2 space-y-4">
            {selectedStudent && reportData ? (
              <>
                {/* Student header */}
                <div className="bg-blue-700 rounded-xl p-5 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                        <User size={24}/>
                      </div>
                      <div>
                        <h2 className="text-xl font-black">{selectedStudent.name}</h2>
                        <p className="text-blue-200 text-sm">
                          {reportData.grade?.grade_name} · Adm: {selectedStudent.admission_number} · {selectedStudent.gender}
                        </p>
                        <p className="text-blue-200 text-sm">
                          {reportData.exam?.exam_name} — Term {reportData.exam?.term}, {reportData.exam?.year}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black">{getCBCGrade(selectedStudent.avgPoints).level}</p>
                      <p className="text-blue-200 text-sm">{selectedStudent.totalScore} pts total</p>
                      <p className="text-blue-200 text-xs">Position {selectedStudent.rank} of {reportData.students.length}</p>
                    </div>
                  </div>
                </div>

                {/* Marks table with teacher remarks */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 text-sm">Learning Areas & Marks</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="text-xs text-slate-400 uppercase font-bold border-b bg-slate-50">
                        <tr>
                          <th className="px-4 py-3">Learning Area</th>
                          <th className="px-4 py-3 text-center">Marks</th>
                          <th className="px-4 py-3 text-center">Grade</th>
                          <th className="px-4 py-3 text-center">Points</th>
                          <th className="px-4 py-3">Grade Remarks</th>
                          <th className="px-4 py-3">Teacher's Remark</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {reportData.subjects.map((sub: Subject) => {
                          const mark      = selectedStudent.marks.find(m => m.subject_id === sub.id);
                          const score     = mark?.score ?? null;
                          const gradeInfo = score !== null ? getCBCGrade(score) : null;
                          return (
                            <tr key={sub.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-semibold text-slate-800 text-sm">{sub.subject_name}</td>
                              <td className="px-4 py-3 text-center font-mono font-bold text-slate-700">
                                {score !== null ? `${score}/100` : '—'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {gradeInfo ? (
                                  <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                                    gradeInfo.points >= 7 ? 'bg-emerald-100 text-emerald-700' :
                                    gradeInfo.points >= 5 ? 'bg-blue-100 text-blue-700' :
                                    gradeInfo.points >= 3 ? 'bg-amber-100 text-amber-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {gradeInfo.level}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-slate-600 text-sm">
                                {gradeInfo?.points ?? '—'}
                              </td>
                              <td className="px-4 py-3 text-slate-500 text-xs italic">
                                {gradeInfo ? getGradeRemarks(gradeInfo.level) : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  value={teacherRemarks[sub.id] || mark?.teacher_remark || ''}
                                  onChange={e => mark && handleTeacherRemark(sub.id, mark.id, e.target.value)}
                                  placeholder="Add remark…"
                                  className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Totals */}
                      <tfoot>
                        <tr className="bg-slate-800 text-white">
                          <td className="px-4 py-3 font-black text-sm">TOTAL</td>
                          <td className="px-4 py-3 text-center font-mono font-black">
                            {selectedStudent.totalScore}/{reportData.subjects.length * 100}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs font-black px-2 py-0.5 bg-white/20 rounded-lg">
                              {getCBCGrade(selectedStudent.avgPoints).level}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-black">
                            {getCBCGrade(selectedStudent.avgPoints).points}
                          </td>
                          <td colSpan={2} className="px-4 py-3 text-slate-300 text-xs italic">
                            {Math.round((selectedStudent.totalScore / (reportData.subjects.length * 100)) * 100)}% overall
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Grading scale */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">CBC Grading Scale</p>
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
                      <span key={g.label} className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border border-current/20 ${g.color}`}>
                        {g.label} ({g.range}) = {g.pts}pts
                      </span>
                    ))}
                  </div>
                </div>

                {/* Class teacher & principal remarks */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Class Teacher's Remarks</p>
                    <textarea value={ctRemark} onChange={e => setCtRemark(e.target.value)} rows={3}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"/>
                    <div className="mt-3 border-t border-dashed border-slate-200 pt-2">
                      <p className="text-[10px] text-slate-400">Class Teacher Signature: _______________</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Principal's Remarks</p>
                    <textarea value={principalRemark} onChange={e => setPrincipalRemark(e.target.value)} rows={3}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"/>
                    <div className="mt-3 border-t border-dashed border-slate-200 pt-2">
                      <p className="text-[10px] text-slate-400">Principal Signature: _______________</p>
                    </div>
                  </div>
                </div>

                {/* Term dates */}
                {selectedTerm && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-blue-400 uppercase">School Closing Date</p>
                      <p className="text-sm font-bold text-blue-800 mt-0.5">
                        {selectedTerm.closing_date
                          ? new Date(selectedTerm.closing_date).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
                          : 'To be announced'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-blue-400 uppercase">School Reopening Date</p>
                      <p className="text-sm font-bold text-blue-800 mt-0.5">
                        {selectedTerm.opening_date
                          ? new Date(selectedTerm.opening_date).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
                          : 'To be announced'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <button onClick={handleSaveRemarks} disabled={savingRemarks}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50">
                    {savingRemarks
                      ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full"/> Saving…</>
                      : remarksSaved
                      ? <><CheckCircle2 size={14}/> Saved!</>
                      : <><Save size={14}/> Save Remarks</>
                    }
                  </button>
                  <button onClick={() => generateSingleReportCard(selectedStudent)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all">
                    <Download size={14}/> Download PDF
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-16 text-center">
                <User size={40} className="mx-auto text-slate-300 mb-3"/>
                <p className="text-slate-400 font-medium">Select a student from the list to view their report card.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Grade remarks lookup
function getGradeRemarks(level: string): string {
  const map: Record<string, string> = {
    EE1: 'Exceeds Expectations with Distinction',
    EE2: 'Exceeds Expectations',
    ME1: 'Meets Expectations with Distinction',
    ME2: 'Meets Expectations',
    AE1: 'Approaches Expectations',
    AE2: 'Approaches Expectations (Below Average)',
    BE1: 'Below Expectations',
    BE2: 'Well Below Expectations',
  };
  return map[level] || '—';
}

export default Reports;