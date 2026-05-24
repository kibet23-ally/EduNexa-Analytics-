import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PolarRadiusAxis,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";
import { useData } from "../hooks/useData";

// ─── Types ────────────────────────────────────────────────────────────────────

interface School {
  id: string; name: string; logo_url?: string; motto?: string;
  address?: string; phone?: string; email?: string;
}
interface Grade { id: string; grade_name: string; school_id: string; }
interface Subject { id: string; subject_name: string; subject_code: string; school_id: string; }
interface Exam { id: string; exam_name: string; term: string; year: number; school_id: string; grade_id: string; is_school_wide: boolean; }
interface Student { id: string; name: string; admission_number: string; gender: string; grade_id: string; school_id: string; }
interface Result { student_id: string; subject_id: string; marks: number; term: string; year: number; school_id: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ["Overview", "Subject Analysis", "Rankings", "Report Cards", "Export Center"] as const;
type Tab = typeof TABS[number];

const GRADE_COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4", "#f97316", "#84cc16"];

const getGrade = (marks: number) => {
  if (marks >= 80) return { letter: "A", color: "#10b981", bg: "bg-emerald-500/10 text-emerald-400" };
  if (marks >= 70) return { letter: "B", color: "#3b82f6", bg: "bg-blue-500/10 text-blue-400" };
  if (marks >= 60) return { letter: "C", color: "#f59e0b", bg: "bg-amber-500/10 text-amber-400" };
  if (marks >= 50) return { letter: "D", color: "#f97316", bg: "bg-orange-500/10 text-orange-400" };
  return { letter: "E", color: "#ef4444", bg: "bg-red-500/10 text-red-400" };
};

const buildRemark = (avg: number) => {
  if (avg >= 80) return "Exceeding Expectation — exemplary mastery. Keep it up.";
  if (avg >= 65) return "Meeting Expectation — solid, consistent work.";
  if (avg >= 50) return "Approaching Expectation — steady improvement needed.";
  return "Below Expectation — requires focused remediation and parental support.";
};

const getPerformanceBar = (pct: number) => {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 60) return "bg-amber-500";
  return "bg-red-500";
};

// ─── Letterhead utilities ─────────────────────────────────────────────────────

/** Convert a remote/public image URL to a data URL so jsPDF can embed it. */
async function urlToDataURL(url: string): Promise<{ data: string; type: "PNG" | "JPEG" } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const type: "PNG" | "JPEG" = blob.type.includes("png") ? "PNG" : "JPEG";
    const data: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { data, type };
  } catch {
    return null;
  }
}

/**
 * Draws the premium school letterhead for any document.
 * Pulls all branding from the tenant's School record — true SaaS behaviour.
 */
function drawLetterhead(
  doc: jsPDF,
  school: School | undefined,
  logo: { data: string; type: "PNG" | "JPEG" } | null,
  subtitle: string,
) {
  const sw = doc.internal.pageSize.width;

  // Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, sw, 46, "F");
  doc.setFillColor(245, 158, 11); // amber-500 accent stripe
  doc.rect(0, 46, sw, 3, "F");

  // Logo (left)
  if (logo) {
    try { doc.addImage(logo.data, logo.type, 12, 8, 30, 30); } catch { /* ignore */ }
  } else {
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.6);
    doc.roundedRect(12, 8, 30, 30, 3, 3, "S");
    doc.setTextColor(245, 158, 11);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text((school?.name || "S").charAt(0).toUpperCase(), 27, 28, { align: "center" });
  }

  // School name + motto + contacts (center/right)
  doc.setTextColor(245, 158, 11);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text((school?.name || "School").toUpperCase(), sw / 2, 16, { align: "center" });

  if (school?.motto) {
    doc.setTextColor(226, 232, 240);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.text(`"${school.motto}"`, sw / 2, 22, { align: "center" });
  }

  const contactBits = [school?.address, school?.phone, school?.email].filter(Boolean) as string[];
  if (contactBits.length) {
    doc.setTextColor(148, 163, 184);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(contactBits.join("  •  "), sw / 2, 28, { align: "center" });
  }

  // Subtitle bar
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(subtitle.toUpperCase(), sw / 2, 40, { align: "center" });
}

