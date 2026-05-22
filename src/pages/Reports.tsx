/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo, useCallback } from "react";
import {
  Award, BookOpen, CalendarDays, ClipboardList,
  Download, FileSpreadsheet, FileText,
  GraduationCap, Hash, Loader2, Mail, MapPin,
  Phone, Printer, Star, Trophy, TrendingUp,
  User, Users, X, CheckSquare, Square, AlertTriangle,
} from "lucide-react";
import { useAuth } from "../useAuth";
import { useData } from "../hooks/useData";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ═══════════════════════════════════════════════════════════
   CBC HELPERS
═══════════════════════════════════════════════════════════ */
type Band = "EE" | "ME" | "AE" | "BE";

const cbcGrade = (s: number) =>
  s >= 90 ? "EE1" : s >= 75 ? "EE2" : s >= 58 ? "ME1" :
  s >= 41 ? "ME2" : s >= 31 ? "AE1" : s >= 21 ? "AE2" :
  s >= 11 ? "BE1" : "BE2";

const cbcPoints = (s: number) =>
  s >= 90 ? 8 : s >= 75 ? 7 : s >= 58 ? 6 : s >= 41 ? 5 :
  s >= 31 ? 4 : s >= 21 ? 3 : s >= 11 ? 2 : 1;

const bandFromScore = (s: number): Band =>
  s >= 75 ? "EE" : s >= 58 ? "ME" : s >= 31 ? "AE" : "BE";

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

/* ═══════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════
   PDF DESIGN TOKENS — professional, understated palette
   No bright colours. Charcoal headings, slate body text,
   warm stone accent line, ivory/white page background.
═══════════════════════════════════════════════════════════ */
const PDF = {
  /* Page */
  pageW: 210,
  pageH: 297,
  margin: 14,

  /* Palette — RGB tuples */
  headerBg:   [30,  41,  59]  as [number,number,number], // slate-800
  headerText: [255, 255, 255] as [number,number,number],
  accentLine: [203, 175, 112] as [number,number,number], // warm gold/stone
  subheadBg:  [248, 250, 252] as [number,number,number], // slate-50
  subheadText:[30,  41,  59]  as [number,number,number],
  bodyText:   [51,  65,  85]  as [number,number,number], // slate-700
  mutedText:  [100, 116, 139] as [number,number,number], // slate-500
  borderLine: [226, 232, 240] as [number,number,number], // slate-200
  rowAlt:     [249, 250, 251] as [number,number,number], // gray-50
  summaryBg:  [241, 245, 249] as [number,number,number], // slate-100
  footerBg:   [30,  41,  59]  as [number,number,number],
  footerText: [203, 213, 225] as [number,number,number], // slate-300

  /* Table header */
  tHeadBg:    [30,  41,  59]  as [number,number,number],
  tHeadText:  [255, 255, 255] as [number,number,number],

  /* Rank medal colours */
  gold:       [254, 240, 138] as [number,number,number],
  silver:     [226, 232, 240] as [number,number,number],
  bronze:     [254, 237, 213] as [number,number,number],
};

