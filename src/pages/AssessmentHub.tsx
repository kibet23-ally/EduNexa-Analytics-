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
interface AttendanceRecord { id: string; school_id: string; student_id: string; grade_id: string; date: string; status: string; }

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

const getPerformanceBar = (pct: number) => {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 60) return "bg-amber-500";
  return "bg-red-500";
};

// ─── Sub-components ────────────────────────────────────────────────────────────

const KPICard = ({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="relative bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 overflow-hidden"
  >
    <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-10"
      style={{ background: accent || "#f59e0b" }} />
    <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-2">{label}</p>
    <p className="text-3xl font-bold text-white" style={{ fontFamily: "'DM Serif Display', serif" }}>{value}</p>
    {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
  </motion.div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-sm font-semibold tracking-widest text-amber-400 uppercase mb-4">{children}</h3>
);

const EmptyState = ({ msg }: { msg: string }) => (
  <div className="flex flex-col items-center justify-center py-16 text-slate-500">
    <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6M4 20h16M5 4h14a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
    </svg>
    <p className="text-sm">{msg}</p>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-300 mb-1 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || "#f59e0b" }}>{p.name}: <strong>{typeof p.value === "number" ? p.value.toFixed(1) : p.value}</strong></p>
      ))}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AssessmentHub() {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [term, setTerm] = useState<string>("");
  const [gradeId, setGradeId] = useState<string>("");
  const [examId, setExamId] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  // ── Data fetching ──
  const { data: schools = [] } = useData<School[]>("schools", "schools", {}, true, 300000);
  const school: School | undefined = schools[0];

  const { data: grades = [] } = useData<Grade[]>(
    `grades-${school?.id}`, "grades",
    { filters: school ? [{ column: "school_id", value: school.id }] : [] },
    !!school?.id, 300000
  );

  const { data: subjects = [] } = useData<Subject[]>(
    `subjects-${school?.id}`, "subjects",
    { filters: school ? [{ column: "school_id", value: school.id }] : [] },
    !!school?.id, 300000
  );

  const { data: exams = [] } = useData<Exam[]>(
    `exams-${school?.id}-${year}`, "exams",
    { filters: school ? [{ column: "school_id", value: school.id }, { column: "year", value: Number(year) }] : [] },
    !!school?.id, 60000
  );

  const { data: students = [] } = useData<Student[]>(
    `students-${school?.id}-${gradeId}`, "students",
    {
      filters: [
        ...(school ? [{ column: "school_id", value: school.id }] : []),
        ...(gradeId ? [{ column: "grade_id", value: gradeId }] : []),
      ]
    },
    !!school?.id, 120000
  );

  const { data: results = [], loading: resultsLoading } = useData<Result[]>(
    `results-${school?.id}-${year}-${term}-${gradeId}`, "results",
    {
      filters: [
        ...(school ? [{ column: "school_id", value: school.id }] : []),
        ...(year ? [{ column: "year", value: Number(year) }] : []),
        ...(term ? [{ column: "term", value: term }] : []),
      ]
    },
    !!school?.id, 60000
  );

  const { data: attendance = [] } = useData<AttendanceRecord[]>(
    `attendance-${school?.id}-${year}`, "attendance",
    { filters: school ? [{ column: "school_id", value: school.id }] : [] },
    !!school?.id, 120000
  );

  // ── Filtered results ──
  const selectedExam = exams.find(e => e.id === examId);

  const filteredResults = useMemo(() => {
    let r = results;
    if (selectedExam) {
      r = r.filter(x => x.term === selectedExam.term && x.year === selectedExam.year);
    }
    if (gradeId) {
      const gradeStudentIds = new Set(students.map(s => s.id));
      r = r.filter(x => gradeStudentIds.has(x.student_id));
    }
    return r;
  }, [results, selectedExam, gradeId, students]);

  const filteredStudents = useMemo(() =>
    gradeId ? students.filter(s => s.grade_id === gradeId) : students,
    [students, gradeId]
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

  // ── Radar data for subject analysis ──
  const radarData = useMemo(() =>
    subjectAverages.slice(0, 8).map(s => ({ subject: s.name, avg: s.avg, max: 100 })),
    [subjectAverages]
  );

  // ── PDF Report Card ──
  const generateReportCardPDF = useCallback((student: Student) => {
    const doc = new jsPDF();
    const sw = doc.internal.pageSize.width;

    // Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, sw, 42, "F");

    doc.setFillColor(245, 158, 11); // amber-500
    doc.rect(0, 38, sw, 4, "F");

    doc.setTextColor(245, 158, 11);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(school?.name || "School", sw / 2, 18, { align: "center" });

    doc.setTextColor(200, 200, 200);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    if (school?.motto) doc.text(`"${school.motto}"`, sw / 2, 26, { align: "center" });

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("STUDENT REPORT CARD", sw / 2, 34, { align: "center" });

    // Student info panel
    doc.setFillColor(241, 245, 249); // slate-50
    doc.roundedRect(14, 50, sw - 28, 30, 3, 3, "F");
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(student.name, 20, 62);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Adm: ${student.admission_number}`, 20, 70);
    doc.text(`Gender: ${student.gender}`, 70, 70);
    const grade = grades.find(g => g.id === student.grade_id);
    doc.text(`Class: ${grade?.grade_name || "-"}`, 120, 70);
    doc.text(`Year: ${year}  |  Term: ${term || "All"}`, 20, 76);

    // Results table
    const subjectData = subjects.map(subj => {
      const res = filteredResults.find(r => r.student_id === student.id && r.subject_id === subj.id);
      const m = res?.marks;
      const g = m !== undefined ? getGrade(m) : null;
      return [subj.subject_name, subj.subject_code, m !== undefined ? String(m) : "-", g?.letter || "-", m !== undefined ? (m >= 50 ? "Pass" : "Fail") : "-"];
    }).filter(r => r[2] !== "-");

    if (subjectData.length) {
      autoTable(doc, {
        startY: 88,
        head: [["Subject", "Code", "Marks", "Grade", "Remarks"]],
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
      doc.text(`Overall Average: ${avgMarks.toFixed(1)}%  |  Grade: ${overallGrade.letter}  |  Subjects: ${subjectData.length}`, sw / 2, finalY + 13, { align: "center" });
    }

    // Footer
    const py = doc.internal.pageSize.height - 14;
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.5);
    doc.line(14, py - 4, sw - 14, py - 4);
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Generated by EduNexa Analytics", 14, py);
    doc.text(new Date().toLocaleDateString(), sw - 14, py, { align: "right" });

    doc.save(`ReportCard_${student.name.replace(/\s+/g, "_")}.pdf`);
  }, [school, grades, subjects, filteredResults, year, term]);

  // ── Bulk PDF ──
  const generateBulkPDF = useCallback(async () => {
    if (!studentRankings.length) return;
    setExportLoading(true);
    try {
      for (const student of studentRankings.slice(0, 50)) {
        generateReportCardPDF(student as Student);
        await new Promise(r => setTimeout(r, 100));
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
          Marks: r.marks,
          Grade: getGrade(r.marks).letter,
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
    XLSX.writeFile(wb, `EduNexa_${sheetName}_${year}_${term || "All"}.xlsx`);
  }, [filteredResults, studentRankings, subjectAverages, students, subjects, year, term]);

  // ── Helpers ──
  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return [y, y - 1, y - 2, y - 3].map(String);
  }, []);

  const filteredExams = useMemo(() =>
    exams.filter(e => (!gradeId || e.grade_id === gradeId || e.is_school_wide)),
    [exams, gradeId]
  );

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-900 text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Google Fonts */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display&display=swap');`}</style>

      {/* ── Page Header ── */}
      <div className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white" style={{ fontFamily: "'DM Serif Display', serif" }}>
                Assessment Hub
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {school?.name || "Loading…"} · Academic Intelligence
              </p>
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
                  className="text-xs bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  {f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              ))}
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex gap-1 mt-4 overflow-x-auto pb-px">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? "text-amber-400 bg-slate-800"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-3 right-3 h-0.5 bg-amber-400 rounded-full"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >

            {/* ══════════════════════ OVERVIEW ══════════════════════ */}
            {activeTab === "Overview" && (
              <div className="space-y-6">
                {/* KPI Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <KPICard label="Class Average" value={`${kpis.avg}%`} sub={`${filteredResults.length} entries`} accent="#f59e0b" />
                  <KPICard label="Pass Rate" value={`${kpis.passing}%`} sub="≥ 50 marks" accent="#10b981" />
                  <KPICard label="Top Performers" value={`${kpis.top}%`} sub="≥ 80 marks" accent="#3b82f6" />
                  <KPICard label="Total Students" value={kpis.total} sub={gradeId ? grades.find(g => g.id === gradeId)?.grade_name : "All grades"} accent="#8b5cf6" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Grade Distribution */}
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
                    <SectionTitle>Grade Distribution</SectionTitle>
                    {gradeDistribution.some(d => d.count > 0) ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={gradeDistribution} barSize={36}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis dataKey="letter" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                          <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                            {gradeDistribution.map((_, i) => (
                              <Cell key={i} fill={["#10b981", "#3b82f6", "#f59e0b", "#f97316", "#ef4444"][i]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <EmptyState msg="No results for selected filters" />}
                  </div>

                  {/* Term Trend */}
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
                    <SectionTitle>Term Average Trend</SectionTitle>
                    {termTrend.some(t => t.avg > 0) ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={termTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis dataKey="term" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Line type="monotone" dataKey="avg" name="Average" stroke="#f59e0b"
                            strokeWidth={2.5} dot={{ fill: "#f59e0b", r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : <EmptyState msg="No trend data available" />}
                  </div>
                </div>

                {/* Top Subjects */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
                  <SectionTitle>Subject Performance Snapshot</SectionTitle>
                  {subjectAverages.length > 0 ? (
                    <div className="space-y-3">
                      {subjectAverages.slice(0, 8).map((s, i) => (
                        <div key={s.name} className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 w-4 text-right">{i + 1}</span>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-medium text-slate-300">{s.fullName}</span>
                              <span className="text-xs font-bold text-white">{s.avg}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${s.avg}%` }}
                                transition={{ delay: i * 0.05, duration: 0.5 }}
                                className={`h-full rounded-full ${getPerformanceBar(s.avg)}`}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-slate-500 w-16 text-right">{s.count} entries</span>
                        </div>
                      ))}
                    </div>
                  ) : <EmptyState msg="No subject data for selected filters" />}
                </div>
              </div>
            )}

            {/* ══════════════════════ SUBJECT ANALYSIS ══════════════════════ */}
            {activeTab === "Subject Analysis" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Bar chart */}
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
                    <SectionTitle>Average Score by Subject</SectionTitle>
                    {subjectAverages.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={subjectAverages} layout="vertical" barSize={14}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                          <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                          <Bar dataKey="avg" name="Average" radius={[0, 4, 4, 0]}>
                            {subjectAverages.map((_, i) => (
                              <Cell key={i} fill={GRADE_COLORS[i % GRADE_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <EmptyState msg="No subject data for selected filters" />}
                  </div>

                  {/* Radar */}
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
                    <SectionTitle>Subject Radar</SectionTitle>
                    {radarData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="#334155" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                          <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#475569", fontSize: 8 }} />
                          <Radar name="Average" dataKey="avg" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
                          <Tooltip content={<CustomTooltip />} />
                        </RadarChart>
                      </ResponsiveContainer>
                    ) : <EmptyState msg="Not enough subjects for radar" />}
                  </div>
                </div>

                {/* Subject table */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
                  <div className="px-5 pt-5 pb-3">
                    <SectionTitle>Detailed Subject Breakdown</SectionTitle>
                  </div>
                  {subjectAverages.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-t border-b border-slate-700/50 bg-slate-900/40">
                            {["#", "Subject", "Code", "Average", "Grade", "Entries", "Performance"].map(h => (
                              <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 tracking-wider uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {subjectAverages.map((s, i) => {
                            const g = getGrade(s.avg);
                            return (
                              <tr key={s.name} className="border-b border-slate-800/50 hover:bg-slate-700/20 transition-colors">
                                <td className="px-5 py-3 text-slate-500 text-xs">{i + 1}</td>
                                <td className="px-5 py-3 font-medium text-slate-200">{s.fullName}</td>
                                <td className="px-5 py-3 text-slate-400 font-mono text-xs">{s.name}</td>
                                <td className="px-5 py-3 font-bold text-white">{s.avg}%</td>
                                <td className="px-5 py-3">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${g.bg}`}>{g.letter}</span>
                                </td>
                                <td className="px-5 py-3 text-slate-400">{s.count}</td>
                                <td className="px-5 py-3 w-36">
                                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${getPerformanceBar(s.avg)}`} style={{ width: `${s.avg}%` }} />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : <EmptyState msg="No data for selected filters" />}
                </div>
              </div>
            )}

            {/* ══════════════════════ RANKINGS ══════════════════════ */}
            {activeTab === "Rankings" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <SectionTitle>Student Rankings</SectionTitle>
                    <p className="text-xs text-slate-500 -mt-3">{studentRankings.length} students ranked · sorted by average</p>
                  </div>
                  <button
                    onClick={() => exportToExcel("rankings")}
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg transition-colors"
                  >
                    Export Rankings
                  </button>
                </div>

                {/* Top 3 podium */}
                {studentRankings.length >= 3 && (
                  <div className="grid grid-cols-3 gap-4">
                    {[studentRankings[1], studentRankings[0], studentRankings[2]].map((s, i) => {
                      const podiumRank = [2, 1, 3][i];
                      const isFirst = podiumRank === 1;
                      return (
                        <motion.div
                          key={s.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.1 }}
                          className={`relative text-center rounded-xl p-4 border ${
                            isFirst
                              ? "bg-amber-500/10 border-amber-500/30"
                              : "bg-slate-800/60 border-slate-700/50"
                          }`}
                        >
                          <div className={`text-2xl font-bold mb-1 ${isFirst ? "text-amber-400" : "text-slate-400"}`}>
                            #{podiumRank}
                          </div>
                          <div className="text-sm font-semibold text-white truncate">{s.name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{s.admission_number}</div>
                          <div className={`mt-2 text-lg font-bold ${isFirst ? "text-amber-300" : "text-slate-200"}`}>{s.avg}%</div>
                          <div className="text-xs text-slate-500">{s.subjects} subjects</div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Full table */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
                  {resultsLoading ? (
                    <div className="p-8 text-center text-slate-500 text-sm">Loading rankings…</div>
                  ) : studentRankings.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-700/50 bg-slate-900/40">
                            {["Rank", "Name", "Adm No", "Gender", "Average", "Total", "Subjects", "Grade", ""].map(h => (
                              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 tracking-wider uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {studentRankings.map(s => {
                            const g = getGrade(s.avg);
                            return (
                              <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-700/20 transition-colors">
                                <td className="px-4 py-3">
                                  <span className={`text-xs font-bold ${s.rank <= 3 ? "text-amber-400" : "text-slate-500"}`}>#{s.rank}</span>
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-200">{s.name}</td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-400">{s.admission_number}</td>
                                <td className="px-4 py-3 text-xs text-slate-400">{s.gender}</td>
                                <td className="px-4 py-3 font-bold text-white">{s.avg}%</td>
                                <td className="px-4 py-3 text-slate-300">{s.total}</td>
                                <td className="px-4 py-3 text-slate-400">{s.subjects}</td>
                                <td className="px-4 py-3">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${g.bg}`}>{g.letter}</span>
                                </td>
                                <td className="px-4 py-3">
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
                  ) : <EmptyState msg="No student results for selected filters" />}
                </div>
              </div>
            )}

            {/* ══════════════════════ REPORT CARDS ══════════════════════ */}
            {activeTab === "Report Cards" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Student selector */}
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
                    <SectionTitle>Select Student</SectionTitle>
                    <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
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
                          <div className="font-medium truncate">{s.name}</div>
                          <div className="text-xs text-slate-500">{s.admission_number}</div>
                        </button>
                      )) : <EmptyState msg="Select a grade to see students" />}
                    </div>
                  </div>

                  {/* Report card preview */}
                  <div className="lg:col-span-2">
                    {selectedStudent ? (
                      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
                        {/* Card header */}
                        <div className="bg-slate-900 px-6 py-4 border-b border-amber-500/30">
                          <div className="flex items-start justify-between">
                            <div>
                              <h2 className="text-base font-bold text-white" style={{ fontFamily: "'DM Serif Display', serif" }}>
                                {selectedStudent.name}
                              </h2>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {selectedStudent.admission_number} · {selectedStudent.gender} ·{" "}
                                {grades.find(g => g.id === selectedStudent.grade_id)?.grade_name || ""}
                              </p>
                            </div>
                            <button
                              onClick={() => generateReportCardPDF(selectedStudent)}
                              className="flex items-center gap-2 text-xs bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-4 py-2 rounded-lg transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              PDF
                            </button>
                          </div>
                        </div>

                        {/* Subject marks */}
                        {studentReportCard.length > 0 ? (
                          <>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-slate-700/50 bg-slate-900/30">
                                    {["Subject", "Code", "Marks", "Grade", "Status"].map(h => (
                                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {studentReportCard.map(r => {
                                    const g = r.marks !== null ? getGrade(r.marks) : null;
                                    return (
                                      <tr key={r.subject} className="border-b border-slate-800/40 hover:bg-slate-700/20 transition-colors">
                                        <td className="px-5 py-3 font-medium text-slate-200">{r.subject}</td>
                                        <td className="px-5 py-3 font-mono text-xs text-slate-400">{r.code}</td>
                                        <td className="px-5 py-3 font-bold text-white">{r.marks}</td>
                                        <td className="px-5 py-3">
                                          {g && <span className={`text-xs font-bold px-2 py-0.5 rounded ${g.bg}`}>{g.letter}</span>}
                                        </td>
                                        <td className="px-5 py-3">
                                          {r.marks !== null && (
                                            <span className={`text-xs font-medium ${r.marks >= 50 ? "text-emerald-400" : "text-red-400"}`}>
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

                            {/* Summary footer */}
                            {(() => {
                              const avg = studentReportCard.reduce((a, b) => a + (b.marks || 0), 0) / studentReportCard.length;
                              const g = getGrade(avg);
                              return (
                                <div className="bg-slate-900/50 px-5 py-3 flex items-center gap-6">
                                  <div>
                                    <span className="text-xs text-slate-500">Average</span>
                                    <p className="text-lg font-bold text-white">{avg.toFixed(1)}%</p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-slate-500">Grade</span>
                                    <p className={`text-lg font-bold ${g.bg.includes("emerald") ? "text-emerald-400" : g.bg.includes("blue") ? "text-blue-400" : g.bg.includes("amber") ? "text-amber-400" : "text-red-400"}`}>{g.letter}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-slate-500">Subjects</span>
                                    <p className="text-lg font-bold text-white">{studentReportCard.length}</p>
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        ) : (
                          <EmptyState msg="No results found for this student with current filters" />
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl flex items-center justify-center h-64">
                        <div className="text-center text-slate-500">
                          <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <p className="text-sm">Select a student to view their report card</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════ EXPORT CENTER ══════════════════════ */}
            {activeTab === "Export Center" && (
              <div className="space-y-6">
                <div>
                  <SectionTitle>Export Center</SectionTitle>
                  <p className="text-xs text-slate-500 -mt-3">Download data and reports in PDF or Excel format</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    {
                      icon: "📊", title: "Results Data", desc: "All filtered results with student and subject info",
                      actions: [{ label: "Export Excel", onClick: () => exportToExcel("results"), variant: "primary" }]
                    },
                    {
                      icon: "🏆", title: "Student Rankings", desc: "Ranked list of students with averages and totals",
                      actions: [{ label: "Export Excel", onClick: () => exportToExcel("rankings"), variant: "primary" }]
                    },
                    {
                      icon: "📚", title: "Subject Analysis", desc: "Subject averages and performance breakdown",
                      actions: [{ label: "Export Excel", onClick: () => exportToExcel("subjects"), variant: "primary" }]
                    },
                    {
                      icon: "📄", title: "Report Card (Single)", desc: selectedStudent ? `${selectedStudent.name}` : "Select a student in Report Cards tab",
                      actions: [{
                        label: "Generate PDF", variant: "amber",
                        onClick: () => { if (selectedStudent) generateReportCardPDF(selectedStudent); else setActiveTab("Report Cards"); }
                      }]
                    },
                    {
                      icon: "📋", title: "Bulk Report Cards", desc: `Generate PDFs for all ${studentRankings.length} ranked students (max 50)`,
                      actions: [{ label: exportLoading ? "Generating…" : "Generate All PDFs", onClick: generateBulkPDF, variant: "amber", disabled: exportLoading || !studentRankings.length }]
                    },
                  ].map(card => (
                    <motion.div
                      key={card.title}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 flex flex-col gap-4"
                    >
                      <div>
                        <div className="text-2xl mb-2">{card.icon}</div>
                        <h4 className="text-sm font-semibold text-white">{card.title}</h4>
                        <p className="text-xs text-slate-500 mt-1">{card.desc}</p>
                      </div>
                      <div className="flex flex-col gap-2 mt-auto">
                        {card.actions.map(a => (
                          <button
                            key={a.label}
                            onClick={a.onClick}
                            disabled={(a as any).disabled}
                            className={`text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${
                              (a as any).disabled ? "bg-slate-700 text-slate-500 cursor-not-allowed" :
                              a.variant === "amber"
                                ? "bg-amber-500 hover:bg-amber-400 text-slate-900"
                                : "bg-slate-700 hover:bg-slate-600 text-slate-200"
                            }`}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Export summary */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
                  <SectionTitle>Current Filter Summary</SectionTitle>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: "Year", value: year },
                      { label: "Term", value: term || "All" },
                      { label: "Grade", value: grades.find(g => g.id === gradeId)?.grade_name || "All" },
                      { label: "Exam", value: filteredExams.find(e => e.id === examId)?.exam_name || "All" },
                    ].map(f => (
                      <div key={f.label} className="bg-slate-900/50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">{f.label}</p>
                        <p className="text-sm font-semibold text-slate-200 mt-1">{f.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: "Total Results", value: filteredResults.length },
                      { label: "Students Ranked", value: studentRankings.length },
                      { label: "Subjects Tracked", value: subjectAverages.length },
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-3">
                        <div className="w-1.5 h-8 bg-amber-500 rounded-full" />
                        <div>
                          <p className="text-xs text-slate-500">{s.label}</p>
                          <p className="text-base font-bold text-white">{s.value}</p>
                        </div>
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