/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo, useRef } from "react";
import {
  Award, BookOpen, CalendarDays, ClipboardList, GraduationCap, Hash,
  Mail, MapPin, Phone, Globe, Printer, Star, Trophy, User, Users,
  Sparkles, ShieldCheck, FileText, TrendingUp, Search, Download,
} from "lucide-react";
import { useAuth } from "../useAuth";
import { useData } from "../hooks/useData";

/* ────────────────────────────────────────────────────────────────
   CBC BAND HELPERS
──────────────────────────────────────────────────────────────── */
type Band = "EE" | "ME" | "AE" | "BE";

const bandFromScore = (s: number): Band =>
  s >= 75 ? "EE" : s >= 58 ? "ME" : s >= 31 ? "AE" : "BE";

const cbcGrade = (s: number): string =>
  s >= 90 ? "EE1" : s >= 75 ? "EE2" : s >= 58 ? "ME1" : s >= 41 ? "ME2"
  : s >= 31 ? "AE1" : s >= 21 ? "AE2" : s >= 11 ? "BE1" : "BE2";

const cbcPoints = (s: number): number =>
  s >= 90 ? 8 : s >= 75 ? 7 : s >= 58 ? 6 : s >= 41 ? 5
  : s >= 31 ? 4 : s >= 21 ? 3 : s >= 11 ? 2 : 1;