/* ── narrow utility ── */
function setColor(doc: jsPDF, rgb: [number,number,number], target: "fill"|"text"|"draw") {
  if (target === "fill")  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  if (target === "text")  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  if (target === "draw")  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

/* ═══════════════════════════════════════════════════════════
   drawReportPage — renders one student report card
   onto the current page of `doc`.
═══════════════════════════════════════════════════════════ */
function drawReportPage(
  doc: jsPDF,
  opts: {
    school: any;
    student: any;
    exam: any;
    rows: ReportRow[];
    totalMarks: number;
    pct: number;
    grade: string;
    points: number;
    rank: number | string;
    total: number;
    teacherRemark: string;
    principalRemark: string;
    date: string;
  }
): void {
  const {
    school, student, exam, rows,
    totalMarks, pct, grade, points,
    rank, total, teacherRemark, principalRemark, date,
  } = opts;
  const W = PDF.pageW;
  const M = PDF.margin;

  /* ── 1. Header band ── */
  setColor(doc, PDF.headerBg, "fill");
  doc.rect(0, 0, W, 38, "F");

  /* Logo */
  if (school?.logo_url) {
    try {
      doc.addImage(school.logo_url, "JPEG", M, 4, 28, 28);
    } catch { /* skip missing/CORS logo */ }
  }

  /* School name */
  setColor(doc, PDF.headerText, "text");
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text((school?.name ?? "School").toUpperCase(), W / 2, 13, { align: "center" });

  /* Accent rule */
  setColor(doc, PDF.accentLine, "draw");
  doc.setLineWidth(0.6);
  doc.line(M + 30, 17, W - M, 17);

  /* Motto */
  setColor(doc, PDF.accentLine, "text");
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "italic");
  doc.text(
    school?.motto ? `"${school.motto}"` : "Excellence Through Education",
    W / 2, 23, { align: "center" }
  );

  /* Contact row */
  const contact = [school?.address, school?.phone, school?.email].filter(Boolean).join("   ·   ");
  if (contact) {
    setColor(doc, [180, 195, 215] as any, "text");
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(contact, W / 2, 30, { align: "center" });
  }

  /* Document title */
  setColor(doc, PDF.headerText, "text");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("STUDENT PROGRESS REPORT", W / 2, 36, { align: "center" });

  /* ── 2. Info grid ── */
  const infoY = 45;
  const fields: [string, string][] = [
    ["Student Name",  student?.name ?? "—"],
    ["Admission No.", student?.admission_number ?? "—"],
    ["Gender",        student?.gender ?? "—"],
    ["Grade / Class", (student?.grades as any)?.grade_name ?? "—"],
    ["Exam",          exam?.exam_name ?? "—"],
    ["Term & Year",   `Term ${exam?.term ?? ""}, ${exam?.year ?? ""}`],
    ["Class Position",`${rank} of ${total}`],
    ["Issue Date",    date],
  ];

  setColor(doc, PDF.summaryBg, "fill");
  setColor(doc, PDF.borderLine, "draw");
  doc.setLineWidth(0.3);
  doc.roundedRect(M, infoY, W - M * 2, Math.ceil(fields.length / 2) * 7 + 4, 2, 2, "FD");

  fields.forEach(([label, value], i) => {
    const col = i % 2 === 0 ? M + 4 : W / 2 + 4;
    const y   = infoY + 6 + Math.floor(i / 2) * 7;
    doc.setFontSize(7.5);
    setColor(doc, PDF.mutedText, "text");
    doc.setFont("helvetica", "normal");
    doc.text(label + ":", col, y);
    setColor(doc, PDF.bodyText, "text");
    doc.setFont("helvetica", "bold");
    doc.text(value, col + 28, y);
  });

  /* ── 3. Results table ── */
  const tableY = infoY + Math.ceil(fields.length / 2) * 7 + 10;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  setColor(doc, PDF.subheadText, "text");
  doc.text("ACADEMIC RESULTS", M, tableY - 2);

  autoTable(doc, {
    startY: tableY,
    head: [["Learning Area", "Marks /100", "Grade", "Pts", "Teacher's Remark"]],
    body: rows.map(r => [r.subject_name, r.marks, r.grade, r.points, r.remark]),
    headStyles: {
      fillColor: PDF.tHeadBg,
      textColor: PDF.tHeadText,
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: PDF.bodyText,
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: "bold" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 10, halign: "center" },
      4: { cellWidth: 92 },
    },
    alternateRowStyles: { fillColor: PDF.rowAlt },
    tableLineColor: PDF.borderLine,
    tableLineWidth: 0.2,
    margin: { left: M, right: M },
  });

  const afterTable = (doc as any).lastAutoTable.finalY + 5;

  /* ── 4. Summary strip ── */
  const summaryItems: [string, string][] = [
    ["TOTAL MARKS",    String(totalMarks)],
    ["PERCENTAGE",     `${pct}%`],
    ["OVERALL GRADE",  grade],
    ["OVERALL POINTS", String(points)],
  ];
  const boxW = (W - M * 2) / 4 - 1;

  summaryItems.forEach(([label, value], i) => {
    const bx = M + i * (boxW + 1.3);
    setColor(doc, PDF.summaryBg, "fill");
    setColor(doc, PDF.borderLine, "draw");
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, afterTable, boxW, 14, 1.5, 1.5, "FD");

    /* Accent top bar */
    setColor(doc, PDF.accentLine, "fill");
    doc.roundedRect(bx, afterTable, boxW, 1.5, 1, 1, "F");

    setColor(doc, PDF.bodyText, "text");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(value, bx + boxW / 2, afterTable + 8.5, { align: "center" });

    setColor(doc, PDF.mutedText, "text");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(label, bx + boxW / 2, afterTable + 13, { align: "center" });
  });

  /* ── 5. CBC Grading scale ── */
  const scaleY = afterTable + 20;
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  setColor(doc, PDF.mutedText, "text");
  doc.text("CBC GRADING SCALE:", M, scaleY);
  doc.setFont("helvetica", "normal");
  const scale = "EE1 ≥90  ·  EE2 75–89  ·  ME1 58–74  ·  ME2 41–57  ·  AE1 31–40  ·  AE2 21–30  ·  BE1 11–20  ·  BE2 0–10";
  doc.text(scale, M + 30, scaleY);

  /* ── 6. Remarks ── */
  const remY = scaleY + 6;
  ([
    ["Class Teacher's Remarks", teacherRemark,   "Class Teacher"],
    ["Principal's Remarks",     principalRemark, "Principal / Head Teacher"],
  ] as [string, string, string][]).forEach(([title, remark, sigLabel], i) => {
    const rx = i === 0 ? M : W / 2 + 2;
    const rw = W / 2 - M - 4;

    setColor(doc, PDF.summaryBg, "fill");
    setColor(doc, PDF.borderLine, "draw");
    doc.setLineWidth(0.3);
    doc.roundedRect(rx, remY, rw, 30, 1.5, 1.5, "FD");

    /* Left accent bar */
    setColor(doc, PDF.accentLine, "fill");
    doc.rect(rx, remY, 1.5, 30, "F");

    setColor(doc, PDF.bodyText, "text");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(title, rx + 5, remY + 5);

    setColor(doc, PDF.bodyText, "text");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const lines = doc.splitTextToSize(remark, rw - 8) as string[];
    doc.text(lines, rx + 5, remY + 11);

    /* Signature line */
    setColor(doc, PDF.borderLine, "draw");
    doc.setLineWidth(0.3);
    doc.line(rx + 5, remY + 26, rx + 40, remY + 26);
    setColor(doc, PDF.mutedText, "text");
    doc.setFontSize(6.5);
    doc.text(sigLabel, rx + 5, remY + 29.5);
    doc.text(date, rx + rw - 5, remY + 29.5, { align: "right" });
  });

  /* ── 7. Footer band ── */
  setColor(doc, PDF.footerBg, "fill");
  doc.rect(0, 282, W, 15, "F");
  setColor(doc, PDF.footerText, "text");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  if (contact) doc.text(contact, W / 2, 291, { align: "center" });
  doc.setFontSize(6.5);
  setColor(doc, [100, 116, 139] as any, "text");
  doc.text("Confidential — For the attention of parent/guardian only", W / 2, 295, { align: "center" });
}

