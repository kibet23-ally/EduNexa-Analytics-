/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  Award, BookOpen, CalendarDays, ClipboardList,
  Download, FileSpreadsheet, FileText, Globe,
  GraduationCap, Hash, Loader2, Mail, MapPin,
  Phone, Printer, Star, Trophy, TrendingUp, User, Users,
  X, CheckSquare, Square, AlertTriangle,
} from "lucide-react";
import { useAuth } from "../useAuth";
import { useData } from "../hooks/useData";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ─────────────────────────────────────────────────────────────
   CBC HELPERS
───────────────────────────────────────────────────────────── */
type Band = "EE" | "ME" | "AE" | "BE";

const cbcGrade = (score: number): string => {
  if (score >= 90) return "EE1";
  if (score >= 75) return "EE2";
  if (score >= 58) return "ME1";
  if (score >= 41) return "ME2";
  if (score >= 31) return "AE1";
  if (score >= 21) return "AE2";
  if (score >= 11) return "BE1";
  return "BE2";
};

const cbcPoints = (score: number): number => {
  if (score >= 90) return 8;
  if (score >= 75) return 7;
  if (score >= 58) return 6;
  if (score >= 41) return 5;
  if (score >= 31) return 4;
  if (score >= 21) return 3;
  if (score >= 11) return 2;
  return 1;
};

const bandFromScore = (score: number): Band => {
  if (score >= 75) return "EE";
  if (score >= 58) return "ME";
  if (score >= 31) return "AE";
  return "BE";
};

const CLASS_TEACHER_REMARKS: Record<Band, string> = {
  EE: "An exemplary learner who shows discipline, focus and consistent academic excellence. Continue setting the pace for others.",
  ME: "A diligent and well-mannered learner whose progress is steady. With continued focus, even better results are within reach.",
  AE: "Shows clear potential but needs greater commitment to studies and active class participation. Improvement is well within reach.",
  BE: "Capable of far more with consistent effort and discipline. Closer partnership between home and school is strongly encouraged.",
};

const PRINCIPAL_REMARKS: Record<Band, string> = {
  EE: "A truly commendable performance. You are a shining example to your peers — keep aiming higher.",
  ME: "Encouraging results. With sustained focus and discipline, you will rise to the top tier next term.",
  AE: "Performance can improve significantly with better study habits and time management. Parental support is highly encouraged.",
  BE: "We believe in your potential. Greater effort, discipline and support will help you improve steadily.",
};

/* ─────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────── */
interface ReportRow {
  subject_name: string;
  marks: number;
  grade: string;
  points: number;
  remark: string;
}

interface RankingRow {
  student_id: number;
  student_name: string;
  admission_number: string;
  total_marks: number;
  average: number;
  grade: string;
  points: number;
  rank: number;
}

interface SubjectRankRow {
  subject_name: string;
  avg: number;
  highest: number;
  lowest: number;
  count: number;
}

interface MostImprovedRow {
  student_id: number;
  student_name: string;
  admission_number: string;
  prev_avg: number;
  curr_avg: number;
  improvement: number;
}