const BAND_TONE: Record<Band, { ring: string; chip: string; text: string; soft: string }> = {
  EE: { ring: "ring-emerald-300", chip: "bg-emerald-100 text-emerald-800", text: "text-emerald-700", soft: "from-emerald-50 to-emerald-100/40" },
  ME: { ring: "ring-sky-300",     chip: "bg-sky-100 text-sky-800",         text: "text-sky-700",     soft: "from-sky-50 to-sky-100/40" },
  AE: { ring: "ring-amber-300",   chip: "bg-amber-100 text-amber-800",     text: "text-amber-700",   soft: "from-amber-50 to-amber-100/40" },
  BE: { ring: "ring-rose-300",    chip: "bg-rose-100 text-rose-800",       text: "text-rose-700",    soft: "from-rose-50 to-rose-100/40" },
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

const SUBJECT_REMARK = (s: number) =>
  s >= 75 ? "Excellent mastery of the concepts. Keep up the impressive work."
: s >= 58 ? "A good grasp of the work. Maintain the steady effort and revise often."
: s >= 31 ? "Fair effort shown. More practice and consistent revision are needed."
:           "Requires extra support and remedial work. Please seek help promptly.";

/* ────────────────────────────────────────────────────────────────
   MAIN COMPONENT
──────────────────────────────────────────────────────────────── */
const Reports: React.FC = () => {
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);

  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [studentQuery, setStudentQuery] = useState("");

  /* SCHOOL */
  const { data: schoolsData } = useData<any>(
    `school-${user?.school_id}`,
    "schools",
    {
      select: "id,name,logo_url,motto,address,phone,email,website",
      filters: { id: user?.school_id },
      single: true,
    },
    !!user?.school_id
  );
  const school = Array.isArray(schoolsData) ? schoolsData[0] ?? null : schoolsData ?? null;

  /* STUDENTS */
  const { data: studentsRaw = [] } = useData<any>(
    "students-report",
    "students",
    {
      select: "id,name,admission_number,gender,grade_id,grades:grade_id(grade_name)",
      orderBy: { column: "name", ascending: true },
    },
    !!user?.school_id
  );

  /* EXAMS */
  const { data: examsRaw = [] } = useData<any>(
    "exams-report",
    "exams",
    {
      select: "id,exam_name,term,year",
      orderBy: { column: "year", ascending: false },
    },
    !!user?.school_id
  );

  /* RESULTS for selected student + exam */
  const { data: resultsRaw = [] } = useData<any>(
    `results-${selectedStudentId}-${selectedExamId}`,
    "results",
    {
      select: "id,student_id,exam_id,subject_name,marks",
      filters: {
        ...(selectedStudentId ? { student_id: selectedStudentId } : {}),
        ...(selectedExamId ? { exam_id: selectedExamId } : {}),
      },
    },
    !!selectedStudentId && !!selectedExamId
  );

  /* ALL RESULTS for selected exam (rankings) */
  const { data: allResultsRaw = [] } = useData<any>(
    `all-results-${selectedExamId}`,
    "results",
    {
      select: "id,student_id,exam_id,marks",
      filters: selectedExamId ? { exam_id: selectedExamId } : {},
    },
    !!selectedExamId
  );

  const selectedStudent = useMemo(
    () => studentsRaw.find((s: any) => s.id === selectedStudentId) ?? null,
    [studentsRaw, selectedStudentId]
  );
  const selectedExam = useMemo(
    () => examsRaw.find((e: any) => e.id === selectedExamId) ?? null,
    [examsRaw, selectedExamId]
  );

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return studentsRaw;
    return studentsRaw.filter(
      (s: any) =>
        s.name?.toLowerCase().includes(q) ||
        String(s.admission_number)?.toLowerCase().includes(q)
    );
  }, [studentsRaw, studentQuery]);

  const reportResults = useMemo(
    () =>
      resultsRaw.map((r: any) => ({
        ...r,
        grade: cbcGrade(r.marks),
        points: cbcPoints(r.marks),
        band: bandFromScore(r.marks),
        remark: SUBJECT_REMARK(r.marks),
      })),
    [resultsRaw]
  );

  const totalMarks = reportResults.reduce((sum: number, r: any) => sum + (r.marks ?? 0), 0);
  const subjectCount = reportResults.length || 1;
  const percentage = Math.round((totalMarks / (subjectCount * 100)) * 100);
  const overallGrade = cbcGrade(percentage);
  const overallPoints = Math.round(
    reportResults.reduce((sum: number, r: any) => sum + (r.points ?? 0), 0) / subjectCount
  );
  const band = bandFromScore(percentage);
  const tone = BAND_TONE[band];
  const teacherRemark = CLASS_TEACHER_REMARKS[band];
  const principalRemark = PRINCIPAL_REMARKS[band];

  const rankings = useMemo(() => {
    const totals: Record<number, number> = {};
    allResultsRaw.forEach((r: any) => {
      totals[r.student_id] = (totals[r.student_id] ?? 0) + (r.marks ?? 0);
    });
    return Object.entries(totals)
      .map(([sid, total]) => {
        const st = studentsRaw.find((s: any) => s.id === Number(sid));
        const subjects = allResultsRaw.filter((r: any) => r.student_id === Number(sid));
        const avg = subjects.length ? Math.round((total as number) / subjects.length) : 0;
        return {
          student_id: Number(sid),
          student_name: st?.name ?? "—",
          admission_number: st?.admission_number ?? "—",
          total_marks: total as number,
          average: avg,
          grade: cbcGrade(avg),
          points: cbcPoints(avg),
        };
      })
      .sort((a, b) => b.total_marks - a.total_marks)
      .map((row, i) => ({ ...row, rank: i + 1 }));
  }, [allResultsRaw, studentsRaw]);

  const totalStudents = rankings.length;
  const studentRank = rankings.find((r) => r.student_id === selectedStudentId)?.rank ?? "—";
  const classAverage = rankings.length
    ? Math.round(rankings.reduce((s, r) => s + r.average, 0) / rankings.length)
    : 0;

  const formattedDate = new Date().toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });
  const serial = useMemo(() => {
    const stamp = Date.now().toString(36).toUpperCase().slice(-6);
    return `RPT-${selectedExamId ?? "X"}-${selectedStudentId ?? "X"}-${stamp}`;
  }, [selectedStudentId, selectedExamId]);

  const handlePrint = () => window.print();
  const showReport = !!selectedStudentId && !!selectedExamId && reportResults.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 p-4 md:p-8 relative overflow-hidden">
      {/* Aurora background */}
      <div className="pointer-events-none absolute inset-0 -z-0 no-print">
        <div className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute top-1/2 -right-32 h-[420px] w-[420px] rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[360px] w-[360px] rounded-full bg-cyan-300/20 blur-3xl" />
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-container { box-shadow: none !important; margin: 0 !important; width: 100% !important; border-radius: 0 !important; }
          .avoid-break { page-break-inside: avoid; }
        }
      `}</style>

      {/* ── CONTROL BAR ── */}
      <div className="no-print relative z-10 max-w-7xl mx-auto mb-6">
        <div className="rounded-3xl bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-3 md:pr-4 md:border-r border-slate-200">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 grid place-items-center text-white shadow-lg">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold">Academic Office</p>
                <h1 className="text-base md:text-lg font-black text-slate-900 leading-tight">Report Card Generator</h1>
              </div>
            </div>

            <div className="flex-1 grid sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  placeholder="Search student…"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <select
                className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                value={selectedStudentId ?? ""}
                onChange={(e) => setSelectedStudentId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— Select Student —</option>
                {filteredStudents.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.admission_number})</option>
                ))}
              </select>
              <select
                className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                value={selectedExamId ?? ""}
                onChange={(e) => setSelectedExamId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— Select Exam —</option>
                {examsRaw.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.exam_name} — Term {e.term}, {e.year}</option>
                ))}
              </select>
            </div>

            {showReport && (
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 text-white text-sm font-semibold shadow-lg hover:shadow-blue-500/30 transition-all"
              >
                <Printer className="w-4 h-4" />
                Print / Save PDF
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── EMPTY STATE ── */}
      {!showReport && (
        <div className="no-print relative z-10 max-w-3xl mx-auto text-center py-20">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl grid place-items-center mb-4">
            <Sparkles className="w-7 h-7 text-blue-600" />
          </div>
          <h2 className="text-xl font-black text-slate-800">Generate a premium report card</h2>
          <p className="text-sm text-slate-500 mt-2">
            {(!selectedStudentId || !selectedExamId)
              ? "Select a student and an exam to build the official school report."
              : "No results found for this student and exam yet."}
          </p>
        </div>
      )}

      {/* ── REPORT ── */}
      {showReport && (
        <div
          ref={printRef}
          className="print-container relative z-10 max-w-7xl mx-auto bg-white rounded-[28px] overflow-hidden shadow-[0_30px_80px_-30px_rgba(15,23,42,0.35)] ring-1 ring-slate-200"
        >
          {/* ── LETTERHEAD ── */}
          <div className="relative overflow-hidden text-white">
            <div className="absolute inset-0 bg-[linear-gradient(120deg,#0b1d4a_0%,#142b6f_45%,#1e3a8a_75%,#1e1b4b_100%)]" />
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.35),transparent_60%)]" />
            <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-yellow-400/15 blur-3xl" />
            <div className="absolute -top-16 right-20 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />

            {/* Top hairlines */}
            <div className="relative z-10 flex items-center gap-2 px-8 pt-4">
              <span className="h-px flex-1 bg-white/20" />
              <span className="text-[10px] tracking-[0.3em] text-white/60 uppercase">Official Document</span>
              <span className="h-px flex-1 bg-white/20" />
            </div>

            <div className="relative z-10 px-8 py-7">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="shrink-0">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-2xl bg-yellow-400/40 blur-xl" />
                    <div className="relative bg-white rounded-2xl p-3 shadow-2xl ring-1 ring-white/40">
                      <img
                        src={school?.logo_url || "/placeholder.svg"}
                        alt={`${school?.name ?? "School"} logo`}
                        className="w-24 h-24 object-contain"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex-1 text-center md:text-left">
                  <p className="text-[11px] tracking-[0.35em] text-yellow-300/90 uppercase font-semibold">
                    {selectedExam?.exam_name} • Term {selectedExam?.term} • {selectedExam?.year}
                  </p>
                  <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight mt-1 drop-shadow-sm">
                    {school?.name ?? "School Name"}
                  </h1>
                  <div className="flex items-center gap-2 mt-3 justify-center md:justify-start">
                    <span className="h-[3px] w-10 bg-yellow-400 rounded-full" />
                    <p className="italic text-yellow-200/95 text-sm md:text-base font-medium">
                      {school?.motto ? `“${school.motto}”` : "“Excellence Through Education”"}
                    </p>
                    <span className="h-[3px] w-10 bg-yellow-400/40 rounded-full" />
                  </div>

                  <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-x-5 gap-y-1.5 text-[12px] text-white/85">
                    {school?.address && <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-yellow-300" />{school.address}</span>}
                    {school?.phone   && <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-yellow-300" />{school.phone}</span>}
                    {school?.email   && <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-yellow-300" />{school.email}</span>}
                    {school?.website && <span className="inline-flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-yellow-300" />{school.website}</span>}
                  </div>
                </div>

                {/* Serial / authenticity */}
                <div className="hidden md:flex flex-col items-end gap-2">
                  <div className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-[11px] tracking-widest uppercase backdrop-blur">
                    <ShieldCheck className="inline w-3.5 h-3.5 mr-1 text-emerald-300" />
                    Verified
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] tracking-[0.25em] uppercase text-white/60">Serial No.</p>
                    <p className="font-mono text-sm text-white/95">{serial}</p>
                    <p className="text-[10px] text-white/60 mt-0.5">Issued {formattedDate}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Gold accent strip */}
            <div className="relative z-10 h-2 bg-gradient-to-r from-yellow-500 via-yellow-300 to-yellow-500" />
          </div>

          {/* ── BODY ── */}
          <div className="px-6 md:px-10 pt-8 pb-2">
            {/* Title */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="h-[2px] bg-gradient-to-r from-transparent via-yellow-500 to-transparent flex-1 max-w-[160px]" />
              <h2 className="text-2xl md:text-3xl font-black uppercase text-blue-950 tracking-wide">
                Student Progress Report
              </h2>
              <div className="h-[2px] bg-gradient-to-r from-transparent via-yellow-500 to-transparent flex-1 max-w-[160px]" />
            </div>

            {/* Student info + Hero score */}
            <div className="grid lg:grid-cols-3 gap-5 mb-8 avoid-break">
              <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <InfoCard icon={<User className="w-4 h-4" />} label="Student Name" value={selectedStudent?.name} />
                  <InfoCard icon={<Hash className="w-4 h-4" />} label="Admission No." value={selectedStudent?.admission_number} />
                  <InfoCard icon={<Users className="w-4 h-4" />} label="Gender" value={selectedStudent?.gender} />
                  <InfoCard icon={<GraduationCap className="w-4 h-4" />} label="Grade / Class" value={(selectedStudent?.grades as any)?.grade_name} />
                  <InfoCard icon={<ClipboardList className="w-4 h-4" />} label="Exam" value={selectedExam?.exam_name} />
                  <InfoCard icon={<CalendarDays className="w-4 h-4" />} label="Term & Year" value={`Term ${selectedExam?.term}, ${selectedExam?.year}`} />
                </div>
              </div>

              <div className={`rounded-2xl p-5 border ring-1 ${tone.ring} bg-gradient-to-br ${tone.soft} shadow-sm relative overflow-hidden`}>
                <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/40 blur-2xl" />
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-semibold">Overall Performance</p>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-6xl font-black text-slate-900 leading-none">{percentage}</span>
                  <span className="text-2xl font-bold text-slate-500 mb-1">%</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${tone.chip}`}>Grade {overallGrade}</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900 text-white">{overallPoints} pts</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/70 text-slate-700 border border-slate-200">
                    <Trophy className="inline w-3 h-3 mr-1 text-yellow-600" />
                    Rank {studentRank}/{totalStudents}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="h-2 w-full rounded-full bg-white/70 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10px] text-slate-500 font-semibold">
                    <span>Class Avg {classAverage}%</span>
                    <span>Target 100%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* RESULTS TABLE */}
            <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8 avoid-break">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Learning Areas</h3>
                <span className="text-[11px] text-slate-500">{reportResults.length} subjects</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-blue-950 to-indigo-900 text-white">
                    <tr>
                      <th className="p-4 text-left font-semibold">Learning Area</th>
                      <th className="p-4 text-center font-semibold">Marks</th>
                      <th className="p-4 text-left font-semibold w-1/3">Performance</th>
                      <th className="p-4 text-center font-semibold">Grade</th>
                      <th className="p-4 text-center font-semibold">Points</th>
                      <th className="p-4 text-left font-semibold">Teacher's Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportResults.map((subject: any, index: number) => {
                      const t = BAND_TONE[subject.band as Band];
                      return (
                        <tr key={index} className={`border-b last:border-0 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                          <td className="p-4 font-semibold text-slate-800">
                            <div className="flex items-center gap-3">
                              <span className="h-8 w-8 rounded-lg bg-blue-50 text-blue-700 grid place-items-center">
                                <BookOpen className="w-4 h-4" />
                              </span>
                              {subject.subject_name}
                            </div>
                          </td>
                          <td className="p-4 text-center font-black text-slate-900">{subject.marks}</td>
                          <td className="p-4">
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"
                                style={{ width: `${Math.min(100, Math.max(0, subject.marks))}%` }}
                              />
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${t.chip}`}>{subject.grade}</span>
                          </td>
                          <td className="p-4 text-center font-bold text-slate-700">{subject.points}</td>
                          <td className="p-4 text-slate-600 text-[13px]">{subject.remark}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SUMMARY */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 avoid-break">
              <SummaryCard title="Total Marks" value={`${totalMarks}`} sub={`/ ${subjectCount * 100}`} icon={<Award className="w-4 h-4" />} accent="from-blue-600 to-indigo-600" />
              <SummaryCard title="Percentage" value={`${percentage}%`} sub={`Class avg ${classAverage}%`} icon={<Star className="w-4 h-4" />} accent="from-amber-500 to-orange-600" />
              <SummaryCard title="Overall Grade" value={overallGrade} sub={`Band ${band}`} icon={<GraduationCap className="w-4 h-4" />} accent="from-emerald-500 to-teal-600" />
              <SummaryCard title="Class Position" value={`${studentRank}`} sub={`of ${totalStudents}`} icon={<Trophy className="w-4 h-4" />} accent="from-fuchsia-500 to-pink-600" />
            </div>

            {/* GRADING SCALE */}
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 mb-8 avoid-break">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">CBC Grading Scale</h3>
                <span className="text-[11px] text-slate-500">EE • ME • AE • BE</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 text-xs font-semibold">
                {[
                  ["EE1","90–100"],["EE2","75–89"],["ME1","58–74"],["ME2","41–57"],
                  ["AE1","31–40"],["AE2","21–30"],["BE1","11–20"],["BE2","0–10"],
                ].map(([g, r]) => (
                  <div key={g} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center">
                    <p className="text-blue-950 font-black">{g}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{r}%</p>
                  </div>
                ))}
              </div>
            </div>

            {/* REMARKS */}
            <div className="grid md:grid-cols-2 gap-5 mb-10 avoid-break">
              <RemarkCard title="Class Teacher's Remarks" body={teacherRemark} signer="Class Teacher" date={formattedDate} />
              <RemarkCard title="Principal's Remarks" body={principalRemark} signer="Principal" date={formattedDate} />
            </div>

            {/* RANKINGS */}
            <div className="mt-2 mb-8">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="h-[2px] bg-gradient-to-r from-transparent via-yellow-500 to-transparent flex-1 max-w-[140px]" />
                <h2 className="text-xl md:text-2xl font-black uppercase text-blue-950 tracking-wide flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-700" /> Class Rankings
                </h2>
                <div className="h-[2px] bg-gradient-to-r from-transparent via-yellow-500 to-transparent flex-1 max-w-[140px]" />
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-blue-950 to-indigo-900 text-white">
                    <tr>
                      <th className="p-3.5 text-left font-semibold">Rank</th>
                      <th className="p-3.5 text-left font-semibold">Student Name</th>
                      <th className="p-3.5 text-left font-semibold">Adm. No</th>
                      <th className="p-3.5 text-center font-semibold">Total</th>
                      <th className="p-3.5 text-center font-semibold">Average</th>
                      <th className="p-3.5 text-center font-semibold">Grade</th>
                      <th className="p-3.5 text-center font-semibold">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((item) => {
                      const isMe = item.student_id === selectedStudentId;
                      const podium =
                        item.rank === 1 ? "bg-yellow-50" :
                        item.rank === 2 ? "bg-slate-50" :
                        item.rank === 3 ? "bg-orange-50" : "bg-white";
                      return (
                        <tr
                          key={item.student_id}
                          className={`border-b last:border-0 ${podium} ${isMe ? "ring-2 ring-inset ring-blue-500/40 bg-blue-50/70" : ""}`}
                        >
                          <td className="p-3.5">
                            <span className={`inline-flex items-center justify-center h-7 min-w-[34px] px-2 rounded-full text-xs font-black ${
                              item.rank === 1 ? "bg-yellow-400 text-yellow-950" :
                              item.rank === 2 ? "bg-slate-300 text-slate-800" :
                              item.rank === 3 ? "bg-orange-300 text-orange-950" :
                              "bg-slate-100 text-slate-700"
                            }`}>#{item.rank}</span>
                          </td>
                          <td className="p-3.5 font-semibold text-slate-800">
                            {item.student_name}{isMe && <span className="ml-2 text-[10px] uppercase tracking-wider text-blue-700 font-black">You</span>}
                          </td>
                          <td className="p-3.5 text-slate-600">{item.admission_number}</td>
                          <td className="p-3.5 text-center font-black text-slate-900">{item.total_marks}</td>
                          <td className="p-3.5 text-center">{item.average}%</td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${BAND_TONE[bandFromScore(item.average)].chip}`}>{item.grade}</span>
                          </td>
                          <td className="p-3.5 text-center font-bold">{item.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── FOOTER ── */}
          <div className="relative text-white overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(120deg,#0b1d4a,#1e1b4b)]" />
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.4),transparent_55%)]" />
            <div className="relative z-10 px-6 md:px-10 py-6 grid md:grid-cols-3 gap-4 text-[12px]">
              <div>
                <p className="text-[10px] tracking-[0.3em] text-yellow-300 uppercase font-semibold mb-2">Contact</p>
                <ul className="space-y-1.5">
                  {school?.address && <li className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-yellow-300" />{school.address}</li>}
                  {school?.phone   && <li className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-yellow-300" />{school.phone}</li>}
                  {school?.email   && <li className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-yellow-300" />{school.email}</li>}
                  {school?.website && <li className="flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-yellow-300" />{school.website}</li>}
                </ul>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.3em] text-yellow-300 uppercase font-semibold mb-2">Authenticity</p>
                <p className="font-mono text-white/95">{serial}</p>
                <p className="text-white/70 mt-1">Issued on {formattedDate}</p>
                <p className="text-white/60 mt-1">This document is computer-generated and certified by {school?.name ?? "the school"}.</p>
              </div>
              <div className="md:text-right">
                <p className="text-[10px] tracking-[0.3em] text-yellow-300 uppercase font-semibold mb-2">Powered by</p>
                <p className="text-white/95 font-black tracking-wide">EduNexa Analytics</p>
                <p className="text-white/60">© {new Date().getFullYear()} {school?.name ?? "School"} • All rights reserved.</p>
              </div>
            </div>
            <div className="h-1.5 bg-gradient-to-r from-yellow-500 via-yellow-300 to-yellow-500" />
          </div>
        </div>
      )}
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────
   SUBCOMPONENTS
──────────────────────────────────────────────────────────────── */
const InfoCard: React.FC<{ icon: React.ReactNode; label: string; value?: React.ReactNode }> = ({ icon, label, value }) => (
  <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 hover:shadow-sm transition-shadow">
    <div className="flex items-center gap-2 text-slate-500">
      <span className="h-7 w-7 rounded-lg bg-blue-50 text-blue-700 grid place-items-center">{icon}</span>
      <p className="text-[10px] uppercase tracking-[0.18em] font-bold">{label}</p>
    </div>
    <p className="mt-2 text-[15px] font-black text-slate-900 leading-snug">{value ?? "—"}</p>
  </div>
);

const SummaryCard: React.FC<{
  title: string; value: string; sub?: string; icon: React.ReactNode; accent: string;
}> = ({ title, value, sub, icon, accent }) => (
  <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className={`absolute -top-10 -right-10 h-24 w-24 rounded-full bg-gradient-to-br ${accent} opacity-10`} />
    <div className="flex items-center gap-2 text-slate-500">
      <span className={`h-7 w-7 rounded-lg bg-gradient-to-br ${accent} text-white grid place-items-center shadow`}>{icon}</span>
      <p className="text-[10px] uppercase tracking-[0.18em] font-bold">{title}</p>
    </div>
    <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
  </div>
);

const RemarkCard: React.FC<{ title: string; body: string; signer: string; date: string }> = ({ title, body, signer, date }) => (
  <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
    <div className="flex items-center gap-2 mb-3">
      <span className="h-7 w-7 rounded-lg bg-blue-50 text-blue-700 grid place-items-center">
        <FileText className="w-4 h-4" />
      </span>
      <h3 className="font-black text-blue-950 text-sm uppercase tracking-wide">{title}</h3>
    </div>
    <p className="text-slate-700 leading-relaxed text-[14px] mb-10">{body}</p>
    <div className="border-b border-dashed border-slate-300 mb-2 w-56" />
    <div className="flex justify-between text-[12px] text-slate-500">
      <span className="font-semibold">{signer} Signature</span>
      <span>{date}</span>
    </div>
  </div>
);

export default Reports;