/* ═══════════════════════════════════════════════════════════
   exportRankingsPDF — professional class analysis document
═══════════════════════════════════════════════════════════ */
function exportRankingsPDF(opts: {
  school: any; exam: any;
  rankings: RankingRow[]; subjectRankings: SubjectRankRow[];
  mostImproved: MostImprovedRow | null;
}) {
  const { school, exam, rankings, subjectRankings, mostImproved } = opts;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = PDF.pageW;
  const M = PDF.margin;

  /* Header */
  setColor(doc, PDF.headerBg, "fill");
  doc.rect(0, 0, W, 36, "F");
  if (school?.logo_url) {
    try { doc.addImage(school.logo_url, "JPEG", M, 4, 26, 26); } catch { /* skip */ }
  }
  setColor(doc, PDF.headerText, "text");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text((school?.name ?? "School").toUpperCase(), W / 2, 12, { align: "center" });
  setColor(doc, PDF.accentLine, "draw");
  doc.setLineWidth(0.5);
  doc.line(M + 28, 16, W - M, 16);
  setColor(doc, PDF.accentLine, "text");
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text(school?.motto ? `"${school.motto}"` : "", W / 2, 21, { align: "center" });
  setColor(doc, PDF.headerText, "text");
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.text("CLASS PERFORMANCE ANALYSIS", W / 2, 30, { align: "center" });

  /* Sub-header */
  setColor(doc, PDF.summaryBg, "fill");
  doc.rect(0, 36, W, 10, "F");
  setColor(doc, PDF.bodyText, "text");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Exam: ${exam?.exam_name ?? ""}     Term ${exam?.term ?? ""},  ${exam?.year ?? ""}     Generated: ${new Date().toLocaleDateString()}`,
    W / 2, 42.5, { align: "center" }
  );

  let curY = 52;

  /* Most Improved */
  if (mostImproved) {
    setColor(doc, [240, 253, 244] as any, "fill");
    setColor(doc, [187, 247, 208] as any, "draw");
    doc.setLineWidth(0.3);
    doc.roundedRect(M, curY, W - M * 2, 18, 2, 2, "FD");

    setColor(doc, PDF.accentLine, "fill");
    doc.rect(M, curY, 1.5, 18, "F");

    setColor(doc, [22, 163, 74] as any, "text");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("MOST IMPROVED STUDENT", M + 5, curY + 5);

    setColor(doc, [15, 118, 54] as any, "text");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(
      `${mostImproved.student_name}  (${mostImproved.admission_number})`,
      M + 5, curY + 12
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(doc, [22, 163, 74] as any, "text");
    doc.text(
      `${mostImproved.prev_avg.toFixed(1)}%  →  ${mostImproved.curr_avg.toFixed(1)}%   ·   Improvement: +${mostImproved.improvement.toFixed(1)}%`,
      W - M - 5, curY + 12, { align: "right" }
    );
    curY += 24;
  }

  /* Student Rankings table */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  setColor(doc, PDF.bodyText, "text");
  doc.text("STUDENT RANKINGS", M, curY);
  curY += 4;

  autoTable(doc, {
    startY: curY,
    head: [["Rank", "Student Name", "Admission No.", "Total", "Average", "Grade", "Points"]],
    body: rankings.map(r => [`#${r.rank}`, r.student_name, r.admission_number, r.total_marks, `${r.average}%`, r.grade, r.points]),
    headStyles: { fillColor: PDF.tHeadBg, textColor: PDF.tHeadText, fontStyle: "bold", fontSize: 8, cellPadding: 3 },
    bodyStyles: { fontSize: 7.5, textColor: PDF.bodyText, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 14, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 52 },
      2: { cellWidth: 28 },
      3: { cellWidth: 16, halign: "center" },
      4: { cellWidth: 18, halign: "center" },
      5: { cellWidth: 16, halign: "center" },
      6: { cellWidth: 16, halign: "center" },
    },
    alternateRowStyles: { fillColor: PDF.rowAlt },
    tableLineColor: PDF.borderLine,
    tableLineWidth: 0.2,
    margin: { left: M, right: M },
    didParseCell: (data) => {
      if (data.section === "body") {
        if (data.row.index === 0)      { data.cell.styles.fillColor = PDF.gold; }
        else if (data.row.index === 1) { data.cell.styles.fillColor = PDF.silver; }
        else if (data.row.index === 2) { data.cell.styles.fillColor = PDF.bronze; }
      }
    },
  });

  curY = (doc as any).lastAutoTable.finalY + 10;

  /* Subject Rankings table */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  setColor(doc, PDF.bodyText, "text");
  doc.text("SUBJECT PERFORMANCE RANKINGS  (Best → Least)", M, curY);
  curY += 4;

  autoTable(doc, {
    startY: curY,
    head: [["Rank", "Subject", "Class Avg", "Highest", "Lowest", "No. Students"]],
    body: subjectRankings.map((s, i) => [
      `#${i + 1}`, s.subject_name,
      `${s.avg.toFixed(1)}%`, s.highest, s.lowest, s.count,
    ]),
    headStyles: { fillColor: PDF.tHeadBg, textColor: PDF.tHeadText, fontStyle: "bold", fontSize: 8, cellPadding: 3 },
    bodyStyles: { fontSize: 7.5, textColor: PDF.bodyText, cellPadding: 2.5 },
    alternateRowStyles: { fillColor: PDF.rowAlt },
    tableLineColor: PDF.borderLine,
    tableLineWidth: 0.2,
    margin: { left: M, right: M },
  });

  /* Footer */
  const contact = [school?.address, school?.phone, school?.email].filter(Boolean).join("   ·   ");
  setColor(doc, PDF.footerBg, "fill");
  doc.rect(0, 282, W, 15, "F");
  setColor(doc, PDF.footerText, "text");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  if (contact) doc.text(contact, W / 2, 291, { align: "center" });
  doc.setFontSize(6.5);
  setColor(doc, [100, 116, 139] as any, "text");
  doc.text("Confidential — School Administration Document", W / 2, 295, { align: "center" });

  doc.save(
    `${(school?.name ?? "school").replace(/\s+/g, "_")}_class_analysis_T${exam?.term ?? ""}_${exam?.year ?? ""}.pdf`
  );
}

