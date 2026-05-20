/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo } from "react";
import {
  Award,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Globe,
  GraduationCap,
  Hash,
  Mail,
  MapPin,
  Phone,
  Printer,
  Star,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { useAuth } from "../useAuth";
import { useData } from "../hooks/useData";

/* ────────────────────────────────────────────────────────────────
   CBC BAND HELPERS
──────────────────────────────────────────────────────────────── */
type Band = "EE" | "ME" | "AE" | "BE";

const bandFromScore = (score: number): Band => {
  if (score >= 75) return "EE";
  if (score >= 58) return "ME";
  if (score >= 31) return "AE";
  return "BE";
};

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

/* ────────────────────────────────────────────────────────────────
   MAIN COMPONENT
──────────────────────────────────────────────────────────────── */
const Reports = () => {
  const { user } = useAuth();

  // ── UI state ──
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);

  // ── SCHOOL ──
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
  const school = Array.isArray(schoolsData)
    ? schoolsData[0] ?? null
    : schoolsData ?? null;

  // ── STUDENTS ──
  const { data: studentsRaw = [] } = useData<any>(
    "students-report",
    "students",
    {
      select: "id,name,admission_number,gender,grade_id,grades:grade_id(grade_name)",
      orderBy: { column: "name", ascending: true },
    },
    !!user?.school_id
  );

  // ── EXAMS ──
  const { data: examsRaw = [] } = useData<any>(
    "exams-report",
    "exams",
    {
      select: "id,exam_name,term,year",
      orderBy: { column: "year", ascending: false },
    },
    !!user?.school_id
  );

  // ── RESULTS for selected student + exam ──
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

  // ── ALL RESULTS for selected exam (for rankings) ──
  const { data: allResultsRaw = [] } = useData<any>(
    `all-results-${selectedExamId}`,
    "results",
    {
      select: "id,student_id,exam_id,marks",
      filters: selectedExamId ? { exam_id: selectedExamId } : {},
    },
    !!selectedExamId
  );

  // ── Derived: selected student & exam objects ──
  const selectedStudent = useMemo(
    () => studentsRaw.find((s: any) => s.id === selectedStudentId) ?? null,
    [studentsRaw, selectedStudentId]
  );
  const selectedExam = useMemo(
    () => examsRaw.find((e: any) => e.id === selectedExamId) ?? null,
    [examsRaw, selectedExamId]
  );

  // ── Derived: per-subject report rows ──
  const reportResults = useMemo(() => {
    return resultsRaw.map((r: any) => {
      const grade = cbcGrade(r.marks);
      const points = cbcPoints(r.marks);
      const band = bandFromScore(r.marks);
      return {
        ...r,
        grade,
        points,
        remark:
          band === "EE"
            ? "Excellent mastery of the concepts. Keep up the impressive work."
            : band === "ME"
            ? "A good grasp of the work. Maintain the steady effort and revise often."
            : band === "AE"
            ? "Fair effort shown. More practice and consistent revision are needed."
            : "Requires extra support and remedial work. Please seek help promptly.",
      };
    });
  }, [resultsRaw]);

  // ── Derived: summary stats ──
  const totalMarks = useMemo(
    () => reportResults.reduce((sum: number, r: any) => sum + (r.marks ?? 0), 0),
    [reportResults]
  );
  const subjectCount = reportResults.length || 1;
  const percentage = useMemo(
    () => Math.round((totalMarks / (subjectCount * 100)) * 100),
    [totalMarks, subjectCount]
  );
  const overallGrade = cbcGrade(percentage);
  const overallPoints = useMemo(
    () => Math.round(reportResults.reduce((sum: number, r: any) => sum + (r.points ?? 0), 0) / subjectCount),
    [reportResults, subjectCount]
  );
  const band = bandFromScore(percentage);
  const teacherRemark = CLASS_TEACHER_REMARKS[band];
  const principalRemark = PRINCIPAL_REMARKS[band];

  // ── Derived: rankings ──
  const rankings = useMemo(() => {
    // Group all results by student_id, sum marks
    const totals: Record<number, number> = {};
    allResultsRaw.forEach((r: any) => {
      totals[r.student_id] = (totals[r.student_id] ?? 0) + (r.marks ?? 0);
    });
    // Map student details
    const rows = Object.entries(totals)
      .map(([sid, total]) => {
        const st = studentsRaw.find((s: any) => s.id === Number(sid));
        const subjects = allResultsRaw.filter((r: any) => r.student_id === Number(sid));
        const avg = subjects.length ? Math.round((total as number) / subjects.length) : 0;
        return {
          student_id: Number(sid),
          student_name: st?.name ?? "—",
          admission_number: st?.admission_number ?? "—",
          total_marks: total,
          average: avg,
          grade: cbcGrade(avg),
          points: cbcPoints(avg),
        };
      })
      .sort((a, b) => (b.total_marks as number) - (a.total_marks as number))
      .map((row, i) => ({ ...row, rank: i + 1 }));
    return rows;
  }, [allResultsRaw, studentsRaw]);

  const totalStudents = rankings.length;
  const studentRank = rankings.find((r) => r.student_id === selectedStudentId)?.rank ?? "—";

  const formattedDate = useMemo(() => new Date().toLocaleDateString(), []);

  const handlePrint = () => window.print();

  // ── Loading / no-selection state ──
  const showReport = !!selectedStudentId && !!selectedExamId && reportResults.length > 0;

  return (
    <div className="bg-slate-100 min-h-screen p-4 md:p-8">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-container { box-shadow: none !important; margin: 0 !important; width: 100% !important; }
          table { page-break-inside: avoid; }
        }
      `}</style>

      {/* ── SELECTOR BAR ── */}
      <div className="no-print flex flex-col sm:flex-row gap-3 mb-6">
        <select
          className="flex-1 border rounded-xl px-4 py-2 text-sm bg-white shadow-sm"
          value={selectedStudentId ?? ""}
          onChange={(e) => setSelectedStudentId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— Select Student —</option>
          {studentsRaw.map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.admission_number})
            </option>
          ))}
        </select>

        <select
          className="flex-1 border rounded-xl px-4 py-2 text-sm bg-white shadow-sm"
          value={selectedExamId ?? ""}
          onChange={(e) => setSelectedExamId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— Select Exam —</option>
          {examsRaw.map((e: any) => (
            <option key={e.id} value={e.id}>
              {e.exam_name} — Term {e.term}, {e.year}
            </option>
          ))}
        </select>

        {showReport && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-blue-950 hover:bg-blue-900 text-white px-5 py-2 rounded-xl transition-all text-sm"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        )}
      </div>

      {/* ── EMPTY STATE ── */}
      {!showReport && (
        <div className="text-center py-24 text-slate-400 text-sm">
          {!selectedStudentId || !selectedExamId
            ? "Select a student and exam above to generate the report."
            : "No results found for this student and exam."}
        </div>
      )}

      {/* ── REPORT ── */}
      {showReport && (
        <div className="print-container max-w-7xl mx-auto bg-white rounded-3xl overflow-hidden shadow-2xl">

          {/* LETTERHEAD */}
          <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 rounded-t-3xl overflow-hidden text-white relative">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,white,transparent)]" />
            <div className="relative z-10 px-6 py-8">
              <div className="flex flex-col md:flex-row items-center gap-5">
                <div className="bg-white rounded-2xl p-3 shadow-xl">
                  <img
                    src={school?.logo_url || "/placeholder.svg"}
                    alt="School Logo"
                    className="w-24 h-24 object-contain"
                  />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h1 className="text-3xl md:text-5xl font-black uppercase tracking-wide">
                    {school?.name}
                  </h1>
                  <div className="w-40 h-1 bg-yellow-400 rounded-full my-3 mx-auto md:mx-0" />
                  <p className="text-yellow-300 text-lg italic font-semibold">
                    Motto: {school?.motto || "Excellence Through Education"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* REPORT TITLE */}
          <div className="bg-white px-6 pt-6">
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="h-[2px] bg-yellow-500 flex-1 max-w-[120px]" />
              <h2 className="text-2xl md:text-4xl font-black uppercase text-blue-950 text-center">
                Student Progress Report
              </h2>
              <div className="h-[2px] bg-yellow-500 flex-1 max-w-[120px]" />
            </div>

            {/* STUDENT INFO */}
            <div className="border rounded-3xl p-6 grid md:grid-cols-3 gap-6 shadow-sm mb-8">
              <InfoCard icon={<User />} label="Student Name" value={selectedStudent?.name} />
              <InfoCard icon={<Hash />} label="Admission No." value={selectedStudent?.admission_number} />
              <InfoCard icon={<Users />} label="Gender" value={selectedStudent?.gender} />
              <InfoCard icon={<GraduationCap />} label="Grade / Class" value={(selectedStudent?.grades as any)?.grade_name} />
              <InfoCard icon={<ClipboardList />} label="Exam" value={selectedExam?.exam_name} />
              <InfoCard icon={<CalendarDays />} label="Term & Year" value={`Term ${selectedExam?.term}, ${selectedExam?.year}`} />
              <InfoCard icon={<Trophy />} label="Position In Class" value={`${studentRank} out of ${totalStudents}`} />
            </div>

            {/* RESULTS TABLE */}
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
                  {reportResults.map((subject: any, index: number) => (
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
                      <td className="p-4">{subject.remark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* SUMMARY */}
            <div className="grid md:grid-cols-4 gap-4 mb-8">
              <SummaryCard title="Total Marks" value={`${totalMarks}`} icon={<Award />} />
              <SummaryCard title="Percentage" value={`${percentage}%`} icon={<Star />} />
              <SummaryCard title="Overall Grade" value={overallGrade} icon={<GraduationCap />} />
              <SummaryCard title="Points" value={`${overallPoints}`} icon={<Trophy />} />
            </div>

            {/* GRADING SCALE */}
            <div className="border rounded-3xl p-5 mb-8">
              <h3 className="text-blue-950 font-black text-lg mb-4">GRADING SCALE</h3>
              <div className="flex flex-wrap gap-4 text-sm font-semibold text-slate-700">
                <span>EE1 (90–100%)</span>
                <span>EE2 (75–89%)</span>
                <span>ME1 (58–74%)</span>
                <span>ME2 (41–57%)</span>
                <span>AE1 (31–40%)</span>
                <span>AE2 (21–30%)</span>
                <span>BE1 (11–20%)</span>
                <span>BE2 (0–10%)</span>
              </div>
            </div>

            {/* REMARKS */}
            <div className="grid md:grid-cols-2 gap-6 mb-10">
              <div className="border rounded-3xl p-6">
                <h3 className="font-black text-blue-950 text-lg mb-4">Class Teacher's Remarks</h3>
                <p className="text-lg mb-10">{teacherRemark}</p>
                <div className="border-b border-dashed mb-2 w-52" />
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Teacher Signature</span>
                  <span>{formattedDate}</span>
                </div>
              </div>
              <div className="border rounded-3xl p-6">
                <h3 className="font-black text-blue-950 text-lg mb-4">Principal's Remarks</h3>
                <p className="text-lg mb-10">{principalRemark}</p>
                <div className="border-b border-dashed mb-2 w-52" />
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Principal Signature</span>
                  <span>{formattedDate}</span>
                </div>
              </div>
            </div>

            {/* STUDENT RANKINGS */}
            <div className="mt-12 mb-10">
              <div className="flex items-center justify-center gap-4 mb-8">
                <div className="h-[2px] bg-yellow-500 flex-1 max-w-[120px]" />
                <h2 className="text-2xl md:text-4xl font-black uppercase text-blue-950 text-center">
                  Student Rankings
                </h2>
                <div className="h-[2px] bg-yellow-500 flex-1 max-w-[120px]" />
              </div>
              <div className="overflow-x-auto border rounded-3xl shadow-sm">
                <table className="w-full">
                  <thead className="bg-blue-950 text-white">
                    <tr>
                      <th className="p-4 text-left">Rank</th>
                      <th className="p-4 text-left">Student Name</th>
                      <th className="p-4 text-left">Admission No</th>
                      <th className="p-4 text-center">Total Marks</th>
                      <th className="p-4 text-center">Average</th>
                      <th className="p-4 text-center">Grade</th>
                      <th className="p-4 text-center">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((item: any, index: number) => (
                      <tr
                        key={index}
                        className={`border-b transition-all hover:bg-slate-50 ${
                          item.rank === 1
                            ? "bg-yellow-100"
                            : item.rank === 2
                            ? "bg-slate-200"
                            : item.rank === 3
                            ? "bg-orange-100"
                            : "bg-white"
                        }`}
                      >
                        <td className="p-4 font-black text-blue-950">#{item.rank}</td>
                        <td className="p-4 font-semibold">{item.student_name}</td>
                        <td className="p-4">{item.admission_number}</td>
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
          </div>

          {/* FOOTER */}
          <div className="bg-blue-950 text-white px-6 py-5 rounded-b-3xl">
            <div className="grid md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /><span>{school?.address}</span></div>
              <div className="flex items-center gap-2"><Phone className="w-4 h-4" /><span>{school?.phone}</span></div>
              <div className="flex items-center gap-2"><Mail className="w-4 h-4" /><span>{school?.email}</span></div>
              <div className="flex items-center gap-2"><Globe className="w-4 h-4" /><span>{school?.website}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── SUB-COMPONENTS ── */
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