function drawFooter(doc: jsPDF, school: School | undefined) {
  const sw = doc.internal.pageSize.width;
  const ph = doc.internal.pageSize.height;
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.5);
  doc.line(14, ph - 18, sw - 14, ph - 18);
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`${school?.name || ""} • Powered by EduNexa Analytics`, 14, ph - 12);
  doc.text(new Date().toLocaleDateString(), sw - 14, ph - 12, { align: "right" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const KPICard = ({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) => (
  <div className="relative overflow-hidden bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/60 rounded-2xl p-5 backdrop-blur-sm">
    <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent || "#f59e0b" }} />
    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</div>
    <div className="mt-2 text-3xl font-bold text-white tracking-tight">{value}</div>
    {sub && <div className="text-[11px] text-slate-400 mt-1">{sub}</div>}
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-sm font-semibold text-slate-200 tracking-tight mb-4 flex items-center gap-2">
    <span className="w-1 h-4 bg-amber-500 rounded-full" /> {children}
  </h3>
);

const EmptyState = ({ msg }: { msg: string }) => (
  <div className="text-center py-12 text-slate-500 text-sm">{msg}</div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      <div className="text-xs font-semibold text-slate-200 mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="text-xs text-slate-400">
          {p.name}: <span className="text-amber-400 font-semibold">{typeof p.value === "number" ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AssessmentHub() {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [term, setTerm] = useState<string>("");
  const [gradeId, setGradeId] = useState<string>("");
  const [examId, setExamId] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  // ── Data fetching ──
  const { data: schools = [] } = useData<School>("schools", "schools", {}, true, 300000);
  const school: School | undefined = schools[0];

  const { data: grades = [] } = useData<Grade>(
    `grades-${school?.id}`, "grades",
    { filters: school ? [{ column: "school_id", value: school.id }] : [] },
    !!school?.id, 300000,
  );

  const { data: subjects = [] } = useData<Subject>(
    `subjects-${school?.id}`, "subjects",
    { filters: school ? [{ column: "school_id", value: school.id }] : [] },
    !!school?.id, 300000,
  );

  const { data: exams = [] } = useData<Exam>(
    `exams-${school?.id}-${year}`, "exams",
    { filters: school ? [{ column: "school_id", value: school.id }, { column: "year", value: Number(year) }] : [] },
    !!school?.id, 60000,
  );

  const { data: students = [] } = useData<Student>(
    `students-${school?.id}-${gradeId}`, "students",
    {
      filters: [
        ...(school ? [{ column: "school_id", value: school.id }] : []),
        ...(gradeId ? [{ column: "grade_id", value: gradeId }] : []),
      ],
    },
    !!school?.id, 120000,
  );

  const { data: results = [], loading: resultsLoading } = useData<Result>(
    `results-${school?.id}-${year}-${term}-${gradeId}`, "results",
    {
      filters: [
        ...(school ? [{ column: "school_id", value: school.id }] : []),
        ...(year ? [{ column: "year", value: Number(year) }] : []),
        ...(term ? [{ column: "term", value: term }] : []),
      ],
    },
    !!school?.id, 60000,
  );

  // ── Filtered results ──
  const selectedExam = exams.find(e => e.id === examId);

  const filteredResults = useMemo(() => {
    let r = results;
    if (selectedExam) r = r.filter(x => x.term === selectedExam.term && x.year === selectedExam.year);
    if (gradeId) {
      const gradeStudentIds = new Set(students.map(s => s.id));
      r = r.filter(x => gradeStudentIds.has(x.student_id));
    }
    return r;
  }, [results, selectedExam, gradeId, students]);

  const filteredStudents = useMemo(() =>
    gradeId ? students.filter(s => s.grade_id === gradeId) : students,
    [students, gradeId],
  );

  // ── KPIs ──
  const kpis = useMemo(() => {
    if (!filteredResults.length) return { avg: 0, passing: 0, top: 0, total: filteredStudents.length };
    const avg = filteredResults.reduce((a, b) => a + b.marks, 0) / filteredResults.length;
    const passing = filteredResults.filter(r => r.marks >= 50).length / filteredResults.length * 100;
    const top = filteredResults.filter(r => r.marks >= 80).length / filteredResults.length * 100;
    return { avg: Math.round(avg * 10) / 10, passing: Math.round(passing), top: Math.round(top), total: filteredStudents.length };
  }, [filteredResults, filteredStudents]);

  // ── Subject averages ──
  const subjectAverages = useMemo(() => {
    return subjects.map(subj => {
      const subResults = filteredResults.filter(r => r.subject_id === subj.id);
      const avg = subResults.length ? subResults.reduce((a, b) => a + b.marks, 0) / subResults.length : 0;
      return { name: subj.subject_code || subj.subject_name, fullName: subj.subject_name, avg: Math.round(avg * 10) / 10, count: subResults.length };
    }).filter(s => s.count > 0).sort((a, b) => b.avg - a.avg);
  }, [filteredResults, subjects]);

  // ── Grade distribution ──
  const gradeDistribution = useMemo(() => {
    const dist = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    filteredResults.forEach(r => { dist[getGrade(r.marks).letter as keyof typeof dist]++; });
    return Object.entries(dist).map(([letter, count]) => ({ letter, count }));
  }, [filteredResults]);

  // ── Student rankings ──
  const studentRankings = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filteredResults.forEach(r => {
      if (!map[r.student_id]) map[r.student_id] = { total: 0, count: 0 };
      map[r.student_id].total += r.marks;
      map[r.student_id].count++;
    });
    return filteredStudents
      .map(s => {
        const d = map[s.id];
        const avg = d ? d.total / d.count : 0;
        return { ...s, avg: Math.round(avg * 10) / 10, total: d?.total || 0, subjects: d?.count || 0 };
      })
      .filter(s => s.subjects > 0)
      .sort((a, b) => b.avg - a.avg)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }, [filteredResults, filteredStudents]);

  // ── Student report card data ──
  const studentReportCard = useMemo(() => {
    if (!selectedStudent) return [];
    return subjects.map(subj => {
      const res = filteredResults.find(r => r.student_id === selectedStudent.id && r.subject_id === subj.id);
      return { subject: subj.subject_name, code: subj.subject_code, marks: res?.marks ?? null };
    }).filter(x => x.marks !== null);
  }, [selectedStudent, filteredResults, subjects]);

  // ── Term trend ──
  const termTrend = useMemo(() => {
    const terms = ["Term 1", "Term 2", "Term 3"];
    return terms.map(t => {
      const tr = results.filter(r => r.term === t);
      const avg = tr.length ? tr.reduce((a, b) => a + b.marks, 0) / tr.length : 0;
      return { term: t, avg: Math.round(avg * 10) / 10 };
    });
  }, [results]);

  const radarData = useMemo(() =>
    subjectAverages.slice(0, 8).map(s => ({ subject: s.name, avg: s.avg, max: 100 })),
    [subjectAverages],
  );

  // ── Cache the school's logo as a dataURL so every PDF embeds it instantly ──
  const loadLogo = useCallback(async () => {
    if (!school?.logo_url) return null;
    return urlToDataURL(school.logo_url);
  }, [school?.logo_url]);

  // ── PDF: Student Report Card ──
  const generateReportCardPDF = useCallback(async (student: Student) => {
    const doc = new jsPDF();
    const sw = doc.internal.pageSize.width;
    const logo = await loadLogo();

    drawLetterhead(doc, school, logo, "Student Report Card");

    // Student info panel
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 58, sw - 28, 30, 3, 3, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(student.name, 20, 70);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Adm No: ${student.admission_number}`, 20, 78);
    doc.text(`Gender: ${student.gender}`, 80, 78);
    const grade = grades.find(g => g.id === student.grade_id);
    doc.text(`Class: ${grade?.grade_name || "-"}`, 130, 78);
    doc.text(`Year: ${year}    Term: ${term || "All"}`, 20, 84);

    // Subjects table
    const subjectData = subjects.map(subj => {
      const res = filteredResults.find(r => r.student_id === student.id && r.subject_id === subj.id);
      const m = res?.marks;
      const g = m !== undefined ? getGrade(m) : null;
      return [subj.subject_name, subj.subject_code, m !== undefined ? String(m) : "-", g?.letter || "-", m !== undefined ? (m >= 50 ? "Pass" : "Fail") : "-"];
    }).filter(r => r[2] !== "-");

    if (subjectData.length) {
      autoTable(doc, {
        startY: 96,
        head: [["Subject", "Code", "Marks", "Grade", "Status"]],
        body: subjectData,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [15, 23, 42], textColor: [245, 158, 11], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center" } },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 8;
      const totalMarks = subjectData.reduce((a, r) => a + (Number(r[2]) || 0), 0);
      const avgMarks = totalMarks / subjectData.length;
      const overallGrade = getGrade(avgMarks);

      doc.setFillColor(15, 23, 42);
      doc.roundedRect(14, finalY, sw - 28, 22, 3, 3, "F");
      doc.setTextColor(245, 158, 11);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(
        `Overall Average: ${avgMarks.toFixed(1)}%   |   Grade: ${overallGrade.letter}   |   Subjects: ${subjectData.length}`,
        sw / 2, finalY + 13, { align: "center" },
      );

      // Remarks
      const ry = finalY + 30;
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Class Teacher's Remarks:", 14, ry);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(51, 65, 85);
      doc.text(buildRemark(avgMarks), 14, ry + 6, { maxWidth: sw - 28 });

      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Principal's Remarks:", 14, ry + 18);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(51, 65, 85);
      doc.text(buildRemark(avgMarks - 2), 14, ry + 24, { maxWidth: sw - 28 });
    }

    drawFooter(doc, school);
    doc.save(`ReportCard_${student.name.replace(/\s+/g, "_")}.pdf`);
  }, [school, grades, subjects, filteredResults, year, term, loadLogo]);

  // ── PDF: Class Analysis (subject averages + grade distribution) ──
  const generateClassAnalysisPDF = useCallback(async () => {
    if (!subjectAverages.length) return;
    const doc = new jsPDF();
    const sw = doc.internal.pageSize.width;
    const logo = await loadLogo();
    const gradeName = grades.find(g => g.id === gradeId)?.grade_name || "All Grades";

    drawLetterhead(doc, school, logo, "Class Performance Analysis");

    // Meta panel
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 58, sw - 28, 22, 3, 3, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`${gradeName}  •  Year ${year}  •  ${term || "All Terms"}`, 20, 70);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Mean: ${kpis.avg}%    Passing: ${kpis.passing}%    Top Scorers: ${kpis.top}%    Students: ${kpis.total}`,
      20, 76,
    );

    autoTable(doc, {
      startY: 88,
      head: [["#", "Subject", "Code", "Average", "Grade", "Entries"]],
      body: subjectAverages.map((s, i) => [i + 1, s.fullName, s.name, `${s.avg}%`, getGrade(s.avg).letter, s.count]),
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [15, 23, 42], textColor: [245, 158, 11], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center" } },
    });

    const y = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text("Grade Distribution", 14, y);
    autoTable(doc, {
      startY: y + 4,
      head: [["Grade", "Count"]],
      body: gradeDistribution.map(d => [d.letter, d.count]),
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [15, 23, 42], textColor: [245, 158, 11], fontStyle: "bold" },
      tableWidth: 80,
    });

    drawFooter(doc, school);
    doc.save(`ClassAnalysis_${gradeName.replace(/\s+/g, "_")}_${year}.pdf`);
  }, [school, grades, gradeId, year, term, subjectAverages, gradeDistribution, kpis, loadLogo]);

  // ── PDF: Student Rankings ──
  const generateReportCardPDF = useCallback(async (student: Student) => {
    const doc = new jsPDF();
    const sw = doc.internal.pageSize.width;
    const logo = await loadLogo();
    drawLetterhead(doc, school, logo, "Student Report Card");
    // Student info panel
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 58, sw - 28, 30, 3, 3, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(student.name, 20, 70);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Adm No: ${student.admission_number}`, 20, 78);
    doc.text(`Gender: ${student.gender}`, 80, 78);
    const grade = grades.find(g => g.id === student.grade_id);
    doc.text(`Class: ${grade?.grade_name || "-"}`, 130, 78);
    doc.text(`Year: ${year}    Term: ${term || "All"}`, 20, 84);
    // Subjects table
    const subjectData = subjects.map(subj => {
      const res = filteredResults.find(r => r.student_id === student.id && r.subject_id === subj.id);
      const m = res?.marks;
      const g = m !== undefined ? getGrade(m) : null;
      return [subj.subject_name, subj.subject_code, m !== undefined ? String(m) : "-", g?.letter || "-", m !== undefined ? (m >= 50 ? "Pass" : "Fail") : "-"];
    }).filter(r => r[2] !== "-");
    if (subjectData.length) {
      autoTable(doc, {
        startY: 96,
        head: [["Subject", "Code", "Marks", "Grade", "Status"]],
        body: subjectData,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [15, 23, 42], textColor: [245, 158, 11], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center" } },
      });
      const finalY = (doc as any).lastAutoTable.finalY + 8;
      const totalMarks = subjectData.reduce((a, r) => a + (Number(r[2]) || 0), 0);
      const avgMarks = totalMarks / subjectData.length;
      const overallGrade = getGrade(avgMarks);
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(14, finalY, sw - 28, 22, 3, 3, "F");
      doc.setTextColor(245, 158, 11);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(
        `Overall Average: ${avgMarks.toFixed(1)}%   |   Grade: ${overallGrade.letter}   |   Subjects: ${subjectData.length}`,
        sw / 2, finalY + 13, { align: "center" },
      );
      // Remarks
      const ry = finalY + 30;
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Class Teacher's Remarks:", 14, ry);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(51, 65, 85);
      doc.text(buildRemark(avgMarks), 14, ry + 6, { maxWidth: sw - 28 });
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Principal's Remarks:", 14, ry + 18);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(51, 65, 85);
      doc.text(buildRemark(avgMarks - 2), 14, ry + 24, { maxWidth: sw - 28 });
    }
    drawFooter(doc, school);
    doc.save(`ReportCard_${student.name.replace(/\s+/g, "_")}.pdf`);
  }, [school, grades, subjects, filteredResults, year, term, loadLogo]);
  // ── PDF: Class Analysis (subject averages + grade distribution) ──
  const generateClassAnalysisPDF = useCallback(async () => {
    if (!subjectAverages.length) return;
    const doc = new jsPDF();
    const sw = doc.internal.pageSize.width;
    const logo = await loadLogo();
    const gradeName = grades.find(g => g.id === gradeId)?.grade_name || "All Grades";
    drawLetterhead(doc, school, logo, "Class Performance Analysis");
    // Meta panel
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 58, sw - 28, 22, 3, 3, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`${gradeName}  •  Year ${year}  •  ${term || "All Terms"}`, 20, 70);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Mean: ${kpis.avg}%    Passing: ${kpis.passing}%    Top Scorers: ${kpis.top}%    Students: ${kpis.total}`,
      20, 76,
    );
    autoTable(doc, {
      startY: 88,
      head: [["#", "Subject", "Code", "Average", "Grade", "Entries"]],
      body: subjectAverages.map((s, i) => [i + 1, s.fullName, s.name, `${s.avg}%`, getGrade(s.avg).letter, s.count]),
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [15, 23, 42], textColor: [245, 158, 11], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center" } },
    });
    const y = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text("Grade Distribution", 14, y);
    autoTable(doc, {
      startY: y + 4,
      head: [["Grade", "Count"]],
      body: gradeDistribution.map(d => [d.letter, d.count]),
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [15, 23, 42], textColor: [245, 158, 11], fontStyle: "bold" },
      tableWidth: 80,
    });
    drawFooter(doc, school);
    doc.save(`ClassAnalysis_${gradeName.replace(/\s+/g, "_")}_${year}.pdf`);
  }, [school, grades, gradeId, year, term, subjectAverages, gradeDistribution, kpis, loadLogo]);
  // ── PDF: Student Rankings ──
  const generateRankingsPDF = useCallback(async () => {
    if (!studentRankings.length) return;
    const doc = new jsPDF();
    const sw = doc.internal.pageSize.width;
    const logo = await loadLogo();
    const gradeName = grades.find(g => g.id === gradeId)?.grade_name || "All Grades";
    drawLetterhead(doc, school, logo, "Student Rankings");
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 58, sw - 28, 18, 3, 3, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`${gradeName}  •  Year ${year}  •  ${term || "All Terms"}`, 20, 70);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`${studentRankings.length} students ranked by average`, sw - 20, 70, { align: "right" });
    autoTable(doc, {
      startY: 84,
      head: [["Rank", "Name", "Adm No", "Gender", "Subjects", "Total", "Average", "Grade"]],
      body: studentRankings.map(s => [
        `#${s.rank}`, s.name, s.admission_number, s.gender,
        s.subjects, s.total, `${s.avg}%`, getGrade(s.avg).letter,
      ]),
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 23, 42], textColor: [245, 158, 11], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { halign: "center", fontStyle: "bold" },
        4: { halign: "center" }, 5: { halign: "center" },
        6: { halign: "center", fontStyle: "bold" }, 7: { halign: "center" },
      },
      didDrawPage: () => drawFooter(doc, school),
    });
    doc.save(`Rankings_${gradeName.replace(/\s+/g, "_")}_${year}.pdf`);
  }, [school, grades, gradeId, year, term, studentRankings, loadLogo]);
  // ── Bulk PDF ──
  const generateBulkPDF = useCallback(async () => {
    if (!studentRankings.length) return;
    setExportLoading(true);
    try {
      for (const student of studentRankings.slice(0, 50)) {
        await generateReportCardPDF(student as Student);
        await new Promise(r => setTimeout(r, 120));
      }
    } finally {
      setExportLoading(false);
    }
  }, [studentRankings, generateReportCardPDF]);
  // ── Excel Export ──
  const exportToExcel = useCallback((type: "results" | "rankings" | "subjects") => {
    let data: any[] = [];
    let sheetName = "Data";
    if (type === "results") {
      data = filteredResults.map(r => {
        const student = students.find(s => s.id === r.student_id);
        const subject = subjects.find(s => s.id === r.subject_id);
        return {
          Student: student?.name || r.student_id,
          "Adm No": student?.admission_number || "",
          Subject: subject?.subject_name || r.subject_id,
          Code: subject?.subject_code || "",
          Marks: r.marks, Grade: getGrade(r.marks).letter,
          Term: r.term, Year: r.year,
        };
      });
      sheetName = "Results";
    } else if (type === "rankings") {
      data = studentRankings.map(s => ({
        Rank: s.rank, Name: s.name, "Adm No": s.admission_number,
        Average: s.avg, Total: s.total, Subjects: s.subjects, Gender: s.gender,
      }));
      sheetName = "Rankings";
    } else {
      data = subjectAverages.map(s => ({
        Subject: s.fullName, Code: s.name, Average: s.avg, Students: s.count,
      }));
      sheetName = "Subjects";
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${(school?.name || "EduNexa").replace(/\s+/g, "_")}_${sheetName}_${year}_${term || "All"}.xlsx`);
  }, [filteredResults, studentRankings, subjectAverages, students, subjects, year, term, school]);
  // ── Helpers ──
  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return [y, y - 1, y - 2, y - 3].map(String);
  }, []);
  const filteredExams = useMemo(() =>
    exams.filter(e => (!gradeId || e.grade_id === gradeId || e.is_school_wide)),
    [exams, gradeId],
  );
  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-4 md:p-8">
      {/* Page Header */}
      <div className="max-w-[1400px] mx-auto mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-4">
            {school?.logo_url && (
              <img src={school.logo_url} alt={school.name} className="w-14 h-14 rounded-xl object-cover ring-2 ring-amber-500/40" />
            )}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">
                Assessment Hub
              </h1>
              <p className="text-xs md:text-sm text-slate-400 mt-1">
                {school?.name || "Loading…"} <span className="text-slate-600">•</span> Academic Intelligence
              </p>
            </div>
          </div>
          {/* Global Filters */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Year", value: year, setter: setYear, opts: yearOptions.map(y => ({ v: y, l: y })) },
              { label: "Term", value: term, setter: setTerm, opts: [{ v: "", l: "All Terms" }, { v: "Term 1", l: "Term 1" }, { v: "Term 2", l: "Term 2" }, { v: "Term 3", l: "Term 3" }] },
              { label: "Grade", value: gradeId, setter: setGradeId, opts: [{ v: "", l: "All Grades" }, ...grades.map(g => ({ v: g.id, l: g.grade_name }))] },
              { label: "Exam", value: examId, setter: setExamId, opts: [{ v: "", l: "All Exams" }, ...filteredExams.map(e => ({ v: e.id, l: e.exam_name }))] },
            ].map(f => (
              <select
                key={f.label}
                value={f.value}
                onChange={e => { f.setter(e.target.value); if (f.label === "Grade") setExamId(""); }}
                className="text-xs bg-slate-800/80 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            ))}
          </div>
        </div>
        {/* Tab Bar */}
        <div className="flex gap-1 border-b border-slate-800 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? "text-amber-400 bg-slate-800/60"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
              }`}
            >
              {tab}
              {activeTab === tab && (
                <motion.div layoutId="tab-underline" className="absolute inset-x-2 -bottom-px h-0.5 bg-amber-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>
      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* OVERVIEW */}
            {activeTab === "Overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KPICard label="Mean Score" value={`${kpis.avg}%`} accent="#f59e0b" />
                  <KPICard label="Passing Rate" value={`${kpis.passing}%`} accent="#10b981" />
                  <KPICard label="Top Scorers" value={`${kpis.top}%`} sub="Grade A" accent="#3b82f6" />
                  <KPICard label="Students" value={kpis.total} sub={gradeId ? grades.find(g => g.id === gradeId)?.grade_name : "All grades"} accent="#8b5cf6" />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5">
                    <SectionTitle>Grade Distribution</SectionTitle>
                    {gradeDistribution.some(d => d.count > 0) ? (
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={gradeDistribution}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="letter" stroke="#94a3b8" fontSize={11} />
                          <YAxis stroke="#94a3b8" fontSize={11} />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                            {gradeDistribution.map((_, i) => <Cell key={i} fill={GRADE_COLORS[i % GRADE_COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <EmptyState msg="No data available" />}
                  </div>
                  <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5">
                    <SectionTitle>Term Average Trend</SectionTitle>
                    {termTrend.some(t => t.avg > 0) ? (
                      <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={termTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="term" stroke="#94a3b8" fontSize={11} />
                          <YAxis stroke="#94a3b8" fontSize={11} />
                          <Tooltip content={<CustomTooltip />} />
                          <Line type="monotone" dataKey="avg" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: "#f59e0b", r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : <EmptyState msg="No term data yet" />}
                  </div>
                </div>
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5">
                  <SectionTitle>Subject Performance Snapshot</SectionTitle>
                  {subjectAverages.length > 0 ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {subjectAverages.slice(0, 8).map((s, i) => (
                        <div key={s.name} className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/40">
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">#{i + 1}</div>
                            <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getGrade(s.avg).bg}`}>
                              {getGrade(s.avg).letter}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-slate-200 truncate">{s.fullName}</div>
                          <div className="text-lg font-bold text-amber-400 mt-1">{s.avg}%</div>
                          <div className="text-[10px] text-slate-500">{s.count} entries</div>
                        </div>
                      ))}
                    </div>
                  ) : <EmptyState msg="No subject data" />}
                </div>
              </div>
            )}
            {/* SUBJECT ANALYSIS */}
            {activeTab === "Subject Analysis" && (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <button
                    onClick={generateClassAnalysisPDF}
                    className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-4 py-2 rounded-lg transition-colors"
                  >
                    Download Class Analysis PDF
                  </button>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5">
                    <SectionTitle>Average Score by Subject</SectionTitle>
                    {subjectAverages.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={subjectAverages} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                          <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={70} />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                          <Bar dataKey="avg" radius={[0, 6, 6, 0]}>
                            {subjectAverages.map((_, i) => <Cell key={i} fill={GRADE_COLORS[i % GRADE_COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <EmptyState msg="No subject data" />}
                  </div>
                  <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5">
                    <SectionTitle>Subject Radar</SectionTitle>
                    {radarData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="#334155" />
                          <PolarAngleAxis dataKey="subject" stroke="#94a3b8" fontSize={10} />
                          <PolarRadiusAxis stroke="#475569" fontSize={9} />
                          <Radar dataKey="avg" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
                          <Tooltip content={<CustomTooltip />} />
                        </RadarChart>
                      </ResponsiveContainer>
                    ) : <EmptyState msg="No radar data" />}
                  </div>
                </div>
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5">
                  <SectionTitle>Detailed Subject Breakdown</SectionTitle>
                  {subjectAverages.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-700">
                            {["#", "Subject", "Code", "Average", "Grade", "Entries", "Performance"].map(h => (
                              <th key={h} className="py-2 px-3 font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {subjectAverages.map((s, i) => {
                            const g = getGrade(s.avg);
                            return (
                              <tr key={s.name} className="border-b border-slate-800 hover:bg-slate-800/30">
                                <td className="py-2.5 px-3 text-slate-500">{i + 1}</td>
                                <td className="py-2.5 px-3 text-slate-200 font-medium">{s.fullName}</td>
                                <td className="py-2.5 px-3 text-slate-400">{s.name}</td>
                                <td className="py-2.5 px-3 text-amber-400 font-bold">{s.avg}%</td>
                                <td className="py-2.5 px-3"><span className={`text-xs font-bold px-2 py-0.5 rounded ${g.bg}`}>{g.letter}</span></td>
                                <td className="py-2.5 px-3 text-slate-400">{s.count}</td>
                                <td className="py-2.5 px-3 w-40">
                                  <div className="w-full bg-slate-700/40 rounded-full h-2">
                                    <div className={`h-full rounded-full ${getPerformanceBar(s.avg)}`} style={{ width: `${Math.min(s.avg, 100)}%` }} />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : <EmptyState msg="No subject data" />}
                </div>
              </div>
            )}
            {/* RANKINGS */}
            {activeTab === "Rankings" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">Student Rankings</h2>
                    <p className="text-xs text-slate-500">{studentRankings.length} students ranked · sorted by average</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportToExcel("rankings")}
                      className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg transition-colors"
                    >
                      Excel
                    </button>
                    <button
                      onClick={generateRankingsPDF}
                      className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-3 py-2 rounded-lg transition-colors"
                    >
                      PDF (with Letterhead)
                    </button>
                  </div>
                </div>
                {/* Podium */}
                {studentRankings.length >= 3 && (
                  <div className="grid grid-cols-3 gap-3">
                    {[studentRankings[1], studentRankings[0], studentRankings[2]].map((s, i) => {
                      const podiumRank = [2, 1, 3][i];
                      const isFirst = podiumRank === 1;
                      const heights = ["h-32", "h-40", "h-28"];
                      const colors = ["from-slate-400 to-slate-600", "from-amber-400 to-amber-600", "from-orange-400 to-orange-600"];
                      return (
                        <div key={s.id} className={`flex flex-col items-center ${i === 1 ? "order-2" : i === 0 ? "order-1" : "order-3"}`}>
                          <div className={`w-full bg-gradient-to-b ${colors[i]} ${heights[i]} rounded-t-2xl flex flex-col items-center justify-end pb-3 text-white shadow-xl`}>
                            <div className="text-3xl font-bold">#{podiumRank}</div>
                          </div>
                          <div className="w-full bg-slate-800/60 rounded-b-xl p-3 text-center border-t border-slate-700">
                            <div className={`text-sm font-bold truncate ${isFirst ? "text-amber-300" : "text-slate-200"}`}>{s.name}</div>
                            <div className="text-[10px] text-slate-500">{s.admission_number}</div>
                            <div className="text-lg font-bold text-amber-400 mt-1">{s.avg}%</div>
                            <div className="text-[10px] text-slate-500">{s.subjects} subjects</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5">
                  {resultsLoading ? (
                    <div className="text-center py-10 text-slate-500 text-sm">Loading rankings…</div>
                  ) : studentRankings.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-700">
                            {["Rank", "Name", "Adm No", "Gender", "Average", "Total", "Subjects", "Grade", ""].map(h => (
                              <th key={h} className="py-2 px-3 font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {studentRankings.map(s => {
                            const g = getGrade(s.avg);
                            const medal = s.rank === 1 ? "text-amber-400" : s.rank === 2 ? "text-slate-300" : s.rank === 3 ? "text-orange-400" : "text-slate-500";
                            return (
                              <tr key={s.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                                <td className={`py-2.5 px-3 font-bold ${medal}`}>#{s.rank}</td>
                                <td className="py-2.5 px-3 text-slate-100 font-medium">{s.name}</td>
                                <td className="py-2.5 px-3 text-slate-400">{s.admission_number}</td>
                                <td className="py-2.5 px-3 text-slate-400">{s.gender}</td>
                                <td className="py-2.5 px-3 text-amber-400 font-bold">{s.avg}%</td>
                                <td className="py-2.5 px-3 text-slate-300">{s.total}</td>
                                <td className="py-2.5 px-3 text-slate-400">{s.subjects}</td>
                                <td className="py-2.5 px-3"><span className={`text-xs font-bold px-2 py-0.5 rounded ${g.bg}`}>{g.letter}</span></td>
                                <td className="py-2.5 px-3">
                                  <button
                                    onClick={() => { setSelectedStudent(s as Student); setActiveTab("Report Cards"); }}
                                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium"
                                  >
                                    Report →
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : <EmptyState msg="No rankings yet" />}
                </div>
              </div>
            )}
            {/* REPORT CARDS */}
            {activeTab === "Report Cards" && (
              <div className="grid md:grid-cols-[280px_1fr] gap-4">
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4">
                  <SectionTitle>Select Student</SectionTitle>
                  <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
                    {filteredStudents.length > 0 ? filteredStudents.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStudent(s)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors text-sm ${
                          selectedStudent?.id === s.id
                            ? "bg-amber-500/15 border border-amber-500/30 text-amber-300"
                            : "hover:bg-slate-700/40 text-slate-300"
                        }`}
                      >
                        <div className="font-semibold truncate">{s.name}</div>
                        <div className="text-[10px] text-slate-500">{s.admission_number}</div>
                      </button>
                    )) : <EmptyState msg="No students" />}
                  </div>
                </div>
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5">
                  {selectedStudent ? (
                    <div>
                      <div className="flex items-start justify-between flex-wrap gap-3 mb-5 pb-4 border-b border-slate-700">
                        <div>
                          <h2 className="text-xl font-bold text-slate-100">{selectedStudent.name}</h2>
                          <p className="text-xs text-slate-500 mt-1">
                            {selectedStudent.admission_number} · {selectedStudent.gender} ·{" "}
                            {grades.find(g => g.id === selectedStudent.grade_id)?.grade_name || ""}
                          </p>
                        </div>
                        <button
                          onClick={() => generateReportCardPDF(selectedStudent)}
                          className="flex items-center gap-2 text-xs bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-4 py-2 rounded-lg transition-colors"
                        >
                          Download PDF
                        </button>
                      </div>
                      {studentReportCard.length > 0 ? (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-700">
                                  {["Subject", "Code", "Marks", "Grade", "Status"].map(h => (
                                    <th key={h} className="py-2 px-3 font-semibold">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {studentReportCard.map(r => {
                                  const g = r.marks !== null ? getGrade(r.marks) : null;
                                  return (
                                    <tr key={r.subject} className="border-b border-slate-800">
                                      <td className="py-2.5 px-3 text-slate-200">{r.subject}</td>
                                      <td className="py-2.5 px-3 text-slate-400">{r.code}</td>
                                      <td className="py-2.5 px-3 text-amber-400 font-bold">{r.marks}</td>
                                      <td className="py-2.5 px-3">
                                        {g && <span className={`text-xs font-bold px-2 py-0.5 rounded ${g.bg}`}>{g.letter}</span>}
                                      </td>
                                      <td className="py-2.5 px-3">
                                        {r.marks !== null && (
                                          <span className={`text-xs font-semibold ${r.marks >= 50 ? "text-emerald-400" : "text-red-400"}`}>
                                            {r.marks >= 50 ? "Pass" : "Fail"}
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {(() => {
                            const avg = studentReportCard.reduce((a, b) => a + (b.marks || 0), 0) / studentReportCard.length;
                            const g = getGrade(avg);
                            return (
                              <div className="mt-5 grid grid-cols-3 gap-4 pt-4 border-t border-slate-700">
                                <div>
                                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Average</div>
                                  <div className="text-2xl font-bold text-amber-400">{avg.toFixed(1)}%</div>
                                </div>
                                <div>
                                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Grade</div>
                                  <div className={`text-2xl font-bold ${g.bg.split(" ")[1]}`}>{g.letter}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Subjects</div>
                                  <div className="text-2xl font-bold text-slate-200">{studentReportCard.length}</div>
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      ) : <EmptyState msg="No results for this student" />}
                    </div>
                  ) : (
                    <div className="text-center py-20 text-slate-500 text-sm">Select a student to view their report card</div>
                  )}
                </div>
              </div>
            )}
            {/* EXPORT CENTER */}
            {activeTab === "Export Center" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-100">Export Center</h2>
                  <p className="text-xs text-slate-500">All PDFs are branded with the {school?.name || "school"} letterhead</p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { title: "Results Data", desc: "All filtered results with student & subject info",
                      actions: [{ label: "Excel", onClick: () => exportToExcel("results") }] },
                    { title: "Student Rankings", desc: "Ranked list of students with averages and totals",
                      actions: [
                        { label: "Excel", onClick: () => exportToExcel("rankings") },
                        { label: "PDF", onClick: generateRankingsPDF, amber: true },
                      ] },
                    { title: "Class Analysis", desc: "Subject averages, grade distribution & KPIs",
                      actions: [
                        { label: "Excel", onClick: () => exportToExcel("subjects") },
                        { label: "PDF", onClick: generateClassAnalysisPDF, amber: true },
                      ] },
                    { title: "Report Card (Single)", desc: selectedStudent ? selectedStudent.name : "Select a student in Report Cards tab",
                      actions: [{
                        label: "Generate PDF", amber: true,
                        onClick: () => { if (selectedStudent) generateReportCardPDF(selectedStudent); else setActiveTab("Report Cards"); },
                      }] },
                    { title: "Bulk Report Cards", desc: `Generate PDFs for all ${studentRankings.length} ranked students (max 50)`,
                      actions: [{ label: exportLoading ? "Generating…" : "Generate All", onClick: generateBulkPDF, amber: true, disabled: exportLoading || !studentRankings.length }] },
                  ].map(card => (
                    <div key={card.title} className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/60 rounded-2xl p-5">
                      <h4 className="text-sm font-bold text-slate-100">{card.title}</h4>
                      <p className="text-xs text-slate-500 mt-1 mb-4 min-h-[32px]">{card.desc}</p>
                      <div className="flex gap-2 flex-wrap">
                        {card.actions.map(a => (
                          <button
                            key={a.label}
                            onClick={a.onClick}
                            disabled={(a as any).disabled}
                            className={`text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              (a as any).amber
                                ? "bg-amber-500 hover:bg-amber-400 text-slate-900"
                                : "bg-slate-700 hover:bg-slate-600 text-slate-200"
                            }`}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5">
                  <SectionTitle>Current Filter Summary</SectionTitle>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: "Year", value: year },
                      { label: "Term", value: term || "All" },
                      { label: "Grade", value: grades.find(g => g.id === gradeId)?.grade_name || "All" },
                      { label: "Exam", value: filteredExams.find(e => e.id === examId)?.exam_name || "All" },
                    ].map(f => (
                      <div key={f.label} className="bg-slate-900/50 rounded-lg p-3">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">{f.label}</div>
                        <div className="text-sm font-semibold text-slate-200 mt-1">{f.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Total Results", value: filteredResults.length },
                      { label: "Students Ranked", value: studentRankings.length },
                      { label: "Subjects Tracked", value: subjectAverages.length },
                    ].map(s => (
                      <div key={s.label} className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                        <div className="text-[10px] uppercase tracking-wider text-amber-500">{s.label}</div>
                        <div className="text-lg font-bold text-amber-300 mt-1">{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}