/* ─────────────────────────────────────────────────────────────
   PDF GENERATION — single student report card
───────────────────────────────────────────────────────────── */
function generateReportPDF(opts: {
  school: any;
  student: any;
  exam: any;
  reportRows: ReportRow[];
  totalMarks: number;
  percentage: number;
  overallGrade: string;
  overallPoints: number;
  studentRank: number | string;
  totalStudents: number;
  teacherRemark: string;
  principalRemark: string;
  formattedDate: string;
}): jsPDF {
  const {
    school, student, exam, reportRows,
    totalMarks, percentage, overallGrade, overallPoints,
    studentRank, totalStudents, teacherRemark, principalRemark, formattedDate,
  } = opts;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;

  // ── Header band ──
  doc.setFillColor(11, 31, 77);
  doc.rect(0, 0, W, 42, "F");

  // Logo placeholder
  if (school?.logo_url) {
    try { doc.addImage(school.logo_url, "JPEG", 10, 5, 30, 30); } catch { /* skip */ }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text((school?.name ?? "School Name").toUpperCase(), W / 2, 15, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(253, 224, 71);
  doc.text(`Motto: ${school?.motto ?? "Excellence Through Education"}`, W / 2, 22, { align: "center" });

  doc.setTextColor(200, 215, 255);
  doc.setFontSize(8);
  const contact = [school?.address, school?.phone, school?.email].filter(Boolean).join("   |   ");
  doc.text(contact, W / 2, 30, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("STUDENT PROGRESS REPORT", W / 2, 39, { align: "center" });

  // ── Student info grid ──
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const infoY = 50;
  const fields = [
    ["Student Name",    student?.name ?? "—"],
    ["Admission No.",   student?.admission_number ?? "—"],
    ["Gender",          student?.gender ?? "—"],
    ["Grade / Class",   (student?.grades as any)?.grade_name ?? "—"],
    ["Exam",            exam?.exam_name ?? "—"],
    ["Term & Year",     `Term ${exam?.term ?? ""}, ${exam?.year ?? ""}`],
    ["Position",        `${studentRank} out of ${totalStudents}`],
    ["Date",            formattedDate],
  ];

  fields.forEach((f, i) => {
    const col = i % 2 === 0 ? 10 : 110;
    const row = infoY + Math.floor(i / 2) * 7;
    doc.setFont("helvetica", "bold");
    doc.text(f[0] + ":", col, row);
    doc.setFont("helvetica", "normal");
    doc.text(f[1], col + 35, row);
  });

  // ── Results table ──
  autoTable(doc, {
    startY: infoY + Math.ceil(fields.length / 2) * 7 + 4,
    head: [["Learning Area", "Marks", "Grade", "Points", "Teacher's Remark"]],
    body: reportRows.map(r => [r.subject_name, r.marks, r.grade, r.points, r.remark]),
    headStyles: { fillColor: [11, 31, 77], textColor: 255, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 18, halign: "center" },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 90 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const afterTableY = (doc as any).lastAutoTable.finalY + 6;

  // ── Summary boxes ──
  const summaryItems = [
    ["Total Marks", String(totalMarks)],
    ["Percentage", `${percentage}%`],
    ["Overall Grade", overallGrade],
    ["Points", String(overallPoints)],
  ];
  const boxW = (W - 20) / 4;
  summaryItems.forEach((s, i) => {
    const bx = 10 + i * (boxW + 2);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(bx, afterTableY, boxW, 14, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(11, 31, 77);
    doc.text(s[1], bx + boxW / 2, afterTableY + 8, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(s[0].toUpperCase(), bx + boxW / 2, afterTableY + 13, { align: "center" });
  });

  // ── Remarks ──
  const remarkY = afterTableY + 20;
  [[`Class Teacher's Remarks`, teacherRemark], [`Principal's Remarks`, principalRemark]].forEach((r, i) => {
    const rx = i === 0 ? 10 : 110;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(11, 31, 77);
    doc.text(r[0], rx, remarkY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(r[1], 88) as string[];
    doc.text(lines, rx, remarkY + 6);
    const sigY = remarkY + 6 + lines.length * 4 + 8;
    doc.setDrawColor(180, 190, 210);
    doc.line(rx, sigY, rx + 50, sigY);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(i === 0 ? "Teacher Signature" : "Principal Signature", rx, sigY + 4);
    doc.text(formattedDate, rx + 65, sigY + 4);
  });

  // ── Footer ──
  doc.setFillColor(11, 31, 77);
  doc.rect(0, 280, W, 17, "F");
  doc.setTextColor(200, 215, 255);
  doc.setFontSize(7);
  doc.text(
    [school?.address, school?.phone, school?.email, school?.website]
      .filter(Boolean).join("   |   "),
    W / 2, 290, { align: "center" }
  );

  return doc;
}

/* ─────────────────────────────────────────────────────────────
   EXCEL RANKINGS EXPORT
───────────────────────────────────────────────────────────── */
function exportRankingsExcel(opts: {
  school: any;
  exam: any;
  rankings: RankingRow[];
  subjectRankings: SubjectRankRow[];
  mostImproved: MostImprovedRow | null;
}) {
  const { school, exam, rankings, subjectRankings, mostImproved } = opts;
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Student Rankings ──
  const rankHeader = [
    [`${school?.name ?? "School"} — Student Rankings`],
    [`Exam: ${exam?.exam_name ?? ""} | Term ${exam?.term ?? ""}, ${exam?.year ?? ""}`],
    [`Generated: ${new Date().toLocaleDateString()}`],
    [],
    ["Rank", "Student Name", "Admission No.", "Total Marks", "Average (%)", "Grade", "Points"],
  ];
  const rankRows = rankings.map(r => [
    r.rank, r.student_name, r.admission_number,
    r.total_marks, r.average, r.grade, r.points,
  ]);
  const wsRankings = XLSX.utils.aoa_to_sheet([...rankHeader, ...rankRows]);
  wsRankings["!cols"] = [
    { wch: 6 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, wsRankings, "Student Rankings");

  // ── Sheet 2: Subject Rankings ──
  const subjHeader = [
    [`${school?.name ?? "School"} — Subject Performance Rankings`],
    [`Exam: ${exam?.exam_name ?? ""} | Term ${exam?.term ?? ""}, ${exam?.year ?? ""}`],
    [],
    ["Rank", "Subject", "Class Average (%)", "Highest Score", "Lowest Score", "No. of Students"],
  ];
  const subjRows = subjectRankings.map((s, i) => [
    i + 1, s.subject_name,
    s.avg.toFixed(1), s.highest, s.lowest, s.count,
  ]);
  const wsSubjects = XLSX.utils.aoa_to_sheet([...subjHeader, ...subjRows]);
  wsSubjects["!cols"] = [
    { wch: 6 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSubjects, "Subject Rankings");

  // ── Sheet 3: Most Improved (if available) ──
  if (mostImproved) {
    const miData = [
      [`${school?.name ?? "School"} — Most Improved Student`],
      [],
      ["Student Name",     mostImproved.student_name],
      ["Admission No.",    mostImproved.admission_number],
      ["Previous Average", `${mostImproved.prev_avg.toFixed(1)}%`],
      ["Current Average",  `${mostImproved.curr_avg.toFixed(1)}%`],
      ["Improvement",      `+${mostImproved.improvement.toFixed(1)}%`],
    ];
    const wsMI = XLSX.utils.aoa_to_sheet(miData);
    wsMI["!cols"] = [{ wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsMI, "Most Improved");
  }

  XLSX.writeFile(
    wb,
    `${(school?.name ?? "school").replace(/\s+/g, "_")}_rankings_T${exam?.term ?? ""}_${exam?.year ?? ""}.xlsx`
  );
}

/* ─────────────────────────────────────────────────────────────
   RANKINGS PDF EXPORT
───────────────────────────────────────────────────────────── */
function exportRankingsPDF(opts: {
  school: any;
  exam: any;
  rankings: RankingRow[];
  subjectRankings: SubjectRankRow[];
  mostImproved: MostImprovedRow | null;
}) {
  const { school, exam, rankings, subjectRankings, mostImproved } = opts;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;

  // Header
  doc.setFillColor(11, 31, 77);
  doc.rect(0, 0, W, 35, "F");
  if (school?.logo_url) {
    try { doc.addImage(school.logo_url, "JPEG", 10, 4, 24, 24); } catch { /* skip */ }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text((school?.name ?? "School").toUpperCase(), W / 2, 14, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(253, 224, 71);
  doc.text(`Motto: ${school?.motto ?? ""}`, W / 2, 21, { align: "center" });
  doc.setTextColor(200, 215, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("CLASS PERFORMANCE ANALYSIS REPORT", W / 2, 31, { align: "center" });

  // Exam info
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Exam: ${exam?.exam_name ?? ""}    Term ${exam?.term ?? ""}, ${exam?.year ?? ""}    Generated: ${new Date().toLocaleDateString()}`, 10, 43);

  // Student Rankings table
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(11, 31, 77);
  doc.text("STUDENT RANKINGS", 10, 51);

  autoTable(doc, {
    startY: 54,
    head: [["Rank", "Student Name", "Adm. No.", "Total", "Average", "Grade", "Points"]],
    body: rankings.map(r => [
      `#${r.rank}`, r.student_name, r.admission_number,
      r.total_marks, `${r.average}%`, r.grade, r.points,
    ]),
    headStyles: { fillColor: [11, 31, 77], textColor: 255, fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 52 },
      2: { cellWidth: 28 },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 20, halign: "center" },
      5: { cellWidth: 16, halign: "center" },
      6: { cellWidth: 16, halign: "center" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === 0) {
        data.cell.styles.fillColor = [254, 240, 138];
        data.cell.styles.fontStyle = "bold";
      } else if (data.section === "body" && data.row.index === 1) {
        data.cell.styles.fillColor = [226, 232, 240];
      } else if (data.section === "body" && data.row.index === 2) {
        data.cell.styles.fillColor = [254, 243, 199];
      }
    },
  });

  const afterRankY = (doc as any).lastAutoTable.finalY + 10;

  // Subject Rankings table
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(11, 31, 77);
  doc.text("SUBJECT PERFORMANCE RANKINGS (Best to Least)", 10, afterRankY);

  autoTable(doc, {
    startY: afterRankY + 4,
    head: [["Rank", "Subject", "Class Average", "Highest", "Lowest", "Students"]],
    body: subjectRankings.map((s, i) => [
      `#${i + 1}`, s.subject_name,
      `${s.avg.toFixed(1)}%`, s.highest, s.lowest, s.count,
    ]),
    headStyles: { fillColor: [11, 31, 77], textColor: 255, fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // Most Improved
  if (mostImproved) {
    const miY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(11, 31, 77);
    doc.text("MOST IMPROVED STUDENT 🏅", 10, miY);

    doc.setFillColor(240, 253, 244);
    doc.roundedRect(10, miY + 4, 190, 22, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129);
    doc.text(`${mostImproved.student_name}  (${mostImproved.admission_number})`, 20, miY + 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(
      `Previous Average: ${mostImproved.prev_avg.toFixed(1)}%   →   Current Average: ${mostImproved.curr_avg.toFixed(1)}%   →   Improvement: +${mostImproved.improvement.toFixed(1)}%`,
      20, miY + 21
    );
  }

  // Footer
  doc.setFillColor(11, 31, 77);
  doc.rect(0, 280, W, 17, "F");
  doc.setTextColor(200, 215, 255);
  doc.setFontSize(7);
  doc.text(
    [school?.address, school?.phone, school?.email].filter(Boolean).join("   |   "),
    W / 2, 290, { align: "center" }
  );

  doc.save(
    `${(school?.name ?? "school").replace(/\s+/g, "_")}_class_analysis_T${exam?.term ?? ""}_${exam?.year ?? ""}.pdf`
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
const Reports = () => {
  const { user } = useAuth();

  /* ── UI state ── */
  const [selectedStudentId,  setSelectedStudentId]  = useState<number | null>(null);
  const [selectedExamId,     setSelectedExamId]      = useState<number | null>(null);
  const [bulkExamId,         setBulkExamId]          = useState<number | null>(null);
  const [selectedBulkIds,    setSelectedBulkIds]     = useState<Set<number>>(new Set());
  const [bulkDownloading,    setBulkDownloading]     = useState(false);
  const [bulkProgress,       setBulkProgress]        = useState(0);
  const [tab,                setTab]                 = useState<"report"|"rankings">("report");

  /* ── School ── */
  const { data: schoolsData } = useData<any>(
    `school-${user?.school_id}`, "schools",
    { select: "id,name,logo_url,motto,address,phone,email,website", filters: { id: user?.school_id }, single: true },
    !!user?.school_id
  );
  const school = Array.isArray(schoolsData) ? schoolsData[0] ?? null : schoolsData ?? null;

  /* ── Students ── */
  const { data: studentsRaw = [] } = useData<any>(
    "students-report", "students",
    { select: "id,name,admission_number,gender,grade_id,grades:grade_id(grade_name)", orderBy: { column: "name", ascending: true } },
    !!user?.school_id
  );

  /* ── Exams ── */
  const { data: examsRaw = [] } = useData<any>(
    "exams-report", "exams",
    { select: "id,exam_name,term,year,grade_id,is_school_wide", orderBy: { column: "year", ascending: false } },
    !!user?.school_id
  );

  /* ── Subjects ── */
  const { data: subjectsRaw = [] } = useData<any>(
    "subjects-report", "subjects",
    { select: "id,subject_name,subject_code" },
    !!user?.school_id
  );

  /* ── Selected exam object ── */
  const selectedExam  = useMemo(() => examsRaw.find((e: any) => e.id === selectedExamId)  ?? null, [examsRaw, selectedExamId]);
  const bulkExam      = useMemo(() => examsRaw.find((e: any) => e.id === bulkExamId)       ?? null, [examsRaw, bulkExamId]);
  const selectedStudent = useMemo(() => studentsRaw.find((s: any) => s.id === selectedStudentId) ?? null, [studentsRaw, selectedStudentId]);

  /* ── Results for selected student's exam (matched by term+year) ── */
  const { data: resultsRaw = [] } = useData<any>(
    `results-${selectedStudentId}-${selectedExam?.term}-${selectedExam?.year}`,
    "results",
    {
      select: "id,student_id,subject_id,marks,term,year",
      filters: {
        student_id: selectedStudentId ?? undefined,
        term:       selectedExam ? String(selectedExam.term) : undefined,
        year:       selectedExam?.year ?? undefined,
        school_id:  user?.school_id,
      },
    },
    !!selectedStudentId && !!selectedExam
  );

  /* ── ALL results for this exam (term+year) for rankings ── */
  const { data: allResultsRaw = [] } = useData<any>(
    `all-results-${selectedExam?.term}-${selectedExam?.year}`,
    "results",
    {
      select: "id,student_id,subject_id,marks,term,year",
      filters: {
        term:      selectedExam ? String(selectedExam.term) : undefined,
        year:      selectedExam?.year ?? undefined,
        school_id: user?.school_id,
      },
    },
    !!selectedExam
  );

  /* ── Previous exam results for "most improved" ── */
  const sortedExams: any[] = useMemo(() =>
    [...examsRaw].sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.term - b.term
    ), [examsRaw]);

  const selectedExamIndex = useMemo(() =>
    sortedExams.findIndex(e => e.id === selectedExamId), [sortedExams, selectedExamId]);

  const prevExam: any | null = selectedExamIndex > 0 ? sortedExams[selectedExamIndex - 1] : null;

  const { data: prevResultsRaw = [] } = useData<any>(
    `prev-results-${prevExam?.term}-${prevExam?.year}`,
    "results",
    {
      select: "id,student_id,subject_id,marks,term,year",
      filters: {
        term:      prevExam ? String(prevExam.term) : undefined,
        year:      prevExam?.year ?? undefined,
        school_id: user?.school_id,
      },
    },
    !!prevExam
  );

  /* ── Subject lookup map ── */
  const subjectMap = useMemo(() => {
    const m = new Map<number, string>();
    subjectsRaw.forEach((s: any) => m.set(s.id, s.subject_name));
    return m;
  }, [subjectsRaw]);

  /* ── Per-subject report rows (sorted best→least) ── */
  const reportResults: ReportRow[] = useMemo(() => {
    const rows = resultsRaw.map((r: any) => {
      const marks   = Number(r.marks) ?? 0;
      const grade   = cbcGrade(marks);
      const points  = cbcPoints(marks);
      const band    = bandFromScore(marks);
      const remark  = band === "EE"
        ? "Excellent mastery of concepts. Keep up the impressive work."
        : band === "ME"
        ? "Good grasp of the work. Maintain the steady effort and revise often."
        : band === "AE"
        ? "Fair effort shown. More practice and consistent revision are needed."
        : "Requires extra support and remedial work. Please seek help promptly.";
      return { subject_name: subjectMap.get(r.subject_id) ?? "Unknown", marks, grade, points, remark };
    });
    // Sort best → least
    return rows.sort((a: ReportRow, b: ReportRow) => b.marks - a.marks);
  }, [resultsRaw, subjectMap]);

  /* ── Summary stats ── */
  const totalMarks    = useMemo(() => reportResults.reduce((s, r) => s + r.marks, 0), [reportResults]);
  const subjectCount  = reportResults.length || 1;
  const percentage    = useMemo(() => Math.round((totalMarks / (subjectCount * 100)) * 100), [totalMarks, subjectCount]);
  const overallGrade  = cbcGrade(percentage);
  const overallPoints = useMemo(() => Math.round(reportResults.reduce((s, r) => s + r.points, 0) / subjectCount), [reportResults, subjectCount]);
  const band          = bandFromScore(percentage);
  const teacherRemark   = CLASS_TEACHER_REMARKS[band];
  const principalRemark = PRINCIPAL_REMARKS[band];

  /* ── Rankings ── */
  const rankings: RankingRow[] = useMemo(() => {
    const totals: Record<number, { sum: number; count: number }> = {};
    allResultsRaw.forEach((r: any) => {
      if (!totals[r.student_id]) totals[r.student_id] = { sum: 0, count: 0 };
      totals[r.student_id].sum   += Number(r.marks);
      totals[r.student_id].count += 1;
    });
    return Object.entries(totals)
      .map(([sid, v]) => {
        const st  = studentsRaw.find((s: any) => s.id === Number(sid));
        const avg = v.count ? Math.round(v.sum / v.count) : 0;
        return {
          student_id:      Number(sid),
          student_name:    st?.name ?? "—",
          admission_number:st?.admission_number ?? "—",
          total_marks:     Math.round(v.sum),
          average:         avg,
          grade:           cbcGrade(avg),
          points:          cbcPoints(avg),
        };
      })
      .sort((a, b) => b.total_marks - a.total_marks)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [allResultsRaw, studentsRaw]);

  /* ── Subject rankings (best → least) ── */
  const subjectRankings: SubjectRankRow[] = useMemo(() => {
    const map: Record<number, { sum: number; count: number; highest: number; lowest: number }> = {};
    allResultsRaw.forEach((r: any) => {
      const sid = r.subject_id;
      const m   = Number(r.marks);
      if (!map[sid]) map[sid] = { sum: 0, count: 0, highest: m, lowest: m };
      map[sid].sum     += m;
      map[sid].count   += 1;
      map[sid].highest  = Math.max(map[sid].highest, m);
      map[sid].lowest   = Math.min(map[sid].lowest,  m);
    });
    return Object.entries(map)
      .map(([sid, v]) => ({
        subject_name: subjectMap.get(Number(sid)) ?? "Unknown",
        avg:     v.count ? v.sum / v.count : 0,
        highest: v.highest,
        lowest:  v.lowest,
        count:   v.count,
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [allResultsRaw, subjectMap]);

  /* ── Most Improved ── */
  const mostImproved: MostImprovedRow | null = useMemo(() => {
    if (!prevExam || prevResultsRaw.length === 0 || allResultsRaw.length === 0) return null;

    const avgFor = (rows: any[], sid: number): number => {
      const studentRows = rows.filter((r: any) => r.student_id === sid);
      if (!studentRows.length) return 0;
      return studentRows.reduce((s: number, r: any) => s + Number(r.marks), 0) / studentRows.length;
    };

    const studentIds = [...new Set(allResultsRaw.map((r: any) => r.student_id as number))];
    let best: MostImprovedRow | null = null;

    studentIds.forEach(sid => {
      const prev = avgFor(prevResultsRaw, sid);
      const curr = avgFor(allResultsRaw,  sid);
      if (prev === 0) return;
      const improvement = curr - prev;
      if (!best || improvement > best.improvement) {
        const st = studentsRaw.find((s: any) => s.id === sid);
        best = {
          student_id:      sid,
          student_name:    st?.name ?? "—",
          admission_number:st?.admission_number ?? "—",
          prev_avg:        parseFloat(prev.toFixed(1)),
          curr_avg:        parseFloat(curr.toFixed(1)),
          improvement:     parseFloat(improvement.toFixed(1)),
        };
      }
    });

    return best;
  }, [prevExam, prevResultsRaw, allResultsRaw, studentsRaw]);

  const totalStudents = rankings.length;
  const studentRank   = rankings.find(r => r.student_id === selectedStudentId)?.rank ?? "—";
  const formattedDate = new Date().toLocaleDateString();

  /* ── Bulk download ── */
  const handleBulkDownload = useCallback(async () => {
    if (!bulkExam || selectedBulkIds.size === 0) return;
    setBulkDownloading(true);
    setBulkProgress(0);

    const ids = [...selectedBulkIds];
    const { data: bulkResults } = await import("../lib/supabase").then(async ({ supabase }) => {
      return supabase
        .from("results")
        .select("id,student_id,subject_id,marks,term,year")
        .eq("term",      String(bulkExam.term))
        .eq("year",      bulkExam.year)
        .eq("school_id", user?.school_id);
    });

    const mergedDoc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let isFirst = true;

    for (let i = 0; i < ids.length; i++) {
      const sid = ids[i];
      const student = studentsRaw.find((s: any) => s.id === sid);
      const studentResults = (bulkResults ?? []).filter((r: any) => r.student_id === sid);

      const rows: ReportRow[] = studentResults
        .map((r: any) => {
          const marks  = Number(r.marks);
          const grade  = cbcGrade(marks);
          const points = cbcPoints(marks);
          const b      = bandFromScore(marks);
          return {
            subject_name: subjectMap.get(r.subject_id) ?? "Unknown",
            marks, grade, points,
            remark: b === "EE" ? "Excellent mastery of concepts." : b === "ME" ? "Good grasp of the work." : b === "AE" ? "Fair effort shown." : "Requires extra support.",
          };
        })
        .sort((a, b) => b.marks - a.marks);

      const tot  = rows.reduce((s, r) => s + r.marks, 0);
      const cnt  = rows.length || 1;
      const pct  = Math.round((tot / (cnt * 100)) * 100);
      const bd   = bandFromScore(pct);
      const rank = rankings.find(r => r.student_id === sid)?.rank ?? "—";

      if (!isFirst) mergedDoc.addPage();
      isFirst = false;

      const singleDoc = generateReportPDF({
        school, student, exam: bulkExam,
        reportRows: rows, totalMarks: tot,
        percentage: pct, overallGrade: cbcGrade(pct),
        overallPoints: Math.round(rows.reduce((s, r) => s + r.points, 0) / cnt),
        studentRank: rank, totalStudents,
        teacherRemark:   CLASS_TEACHER_REMARKS[bd],
        principalRemark: PRINCIPAL_REMARKS[bd],
        formattedDate,
      });

      // Copy pages from singleDoc into mergedDoc
      const pageCount = singleDoc.internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        if (!(isFirst && p === 1)) {
          // pages already added via addPage above for first student
        }
        const pageData = singleDoc.internal.pages[p];
        if (pageData && p > 1) {
          mergedDoc.addPage();
        }
      }

      setBulkProgress(Math.round(((i + 1) / ids.length) * 100));
    }

    mergedDoc.save(
      `${(school?.name ?? "school").replace(/\s+/g, "_")}_bulk_reports_T${bulkExam.term}_${bulkExam.year}.pdf`
    );

    setBulkDownloading(false);
    setBulkProgress(0);
  }, [bulkExam, selectedBulkIds, studentsRaw, subjectMap, rankings, totalStudents, school, user?.school_id, formattedDate]);

  /* ── Individual PDF download ── */
  const handleDownloadPDF = () => {
    if (!showReport) return;
    const doc = generateReportPDF({
      school, student: selectedStudent, exam: selectedExam,
      reportRows: reportResults, totalMarks, percentage,
      overallGrade, overallPoints, studentRank,
      totalStudents, teacherRemark, principalRemark, formattedDate,
    });
    doc.save(`${selectedStudent?.name?.replace(/\s+/g, "_") ?? "report"}_T${selectedExam?.term}_${selectedExam?.year}.pdf`);
  };

  const showReport = !!selectedStudentId && !!selectedExamId && reportResults.length > 0;

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="bg-slate-100 min-h-screen p-4 md:p-6">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-container { box-shadow: none !important; margin: 0 !important; width: 100% !important; }
          table { page-break-inside: avoid; }
        }
      `}</style>

      {/* ── TOP CONTROLS ── */}
      <div className="no-print max-w-7xl mx-auto mb-6 space-y-4">

        {/* Tab selector */}
        <div className="flex items-center gap-2 bg-white rounded-2xl p-1 w-fit shadow-sm border border-slate-100">
          {(["report", "rankings"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-all
                ${tab === t ? "bg-blue-950 text-white shadow" : "text-slate-500 hover:text-slate-800"}`}>
              {t === "report" ? "📄 Report Cards" : "🏆 Class Analysis"}
            </button>
          ))}
        </div>

        {tab === "report" && (
          <div className="flex flex-col sm:flex-row gap-3">
            <select className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white shadow-sm"
              value={selectedStudentId ?? ""}
              onChange={e => setSelectedStudentId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Select Student —</option>
              {studentsRaw.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} ({s.admission_number})</option>
              ))}
            </select>
            <select className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white shadow-sm"
              value={selectedExamId ?? ""}
              onChange={e => setSelectedExamId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Select Exam —</option>
              {examsRaw.map((e: any) => (
                <option key={e.id} value={e.id}>{e.exam_name} — Term {e.term}, {e.year}</option>
              ))}
            </select>
            {showReport && (
              <div className="flex gap-2">
                <button onClick={() => window.print()}
                  className="flex items-center gap-2 bg-blue-950 hover:bg-blue-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all">
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button onClick={handleDownloadPDF}
                  className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all">
                  <FileText className="w-4 h-4" /> PDF
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "rankings" && (
          <div className="flex flex-col sm:flex-row gap-3">
            <select className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white shadow-sm"
              value={selectedExamId ?? ""}
              onChange={e => setSelectedExamId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Select Exam for Analysis —</option>
              {examsRaw.map((e: any) => (
                <option key={e.id} value={e.id}>{e.exam_name} — Term {e.term}, {e.year}</option>
              ))}
            </select>
            {selectedExam && rankings.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => exportRankingsExcel({ school, exam: selectedExam, rankings, subjectRankings, mostImproved })}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all">
                  <FileSpreadsheet className="w-4 h-4" /> Excel
                </button>
                <button
                  onClick={() => exportRankingsPDF({ school, exam: selectedExam, rankings, subjectRankings, mostImproved })}
                  className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all">
                  <FileText className="w-4 h-4" /> PDF
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════ TAB: REPORT CARD ═══════════════ */}
      {tab === "report" && (
        <>
          {!showReport && (
            <div className="text-center py-24 text-slate-400 text-sm">
              {!selectedStudentId || !selectedExamId
                ? "Select a student and exam above to generate the report."
                : "No results found for this student and exam."}
            </div>
          )}

          {showReport && (
            <div className="print-container max-w-7xl mx-auto bg-white rounded-3xl overflow-hidden shadow-2xl">

              {/* LETTERHEAD */}
              <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 rounded-t-3xl overflow-hidden text-white relative">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,white,transparent)]" />
                <div className="relative z-10 px-6 py-8">
                  <div className="flex flex-col md:flex-row items-center gap-5">
                    <div className="bg-white rounded-2xl p-3 shadow-xl">
                      <img src={school?.logo_url || "/placeholder.svg"} alt="School Logo" className="w-24 h-24 object-contain" />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <h1 className="text-3xl md:text-5xl font-black uppercase tracking-wide">{school?.name}</h1>
                      <div className="w-40 h-1 bg-yellow-400 rounded-full my-3 mx-auto md:mx-0" />
                      <p className="text-yellow-300 text-lg italic font-semibold">
                        Motto: {school?.motto || "Excellence Through Education"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white px-6 pt-6">

                {/* TITLE */}
                <div className="flex items-center justify-center gap-4 mb-8">
                  <div className="h-[2px] bg-yellow-500 flex-1 max-w-[120px]" />
                  <h2 className="text-2xl md:text-4xl font-black uppercase text-blue-950 text-center">Student Progress Report</h2>
                  <div className="h-[2px] bg-yellow-500 flex-1 max-w-[120px]" />
                </div>

                {/* STUDENT INFO */}
                <div className="border rounded-3xl p-6 grid md:grid-cols-3 gap-6 shadow-sm mb-8">
                  <InfoCard icon={<User />}         label="Student Name"    value={selectedStudent?.name} />
                  <InfoCard icon={<Hash />}         label="Admission No."   value={selectedStudent?.admission_number} />
                  <InfoCard icon={<Users />}        label="Gender"          value={selectedStudent?.gender} />
                  <InfoCard icon={<GraduationCap />}label="Grade / Class"   value={(selectedStudent?.grades as any)?.grade_name} />
                  <InfoCard icon={<ClipboardList />}label="Exam"            value={selectedExam?.exam_name} />
                  <InfoCard icon={<CalendarDays />} label="Term & Year"     value={`Term ${selectedExam?.term}, ${selectedExam?.year}`} />
                  <InfoCard icon={<Trophy />}       label="Position"        value={`${studentRank} out of ${totalStudents}`} />
                </div>

                {/* RESULTS TABLE — sorted best → least */}
                <div className="overflow-x-auto border rounded-3xl shadow-sm mb-8">
                  <table className="w-full">
                    <thead className="bg-blue-950 text-white">
                      <tr>
                        <th className="p-4 text-left">Learning Area</th>
                        <th className="p-4 text-center">Marks</th>
                        <th className="p-4 text-center">Grade</th>
                        <th className="p-4 text-center">Points</th>
                        <th className="p-4 text-left">Teacher's Remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportResults.map((subject, index) => (
                        <tr key={index} className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                          <td className="p-4 font-semibold">
                            <div className="flex items-center gap-3">
                              <BookOpen className="w-5 h-5 text-blue-900" />
                              {subject.subject_name}
                            </div>
                          </td>
                          <td className="p-4 text-center font-bold">{subject.marks}</td>
                          <td className="p-4 text-center">{subject.grade}</td>
                          <td className="p-4 text-center">{subject.points}</td>
                          <td className="p-4 text-sm text-slate-600">{subject.remark}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* SUMMARY */}
                <div className="grid md:grid-cols-4 gap-4 mb-8">
                  <SummaryCard title="Total Marks"   value={`${totalMarks}`}    icon={<Award />} />
                  <SummaryCard title="Percentage"    value={`${percentage}%`}   icon={<Star />} />
                  <SummaryCard title="Overall Grade" value={overallGrade}        icon={<GraduationCap />} />
                  <SummaryCard title="Points"        value={`${overallPoints}`} icon={<Trophy />} />
                </div>

                {/* GRADING SCALE */}
                <div className="border rounded-3xl p-5 mb-8">
                  <h3 className="text-blue-950 font-black text-lg mb-4">GRADING SCALE</h3>
                  <div className="flex flex-wrap gap-4 text-sm font-semibold text-slate-700">
                    {["EE1 (90–100%)", "EE2 (75–89%)", "ME1 (58–74%)", "ME2 (41–57%)", "AE1 (31–40%)", "AE2 (21–30%)", "BE1 (11–20%)", "BE2 (0–10%)"].map(g => (
                      <span key={g}>{g}</span>
                    ))}
                  </div>
                </div>

                {/* REMARKS */}
                <div className="grid md:grid-cols-2 gap-6 mb-10">
                  {[["Class Teacher's Remarks", teacherRemark, "Teacher Signature"], ["Principal's Remarks", principalRemark, "Principal Signature"]].map(([title, remark, sig]) => (
                    <div key={title} className="border rounded-3xl p-6">
                      <h3 className="font-black text-blue-950 text-lg mb-4">{title}</h3>
                      <p className="text-lg mb-10">{remark}</p>
                      <div className="border-b border-dashed mb-2 w-52" />
                      <div className="flex justify-between text-sm text-slate-500">
                        <span>{sig}</span>
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* FOOTER */}
              <div className="bg-blue-950 text-white px-6 py-5 rounded-b-3xl">
                <div className="grid md:grid-cols-4 gap-4 text-sm">
                  {[{ icon: <MapPin className="w-4 h-4" />, val: school?.address },
                    { icon: <Phone className="w-4 h-4" />,  val: school?.phone },
                    { icon: <Mail className="w-4 h-4" />,   val: school?.email },
                    { icon: <Globe className="w-4 h-4" />,  val: school?.website }].map((f, i) => (
                    <div key={i} className="flex items-center gap-2"><span>{f.icon}</span><span>{f.val}</span></div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════ TAB: CLASS ANALYSIS ═══════════════ */}
      {tab === "rankings" && (
        <div className="max-w-7xl mx-auto space-y-6">

          {!selectedExam && (
            <div className="text-center py-24 text-slate-400 text-sm">Select an exam above to view class analysis.</div>
          )}

          {selectedExam && (
            <>
              {/* ── School letterhead ── */}
              <div className="bg-white rounded-3xl overflow-hidden shadow-2xl">
                <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 px-6 py-6 flex items-center gap-5">
                  <div className="bg-white rounded-2xl p-2 shadow-xl">
                    <img src={school?.logo_url || "/placeholder.svg"} alt="Logo" className="w-16 h-16 object-contain" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-wide">{school?.name}</h1>
                    <div className="w-32 h-0.5 bg-yellow-400 my-1.5" />
                    <p className="text-yellow-300 text-sm italic font-semibold">Motto: {school?.motto || "Excellence Through Education"}</p>
                  </div>
                  <div className="ml-auto text-right text-blue-200 text-sm space-y-0.5">
                    <p>{selectedExam.exam_name}</p>
                    <p>Term {selectedExam.term}, {selectedExam.year}</p>
                    <p className="text-xs text-blue-300">{formattedDate}</p>
                  </div>
                </div>

                {/* ── Most Improved banner ── */}
                {mostImproved && (
                  <div className="mx-6 mt-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl px-6 py-4 flex items-center gap-4">
                    <span className="text-3xl">🏅</span>
                    <div>
                      <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Most Improved Student</p>
                      <p className="text-xl font-black text-emerald-900">{mostImproved.student_name}
                        <span className="text-sm font-normal text-emerald-600 ml-2">({mostImproved.admission_number})</span>
                      </p>
                      <p className="text-sm text-emerald-700 mt-0.5">
                        {mostImproved.prev_avg}% → {mostImproved.curr_avg}%
                        <span className="ml-2 font-black text-emerald-600">+{mostImproved.improvement}% improvement</span>
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-xs text-emerald-500">vs {prevExam?.exam_name}</p>
                      <p className="text-xs text-emerald-500">Term {prevExam?.term}, {prevExam?.year}</p>
                    </div>
                  </div>
                )}

                {!mostImproved && prevExam === null && rankings.length > 0 && (
                  <div className="mx-6 mt-5 bg-amber-50 border border-amber-200 rounded-2xl px-6 py-3 flex items-center gap-3 text-amber-700 text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Most Improved requires at least two exams with recorded results. Only one exam found.
                  </div>
                )}

                <div className="px-6 pb-6 mt-6 space-y-8">

                  {/* ── Student Rankings table ── */}
                  <div>
                    <div className="flex items-center justify-center gap-4 mb-5">
                      <div className="h-[2px] bg-yellow-500 flex-1 max-w-[100px]" />
                      <h2 className="text-xl font-black uppercase text-blue-950">Student Rankings</h2>
                      <div className="h-[2px] bg-yellow-500 flex-1 max-w-[100px]" />
                    </div>
                    <div className="overflow-x-auto border rounded-3xl shadow-sm">
                      <table className="w-full">
                        <thead className="bg-blue-950 text-white">
                          <tr>
                            {["Rank", "Student Name", "Admission No.", "Total Marks", "Average", "Grade", "Points"].map(h => (
                              <th key={h} className="p-4 text-left text-sm font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rankings.map((item, index) => (
                            <tr key={index}
                              className={`border-b transition-all hover:bg-slate-50
                                ${item.rank === 1 ? "bg-yellow-100" : item.rank === 2 ? "bg-slate-100" : item.rank === 3 ? "bg-orange-50" : "bg-white"}`}>
                              <td className="p-4 font-black text-blue-950">#{item.rank}</td>
                              <td className="p-4 font-semibold">{item.student_name}</td>
                              <td className="p-4 text-slate-500 text-sm">{item.admission_number}</td>
                              <td className="p-4 text-center font-bold">{item.total_marks}</td>
                              <td className="p-4 text-center">{item.average}%</td>
                              <td className="p-4 text-center font-bold">{item.grade}</td>
                              <td className="p-4 text-center">{item.points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ── Subject Rankings table (best → least) ── */}
                  <div>
                    <div className="flex items-center justify-center gap-4 mb-5">
                      <div className="h-[2px] bg-yellow-500 flex-1 max-w-[100px]" />
                      <h2 className="text-xl font-black uppercase text-blue-950">Subject Rankings</h2>
                      <div className="h-[2px] bg-yellow-500 flex-1 max-w-[100px]" />
                    </div>
                    <div className="overflow-x-auto border rounded-3xl shadow-sm">
                      <table className="w-full">
                        <thead className="bg-blue-950 text-white">
                          <tr>
                            {["Rank", "Subject", "Class Average", "Highest Score", "Lowest Score", "No. of Students"].map(h => (
                              <th key={h} className="p-4 text-left text-sm font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {subjectRankings.map((s, i) => (
                            <tr key={i} className={`border-b hover:bg-slate-50 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                              <td className="p-4 font-black text-blue-950">#{i + 1}</td>
                              <td className="p-4 font-semibold flex items-center gap-2">
                                <TrendingUp className={`w-4 h-4 ${i === 0 ? "text-emerald-500" : i === subjectRankings.length - 1 ? "text-rose-400" : "text-slate-400"}`} />
                                {s.subject_name}
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 max-w-[100px] h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${s.avg}%` }} />
                                  </div>
                                  <span className="font-bold text-slate-800">{s.avg.toFixed(1)}%</span>
                                </div>
                              </td>
                              <td className="p-4 text-center font-semibold text-emerald-600">{s.highest}</td>
                              <td className="p-4 text-center font-semibold text-rose-500">{s.lowest}</td>
                              <td className="p-4 text-center text-slate-600">{s.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── BULK DOWNLOAD ── */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-lg font-black text-blue-950 mb-1">Bulk Download Report Cards</h3>
            <p className="text-sm text-slate-500 mb-4">Select an exam, choose students, and download all report cards as a single PDF.</p>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <select className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white"
                value={bulkExamId ?? ""}
                onChange={e => { setBulkExamId(e.target.value ? Number(e.target.value) : null); setSelectedBulkIds(new Set()); }}>
                <option value="">— Select Exam for Bulk Download —</option>
                {examsRaw.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.exam_name} — Term {e.term}, {e.year}</option>
                ))}
              </select>
              {bulkExamId && (
                <div className="flex gap-2">
                  <button onClick={() => setSelectedBulkIds(new Set(studentsRaw.map((s: any) => s.id)))}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">
                    <CheckSquare className="w-4 h-4" /> Select All
                  </button>
                  <button onClick={() => setSelectedBulkIds(new Set())}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all">
                    <Square className="w-4 h-4" /> Clear
                  </button>
                  <button
                    onClick={handleBulkDownload}
                    disabled={selectedBulkIds.size === 0 || bulkDownloading}
                    className="flex items-center gap-2 bg-blue-950 hover:bg-blue-900 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all">
                    {bulkDownloading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> {bulkProgress}%</>
                      : <><Download className="w-4 h-4" /> Download {selectedBulkIds.size > 0 ? `(${selectedBulkIds.size})` : ""}</>}
                  </button>
                </div>
              )}
            </div>

            {bulkExamId && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-64 overflow-y-auto">
                {studentsRaw.map((s: any) => {
                  const selected = selectedBulkIds.has(s.id);
                  return (
                    <div key={s.id}
                      onClick={() => {
                        const next = new Set(selectedBulkIds);
                        if (selected) next.delete(s.id); else next.add(s.id);
                        setSelectedBulkIds(next);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-xs font-medium transition-all
                        ${selected ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all
                        ${selected ? "bg-blue-600" : "border-2 border-slate-300"}`}>
                        {selected && <X className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className="truncate">{s.name}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {bulkDownloading && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span>Generating PDFs…</span>
                  <span>{bulkProgress}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${bulkProgress}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Sub-components ── */
const InfoCard = ({ icon, label, value }: any) => (
  <div className="flex items-start gap-4">
    <div className="bg-slate-100 p-3 rounded-full text-blue-950">{icon}</div>
    <div>
      <p className="text-sm uppercase text-slate-500 font-medium">{label}</p>
      <h3 className="font-bold text-lg text-slate-800">{value ?? "—"}</h3>
    </div>
  </div>
);

const SummaryCard = ({ title, value, icon }: any) => (
  <div className="bg-slate-50 border rounded-2xl p-5 flex items-center gap-4">
    <div className="bg-blue-950 text-white p-3 rounded-xl">{icon}</div>
    <div>
      <p className="text-sm uppercase text-slate-500 font-semibold">{title}</p>
      <h2 className="text-2xl font-black text-blue-950">{value}</h2>
    </div>
  </div>
);

export default Reports;