/* ═══════════════════════════════════════════════════════════
   exportRankingsExcel
═══════════════════════════════════════════════════════════ */
function exportRankingsExcel(opts: {
  school: any; exam: any;
  rankings: RankingRow[]; subjectRankings: SubjectRankRow[];
  mostImproved: MostImprovedRow | null;
}) {
  const { school, exam, rankings, subjectRankings, mostImproved } = opts;
  const wb = XLSX.utils.book_new();

  const wsRankings = XLSX.utils.aoa_to_sheet([
    [`${school?.name ?? "School"} — Student Rankings`],
    [`Exam: ${exam?.exam_name ?? ""}   |   Term ${exam?.term ?? ""}, ${exam?.year ?? ""}`],
    [`Generated: ${new Date().toLocaleDateString()}`],
    [],
    ["Rank", "Student Name", "Admission No.", "Total Marks", "Average (%)", "Grade", "Points"],
    ...rankings.map(r => [r.rank, r.student_name, r.admission_number, r.total_marks, r.average, r.grade, r.points]),
  ]);
  wsRankings["!cols"] = [
    { wch: 6 }, { wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, wsRankings, "Student Rankings");

  const wsSubjects = XLSX.utils.aoa_to_sheet([
    [`${school?.name ?? "School"} — Subject Rankings`],
    [`Exam: ${exam?.exam_name ?? ""}   |   Term ${exam?.term ?? ""}, ${exam?.year ?? ""}`],
    [],
    ["Rank", "Subject", "Class Average (%)", "Highest", "Lowest", "No. Students"],
    ...subjectRankings.map((s, i) => [i + 1, s.subject_name, s.avg.toFixed(1), s.highest, s.lowest, s.count]),
  ]);
  wsSubjects["!cols"] = [{ wch: 6 }, { wch: 26 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsSubjects, "Subject Rankings");

  if (mostImproved) {
    const wsMI = XLSX.utils.aoa_to_sheet([
      [`${school?.name ?? "School"} — Most Improved Student`],
      [],
      ["Student Name",     mostImproved.student_name],
      ["Admission No.",    mostImproved.admission_number],
      ["Previous Average", `${mostImproved.prev_avg.toFixed(1)}%`],
      ["Current Average",  `${mostImproved.curr_avg.toFixed(1)}%`],
      ["Improvement",      `+${mostImproved.improvement.toFixed(1)}%`],
    ]);
    wsMI["!cols"] = [{ wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsMI, "Most Improved");
  }

  XLSX.writeFile(
    wb,
    `${(school?.name ?? "school").replace(/\s+/g, "_")}_rankings_T${exam?.term ?? ""}_${exam?.year ?? ""}.xlsx`
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
const Reports = () => {
  const { user } = useAuth();

  /* ── state ── */
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedExamId,    setSelectedExamId]    = useState<number | null>(null);
  const [bulkExamId,        setBulkExamId]        = useState<number | null>(null);
  const [bulkGradeId,       setBulkGradeId]       = useState<number | null>(null);
  const [selectedBulkIds,   setSelectedBulkIds]   = useState<Set<number>>(new Set());
  const [bulkDownloading,   setBulkDownloading]   = useState(false);
  const [bulkProgress,      setBulkProgress]      = useState(0);
  const [tab,               setTab]               = useState<"report" | "rankings">("report");

  /* ── school — website column does NOT exist, excluded ── */
  const { data: schoolsData } = useData<any>(
    `school-${user?.school_id}`, "schools",
    { select: "id,name,logo_url,motto,address,phone,email", filters: { id: user?.school_id }, single: true },
    !!user?.school_id
  );
  const school = Array.isArray(schoolsData) ? schoolsData[0] ?? null : schoolsData ?? null;

  /* ── students ── */
  const { data: studentsRaw = [] } = useData<any>(
    "students-report", "students",
    { select: "id,name,admission_number,gender,grade_id,grades:grade_id(grade_name)", orderBy: { column: "name", ascending: true } },
    !!user?.school_id
  );

  /* ── grades ── */
  const { data: gradesRaw = [] } = useData<any>(
    "grades-report", "grades",
    { select: "id,grade_name", filters: { school_id: user?.school_id }, orderBy: { column: "grade_name", ascending: true } },
    !!user?.school_id
  );

  /* ── exams ── */
  const { data: examsRaw = [] } = useData<any>(
    "exams-report", "exams",
    { select: "id,exam_name,term,year,grade_id,is_school_wide", orderBy: { column: "year", ascending: false } },
    !!user?.school_id
  );

  /* ── subjects ── */
  const { data: subjectsRaw = [] } = useData<any>(
    "subjects-report", "subjects",
    { select: "id,subject_name,subject_code" },
    !!user?.school_id
  );

  /* ── derived objects ── */
  const selectedExam    = useMemo(() => examsRaw.find((e: any) => e.id === selectedExamId)  ?? null, [examsRaw, selectedExamId]);
  const bulkExam        = useMemo(() => examsRaw.find((e: any) => e.id === bulkExamId)       ?? null, [examsRaw, bulkExamId]);
  const selectedStudent = useMemo(() => studentsRaw.find((s: any) => s.id === selectedStudentId) ?? null, [studentsRaw, selectedStudentId]);

  /* ── results for selected student+exam ── */
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

  /* ── all results for exam (rankings, subject stats) ── */
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

  /* ── previous exam (for Most Improved) ── */
  const sortedExams: any[] = useMemo(() =>
    [...examsRaw].sort((a, b) => a.year !== b.year ? a.year - b.year : a.term - b.term),
    [examsRaw]
  );
  const selectedExamIdx = useMemo(() =>
    sortedExams.findIndex(e => e.id === selectedExamId), [sortedExams, selectedExamId]);
  const prevExam: any | null = selectedExamIdx > 0 ? sortedExams[selectedExamIdx - 1] : null;

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

  /* ── subject map ── */
  const subjectMap = useMemo(() => {
    const m = new Map<number, string>();
    subjectsRaw.forEach((s: any) => m.set(s.id, s.subject_name));
    return m;
  }, [subjectsRaw]);

  /* ── report rows (best → least) ── */
  const reportResults: ReportRow[] = useMemo(() =>
    resultsRaw
      .map((r: any) => {
        const marks = Number(r.marks);
        const b = bandFromScore(marks);
        return {
          subject_name: subjectMap.get(r.subject_id) ?? "Unknown",
          marks,
          grade:  cbcGrade(marks),
          points: cbcPoints(marks),
          remark: b === "EE" ? "Excellent mastery of concepts. Keep up the impressive work."
                : b === "ME" ? "Good grasp of the work. Maintain steady effort and revise often."
                : b === "AE" ? "Fair effort shown. More practice and revision needed."
                : "Requires extra support. Please seek help promptly.",
        };
      })
      .sort((a: ReportRow, b: ReportRow) => b.marks - a.marks),
    [resultsRaw, subjectMap]
  );

  /* ── summary ── */
  const totalMarks    = useMemo(() => reportResults.reduce((s, r) => s + r.marks, 0), [reportResults]);
  const subjectCount  = reportResults.length || 1;
  const percentage    = useMemo(() => Math.round((totalMarks / (subjectCount * 100)) * 100), [totalMarks, subjectCount]);
  const overallGrade  = cbcGrade(percentage);
  const overallPoints = useMemo(() => Math.round(reportResults.reduce((s, r) => s + r.points, 0) / subjectCount), [reportResults, subjectCount]);
  const band          = bandFromScore(percentage);
  const teacherRemark   = CLASS_TEACHER_REMARKS[band];
  const principalRemark = PRINCIPAL_REMARKS[band];

  /* ── rankings ── */
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
          student_id:       Number(sid),
          student_name:     st?.name ?? "—",
          admission_number: st?.admission_number ?? "—",
          total_marks:      Math.round(v.sum),
          average: avg,
          grade:   cbcGrade(avg),
          points:  cbcPoints(avg),
        };
      })
      .sort((a, b) => b.total_marks - a.total_marks)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [allResultsRaw, studentsRaw]);

  /* ── subject rankings (best → least) ── */
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

  /* ── most improved ── */
  const mostImproved: MostImprovedRow | null = useMemo(() => {
    if (!prevExam || !prevResultsRaw.length || !allResultsRaw.length) return null;
    const avgFor = (rows: any[], sid: number) => {
      const s = rows.filter((r: any) => r.student_id === sid);
      return s.length ? s.reduce((t: number, r: any) => t + Number(r.marks), 0) / s.length : 0;
    };
    const ids = [...new Set(allResultsRaw.map((r: any) => r.student_id as number))];
    let best: MostImprovedRow | null = null;
    ids.forEach(sid => {
      const prev = avgFor(prevResultsRaw, sid);
      const curr = avgFor(allResultsRaw,  sid);
      if (prev === 0) return;
      const imp = curr - prev;
      if (!best || imp > best.improvement) {
        const st = studentsRaw.find((s: any) => s.id === sid);
        best = {
          student_id: sid,
          student_name: st?.name ?? "—",
          admission_number: st?.admission_number ?? "—",
          prev_avg:    parseFloat(prev.toFixed(1)),
          curr_avg:    parseFloat(curr.toFixed(1)),
          improvement: parseFloat(imp.toFixed(1)),
        };
      }
    });
    return best;
  }, [prevExam, prevResultsRaw, allResultsRaw, studentsRaw]);

  const totalStudents = rankings.length;
  const studentRank   = rankings.find(r => r.student_id === selectedStudentId)?.rank ?? "—";
  const formattedDate = new Date().toLocaleDateString();
  const showReport    = !!selectedStudentId && !!selectedExamId && reportResults.length > 0;

  /* ── single PDF ── */
  const handleDownloadPDF = () => {
    if (!showReport) return;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    drawReportPage(doc, {
      school, student: selectedStudent, exam: selectedExam,
      rows: reportResults, totalMarks, pct: percentage,
      grade: overallGrade, points: overallPoints,
      rank: studentRank, total: totalStudents,
      teacherRemark, principalRemark, date: formattedDate,
    });
    doc.save(`${(selectedStudent?.name ?? "report").replace(/\s+/g, "_")}_T${selectedExam?.term}_${selectedExam?.year}.pdf`);
  };

  /* ── bulk PDF (by grade or selection) ── */
  const handleBulkDownload = useCallback(async () => {
    if (!bulkExam || selectedBulkIds.size === 0) return;
    setBulkDownloading(true);
    setBulkProgress(0);

    try {
      const { data: bulkResults, error } = await supabase
        .from("results")
        .select("id,student_id,subject_id,marks,term,year")
        .eq("term",      String(bulkExam.term))
        .eq("year",      bulkExam.year)
        .eq("school_id", user?.school_id);

      if (error) {
        console.error("[EduNexa] bulk fetch:", error.message);
        return;
      }

      const ids = [...selectedBulkIds];
      const mergedDoc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      let firstPage = true;

      /* Build rankings for this exam on-the-fly so rank numbers are correct */
      const bulkTotals: Record<number, { sum: number; count: number }> = {};
      (bulkResults ?? []).forEach((r: any) => {
        if (!bulkTotals[r.student_id]) bulkTotals[r.student_id] = { sum: 0, count: 0 };
        bulkTotals[r.student_id].sum   += Number(r.marks);
        bulkTotals[r.student_id].count += 1;
      });
      const bulkRankMap: Record<number, number> = {};
      Object.entries(bulkTotals)
        .sort(([, a], [, b]) => b.sum - a.sum)
        .forEach(([sid], i) => { bulkRankMap[Number(sid)] = i + 1; });
      const bulkTotal = Object.keys(bulkTotals).length;

      for (let i = 0; i < ids.length; i++) {
        const sid     = ids[i];
        const student = studentsRaw.find((s: any) => s.id === sid);
        if (!student) continue;

        const sr = (bulkResults ?? []).filter((r: any) => r.student_id === sid);
        if (!sr.length) continue;

        const rows: ReportRow[] = sr
          .map((r: any) => {
            const marks = Number(r.marks);
            const b = bandFromScore(marks);
            return {
              subject_name: subjectMap.get(r.subject_id) ?? "Unknown",
              marks,
              grade:  cbcGrade(marks),
              points: cbcPoints(marks),
              remark: b === "EE" ? "Excellent mastery of concepts. Keep up the impressive work."
                    : b === "ME" ? "Good grasp of the work. Maintain steady effort and revise often."
                    : b === "AE" ? "Fair effort shown. More practice and revision needed."
                    : "Requires extra support. Please seek help promptly.",
            };
          })
          .sort((a: ReportRow, b: ReportRow) => b.marks - a.marks);

        const tot    = rows.reduce((s, r) => s + r.marks, 0);
        const cnt    = rows.length || 1;
        const pct    = Math.round((tot / (cnt * 100)) * 100);
        const bd     = bandFromScore(pct);
        const rnk    = bulkRankMap[sid] ?? "—";

        if (!firstPage) mergedDoc.addPage();
        firstPage = false;

        drawReportPage(mergedDoc, {
          school, student, exam: bulkExam,
          rows, totalMarks: tot, pct,
          grade:  cbcGrade(pct),
          points: Math.round(rows.reduce((s, r) => s + r.points, 0) / cnt),
          rank: rnk, total: bulkTotal,
          teacherRemark:   CLASS_TEACHER_REMARKS[bd],
          principalRemark: PRINCIPAL_REMARKS[bd],
          date: formattedDate,
        });

        setBulkProgress(Math.round(((i + 1) / ids.length) * 100));
      }

      const gradeSuffix = bulkGradeId
        ? `_${(gradesRaw.find((g: any) => g.id === bulkGradeId)?.grade_name ?? "").replace(/\s+/g, "_")}`
        : "";

      mergedDoc.save(
        `${(school?.name ?? "school").replace(/\s+/g, "_")}_reports_T${bulkExam.term}_${bulkExam.year}${gradeSuffix}.pdf`
      );
    } catch (err) {
      console.error("[EduNexa] bulk download:", err);
    } finally {
      setBulkDownloading(false);
      setBulkProgress(0);
    }
  }, [
    bulkExam, selectedBulkIds, studentsRaw, subjectMap,
    school, user?.school_id, formattedDate, gradesRaw, bulkGradeId,
  ]);

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="bg-slate-50 min-h-screen p-4 md:p-6">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-container { box-shadow: none !important; margin: 0 !important; width: 100% !important; }
          table { page-break-inside: avoid; }
        }
      `}</style>

      {/* ── TAB BAR ── */}
      <div className="no-print max-w-7xl mx-auto mb-5 space-y-4">
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit shadow-sm">
          {(["report", "rankings"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all
                ${tab === t
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}>
              {t === "report" ? "Report Cards" : "Class Analysis"}
            </button>
          ))}
        </div>

        {/* ── REPORT CARD CONTROLS ── */}
        {tab === "report" && (
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
              value={selectedStudentId ?? ""}
              onChange={e => setSelectedStudentId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Select student…</option>
              {studentsRaw.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} — {s.admission_number}</option>
              ))}
            </select>
            <select
              className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
              value={selectedExamId ?? ""}
              onChange={e => setSelectedExamId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Select exam…</option>
              {examsRaw.map((e: any) => (
                <option key={e.id} value={e.id}>{e.exam_name} — Term {e.term}, {e.year}</option>
              ))}
            </select>
            {showReport && (
              <div className="flex gap-2">
                <button onClick={() => window.print()}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all">
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button onClick={handleDownloadPDF}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all">
                  <FileText className="w-4 h-4" /> Download PDF
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── CLASS ANALYSIS CONTROLS ── */}
         {tab === "rankings" && (
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
              value={selectedExamId ?? ""}
              onChange={e => setSelectedExamId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Select exam for analysis…</option>
              {examsRaw.map((e: any) => (
                <option key={e.id} value={e.id}>{e.exam_name} — Term {e.term}, {e.year}</option>
              ))}
            </select>
            {selectedExam && rankings.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => exportRankingsExcel({ school, exam: selectedExam, rankings, subjectRankings, mostImproved })}
                  className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all">
                  <FileSpreadsheet className="w-4 h-4" /> Excel
                </button>
                <button
                  onClick={() => exportRankingsPDF({ school, exam: selectedExam, rankings, subjectRankings, mostImproved })}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all">
                  <FileText className="w-4 h-4" /> PDF
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════ TAB: REPORT CARD (screen preview) ══════════ */}
      {tab === "report" && (
        <>
          {!showReport && (
            <div className="text-center py-28 text-slate-400 text-sm">
              {!selectedStudentId || !selectedExamId
                ? "Select a student and exam above to preview the report card."
                : "No results found for this student and exam."}
            </div>
          )}

          {showReport && (
            <div className="print-container max-w-4xl mx-auto bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-200">

              {/* ── LETTERHEAD ── */}
              <div className="bg-slate-800 text-white px-8 py-7">
                <div className="flex items-center gap-6">
                  <div className="bg-white rounded-xl p-2 shadow flex-shrink-0">
                    <img
                      src={school?.logo_url || "/placeholder.svg"}
                      alt="School"
                      className="w-16 h-16 object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-bold tracking-wide text-white">
                      {school?.name ?? "School Name"}
                    </h1>
                    <div className="w-24 h-px bg-amber-400/70 my-2" />
                    <p className="text-slate-300 text-sm italic">
                      {school?.motto ? `"${school.motto}"` : "Excellence Through Education"}
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                      {[school?.address, school?.phone, school?.email].filter(Boolean).join("   ·   ")}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-medium">Progress Report</p>
                    <p className="text-xs text-slate-400 mt-1">{formattedDate}</p>
                  </div>
                </div>
              </div>

              {/* ── THIN ACCENT LINE ── */}
              <div className="h-0.5 bg-gradient-to-r from-amber-400 via-amber-300 to-transparent" />

              <div className="px-8 py-6 space-y-6">

                {/* TITLE */}
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-slate-700 tracking-widest uppercase text-sm">
                    Student Academic Progress Report
                  </h2>
                  <div className="w-12 h-px bg-amber-400 mx-auto mt-2" />
                </div>

                {/* STUDENT INFO */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { icon: <User className="w-4 h-4" />,          label: "Student Name",  value: selectedStudent?.name },
                    { icon: <Hash className="w-4 h-4" />,          label: "Admission No.", value: selectedStudent?.admission_number },
                    { icon: <Users className="w-4 h-4" />,         label: "Gender",        value: selectedStudent?.gender },
                    { icon: <GraduationCap className="w-4 h-4" />, label: "Grade",         value: (selectedStudent?.grades as any)?.grade_name },
                    { icon: <ClipboardList className="w-4 h-4" />, label: "Exam",          value: selectedExam?.exam_name },
                    { icon: <CalendarDays className="w-4 h-4" />,  label: "Term & Year",   value: `Term ${selectedExam?.term}, ${selectedExam?.year}` },
                    { icon: <Trophy className="w-4 h-4" />,        label: "Position",      value: `${studentRank} of ${totalStudents}` },
                  ].map(f => (
                    <div key={f.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                        {f.icon}
                        <span className="text-[10px] font-semibold uppercase tracking-widest">{f.label}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800">{f.value ?? "—"}</p>
                    </div>
                  ))}
                </div>

                {/* RESULTS TABLE — sorted best → least */}
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Academic Results</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-800 text-white">
                          <th className="px-4 py-3 text-left font-medium text-xs tracking-wide">Learning Area</th>
                          <th className="px-4 py-3 text-center font-medium text-xs tracking-wide">Marks</th>
                          <th className="px-4 py-3 text-center font-medium text-xs tracking-wide">Grade</th>
                          <th className="px-4 py-3 text-center font-medium text-xs tracking-wide">Points</th>
                          <th className="px-4 py-3 text-left font-medium text-xs tracking-wide">Teacher's Remark</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportResults.map((r, i) => (
                          <tr key={i} className={`border-t border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                            <td className="px-4 py-3 font-medium text-slate-800">
                              <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                {r.subject_name}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-900">{r.marks}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                                {r.grade}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-slate-700">{r.points}</td>
                            <td className="px-4 py-3 text-xs text-slate-500">{r.remark}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SUMMARY STRIP */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Total Marks",   value: totalMarks,    icon: <Award className="w-4 h-4" /> },
                    { label: "Percentage",    value: `${percentage}%`, icon: <Star className="w-4 h-4" /> },
                    { label: "Overall Grade", value: overallGrade,  icon: <GraduationCap className="w-4 h-4" /> },
                    { label: "Points",        value: overallPoints, icon: <Trophy className="w-4 h-4" /> },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-800 text-white rounded-xl p-4 flex items-center gap-3">
                      <div className="text-amber-400">{s.icon}</div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium">{s.label}</p>
                        <p className="text-xl font-bold tabular-nums">{s.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* GRADING SCALE */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">CBC Grading Scale</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
                    {["EE1 ≥ 90%", "EE2 75–89%", "ME1 58–74%", "ME2 41–57%",
                      "AE1 31–40%", "AE2 21–30%", "BE1 11–20%", "BE2 0–10%"].map(g => (
                      <span key={g} className="font-medium">{g}</span>
                    ))}
                  </div>
                </div>

                {/* REMARKS */}
                <div className="grid md:grid-cols-2 gap-4">
                  {([
                    ["Class Teacher's Remarks", teacherRemark,   "Class Teacher Signature"],
                    ["Principal's Remarks",     principalRemark, "Principal / Head Teacher"],
                  ] as [string, string, string][]).map(([title, remark, sig]) => (
                    <div key={title} className="border border-slate-200 rounded-xl p-5 bg-slate-50">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1 h-4 rounded-full bg-amber-400" />
                        <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest">{title}</h4>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed mb-6">{remark}</p>
                      <div className="border-b border-dashed border-slate-300 w-40 mb-1" />
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>{sig}</span>
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* FOOTER */}
              <div className="bg-slate-800 text-slate-300 px-8 py-4 text-xs">
                <div className="flex flex-wrap items-center gap-4 justify-between">
                  <div className="flex items-center gap-4">
                    {school?.address && <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />{school.address}</span>}
                    {school?.phone   && <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{school.phone}</span>}
                    {school?.email   && <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{school.email}</span>}
                  </div>
                  <span className="text-slate-500">Confidential — For parent/guardian only</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════ TAB: CLASS ANALYSIS ══════════ */}
      {tab === "rankings" && (
        <div className="max-w-7xl mx-auto space-y-5">

          {!selectedExam && (
            <div className="text-center py-28 text-slate-400 text-sm">
              Select an exam above to view class analysis.
            </div>
          )}

          {selectedExam && (
            <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-200">

              {/* Letterhead */}
              <div className="bg-slate-800 text-white px-8 py-6 flex items-center gap-5">
                <div className="bg-white rounded-xl p-2 shadow flex-shrink-0">
                  <img src={school?.logo_url || "/placeholder.svg"} alt="Logo" className="w-12 h-12 object-contain" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-wide">{school?.name ?? "School"}</h1>
                  <div className="w-16 h-px bg-amber-400/70 my-1.5" />
                  <p className="text-slate-300 text-xs italic">
                    {school?.motto ? `"${school.motto}"` : ""}
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-slate-400 uppercase tracking-widest">Class Analysis</p>
                  <p className="text-sm font-medium text-white mt-1">{selectedExam.exam_name}</p>
                  <p className="text-xs text-slate-400">Term {selectedExam.term}, {selectedExam.year}</p>
                </div>
              </div>
              <div className="h-0.5 bg-gradient-to-r from-amber-400 via-amber-300 to-transparent" />

              <div className="px-8 py-6 space-y-8">

                {/* Most Improved */}
                {mostImproved && (
                  <div className="flex items-center gap-5 bg-slate-50 border border-slate-200 rounded-xl px-6 py-4">
                    <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-lg flex-shrink-0">🏅</div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Most Improved Student</p>
                      <p className="text-base font-bold text-slate-800">
                        {mostImproved.student_name}
                        <span className="text-sm font-normal text-slate-500 ml-2">({mostImproved.admission_number})</span>
                      </p>
                      <p className="text-sm text-slate-600 mt-0.5">
                        {mostImproved.prev_avg}% → {mostImproved.curr_avg}%
                        <span className="ml-2 font-semibold text-emerald-700">+{mostImproved.improvement}%</span>
                        <span className="text-xs text-slate-400 ml-2">vs {prevExam?.exam_name} (T{prevExam?.term} {prevExam?.year})</span>
                      </p>
                    </div>
                  </div>
                )}

                {!mostImproved && prevExam === null && rankings.length > 0 && (
                  <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-amber-700 text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Most Improved requires at least two exams with recorded results.
                  </div>
                )}

                {/* Student Rankings */}
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Student Rankings</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-800 text-white">
                          {["Rank", "Student Name", "Admission No.", "Total Marks", "Average", "Grade", "Points"].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-medium tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rankings.map((item, i) => (
                          <tr key={i}
                            className={`border-t border-slate-100 transition-colors hover:bg-slate-50
                              ${item.rank === 1 ? "bg-amber-50" : item.rank === 2 ? "bg-slate-50" : item.rank === 3 ? "bg-orange-50/50" : "bg-white"}`}>
                            <td className="px-4 py-3 font-bold text-slate-700">#{item.rank}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{item.student_name}</td>
                            <td className="px-4 py-3 text-slate-500 text-xs">{item.admission_number}</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-900">{item.total_marks}</td>
                            <td className="px-4 py-3 text-center text-slate-700">{item.average}%</td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">{item.grade}</span>
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-slate-700">{item.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Subject Rankings */}
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                    Subject Rankings — Best to Least
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-800 text-white">
                          {["Rank", "Subject", "Class Average", "Highest", "Lowest", "Students"].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-medium tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {subjectRankings.map((s, i) => (
                          <tr key={i} className={`border-t border-slate-100 hover:bg-slate-50 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                            <td className="px-4 py-3 font-bold text-slate-600">#{i + 1}</td>
                            <td className="px-4 py-3 font-medium text-slate-800 flex items-center gap-2">
                              <TrendingUp className={`w-3.5 h-3.5 ${i === 0 ? "text-emerald-500" : i === subjectRankings.length - 1 ? "text-rose-400" : "text-slate-300"}`} />
                              {s.subject_name}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-slate-600" style={{ width: `${s.avg}%` }} />
                                </div>
                                <span className="font-semibold text-slate-700 text-xs">{s.avg.toFixed(1)}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-emerald-700">{s.highest}</td>
                            <td className="px-4 py-3 text-center font-medium text-rose-600">{s.lowest}</td>
                            <td className="px-4 py-3 text-center text-slate-600">{s.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── BULK DOWNLOAD ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-0.5">Bulk Download Report Cards</h3>
            <p className="text-sm text-slate-500 mb-5">
              Select an exam and optionally a grade. Download all selected report cards as a single PDF.
            </p>

            {/* Exam + Grade selectors */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <select
                className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                value={bulkExamId ?? ""}
                onChange={e => {
                  setBulkExamId(e.target.value ? Number(e.target.value) : null);
                  setSelectedBulkIds(new Set());
                  setBulkGradeId(null);
                }}>
                <option value="">Select exam…</option>
                {examsRaw.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.exam_name} — Term {e.term}, {e.year}</option>
                ))}
              </select>

              <select
                className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                value={bulkGradeId ?? ""}
                onChange={e => {
                  const gid = e.target.value ? Number(e.target.value) : null;
                  setBulkGradeId(gid);
                  setSelectedBulkIds(
                    gid
                      ? new Set(studentsRaw.filter((s: any) => s.grade_id === gid).map((s: any) => s.id))
                      : new Set()
                  );
                }}>
                <option value="">All grades</option>
                {gradesRaw.map((g: any) => (
                  <option key={g.id} value={g.id}>
                    {g.grade_name} ({studentsRaw.filter((s: any) => s.grade_id === g.id).length} students)
                  </option>
                ))}
              </select>
            </div>

            {/* Toolbar */}
            {bulkExamId && (
              <div className="flex flex-wrap gap-2 mb-4 items-center">
                <button
                  onClick={() => {
                    const pool = bulkGradeId
                      ? studentsRaw.filter((s: any) => s.grade_id === bulkGradeId)
                      : studentsRaw;
                    setSelectedBulkIds(new Set(pool.map((s: any) => s.id)));
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-all">
                  <CheckSquare className="w-3.5 h-3.5" />
                  {bulkGradeId ? "Select all in grade" : "Select all"}
                </button>
                <button
                  onClick={() => setSelectedBulkIds(new Set())}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-all">
                  <Square className="w-3.5 h-3.5" /> Clear
                </button>

                {/* Per-grade quick-toggle pills (only when no grade filter active) */}
                {!bulkGradeId && gradesRaw.map((g: any) => {
                  const gs = studentsRaw.filter((s: any) => s.grade_id === g.id);
                  if (!gs.length) return null;
                  const allSel = gs.every((s: any) => selectedBulkIds.has(s.id));
                  return (
                    <button key={g.id}
                      onClick={() => {
                        const next = new Set(selectedBulkIds);
                        if (allSel) gs.forEach((s: any) => next.delete(s.id));
                        else        gs.forEach((s: any) => next.add(s.id));
                        setSelectedBulkIds(next);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all
                        ${allSel
                          ? "border-slate-700 bg-slate-800 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                      {allSel ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                      {g.grade_name}
                    </button>
                  );
                })}

                <button
                  onClick={handleBulkDownload}
                  disabled={selectedBulkIds.size === 0 || bulkDownloading}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-xs font-medium transition-all ml-auto">
                  {bulkDownloading
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {bulkProgress}%</>
                    : <><Download className="w-3.5 h-3.5" /> Download PDF {selectedBulkIds.size > 0 ? `(${selectedBulkIds.size})` : ""}</>}
                </button>
              </div>
            )}

            {/* Student checkboxes */}
            {bulkExamId && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-60 overflow-y-auto pr-1">
                {(bulkGradeId
                  ? studentsRaw.filter((s: any) => s.grade_id === bulkGradeId)
                  : studentsRaw
                ).map((s: any) => {
                  const sel       = selectedBulkIds.has(s.id);
                  const gradeName = gradesRaw.find((g: any) => g.id === s.grade_id)?.grade_name ?? "";
                  return (
                    <div key={s.id}
                      onClick={() => {
                        const next = new Set(selectedBulkIds);
                        if (sel) next.delete(s.id); else next.add(s.id);
                        setSelectedBulkIds(next);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-medium transition-all select-none
                        ${sel
                          ? "border-slate-700 bg-slate-800 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 transition-all
                        ${sel ? "bg-white/20 border border-white/40" : "border border-slate-300"}`}>
                        {sel && <X className="w-2 h-2 text-white" />}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate">{s.name}</div>
                        {!bulkGradeId && <div className="text-[9px] opacity-60 truncate">{gradeName}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Progress bar */}
            {bulkDownloading && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>Generating report cards…</span>
                  <span>{bulkProgress}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-700 rounded-full transition-all duration-300"
                    style={{ width: `${bulkProgress}%` }}
                  />
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
  <div className="flex items-start gap-3">
    <div className="bg-slate-100 p-2.5 rounded-lg text-slate-500 flex-shrink-0">{icon}</div>
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-800 mt-0.5">{value ?? "—"}</p>
    </div>
  </div>
);

const SummaryCard = ({ title, value, icon }: any) => (
  <div className="bg-slate-800 text-white rounded-xl p-4 flex items-center gap-3">
    <div className="text-amber-400">{icon}</div>
    <div>
      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">{title}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  </div>
);

export default Reports;
                        