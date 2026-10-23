import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { Exam, Grade, Subject, Mark, Student } from '../types';
import {
  getKjjLevel, isValidMark, resolveSubjectSet, buildKjjRanking, countRanked, formatKjjTotal,
  formatKjjCoverage, formatKjjRank, KJJ_MAX_POINTS_PER_SUBJECT,
  type KjjTotals, type KjjRankStatus,
} from '../lib/kjj';
import { fetchWithProxy } from '../lib/fetchProxy';
import { useData } from '../hooks/useData';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { BarChart3, Award, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBorderToAllPages } from '../lib/pdfKit';

interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable: { finalY: number };
}

interface AnalyticsData {
  distribution: { name: string; value: number }[];
  subjectAverages: { name: string; average: number }[];
  rankedStudents: { name: string; kjj: KjjTotals; rank: number | null; rankStatus: KjjRankStatus; avg: number; subjectMarks: { [key: number]: number | string } }[];
  subjects: Subject[];
  notes: string[];
  stats: {
    totalStudents: number;
    rankedCount: number;
    mostCommon: string;
    classAverage: string;
    top5: { name: string; rank: number; kjjText: string }[];
    bottom5: { name: string; rank: number; kjjText: string }[];
    mostImproved?: { name: string; improvement: number };
  };
}

const Analytics = () => {
  const { user } = useAuth();
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [data, setData] = useState<AnalyticsData | null>(null);

  // Determine if super admin
  const isSuperAdmin = useMemo(() => {
    if (!user) return false;
    const role = (user.role || '').toLowerCase();
    return role === 'super_admin' || role === 'superadmin' || role.includes('super');
  }, [user]);

  // For super admin use selected school, otherwise use own school_id
  const effectiveSchoolId = isSuperAdmin ? (selectedSchool ? Number(selectedSchool) : null) : user?.school_id;

  // Always enable queries — super admin sees all, school admin sees own
  const queriesEnabled = isSuperAdmin ? true : !!user?.school_id;

  const schoolsQuery = useData<{ id: number; name: string }>(
    'schools-list-analytics',
    'schools',
    { select: 'id, name', orderBy: { column: 'name', ascending: true } },
    isSuperAdmin
  );

  const examsQuery = useData<Exam>('exams-list-analytics', 'exams', {
    select: 'id, exam_name, term, year',
    orderBy: { column: 'year', ascending: false },
    ...(effectiveSchoolId ? { filters: { school_id: effectiveSchoolId } } : {})
  }, queriesEnabled);

  const gradesQuery = useData<Grade>('grades-list-analytics', 'grades', {
    select: 'id, grade_name',
    orderBy: { column: 'grade_name', ascending: true },
    ...(effectiveSchoolId ? { filters: { school_id: effectiveSchoolId } } : {})
  }, queriesEnabled);

  const schools = useMemo(() => schoolsQuery.data || [], [schoolsQuery.data]);
  const exams = useMemo(() => examsQuery.data || [], [examsQuery.data]);
  const grades = useMemo(() => {
    const d = gradesQuery.data || [];
    return [...d].sort((a, b) => {
      const numA = parseInt(a.grade_name.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.grade_name.match(/\d+/)?.[0] || '0');
      if (numA !== numB) return numA - numB;
      return a.grade_name.localeCompare(b.grade_name);
    });
  }, [gradesQuery.data]);

  const fetchAnalyticsData = React.useCallback(async () => {
    try {
      if (!selectedExam || !selectedGrade) return;
      if (isSuperAdmin && !selectedSchool) return;

      const getReportData = async (examId: number, gradeId: number) => {
        const filters: Record<string, unknown> = { grade_id: gradeId };
        const markFilters: Record<string, unknown> = { exam_id: examId };
        if (effectiveSchoolId) {
          filters.school_id = effectiveSchoolId;
          markFilters.school_id = effectiveSchoolId;
        }

        const [students, subjects, marks] = await Promise.all([
          fetchWithProxy('students', { filters }),
          fetchWithProxy('subjects', effectiveSchoolId ? { filters: { school_id: effectiveSchoolId } } : {}),
          fetchWithProxy('marks', { filters: markFilters })
        ]);
        return {
          students: students.data || [],
          subjects: subjects.data || [],
          marks: marks.data || []
        };
      };

      const reportData = await getReportData(Number(selectedExam), Number(selectedGrade));
      const { students, subjects, marks } = reportData;

      const filteredSubjects = (subjects || []).filter((sub: Subject) => {
        const name = sub.subject_name.toLowerCase().trim();
        return !['science & technology', 'science and technology', 'music', 'art & craft', 'art and craft', 'physical education'].includes(name);
      });

      const sortedExams = [...exams].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        if (a.term !== b.term) return a.term - b.term;
        return a.id - b.id;
      });
      const currentIndex = sortedExams.findIndex(e => e.id.toString() === selectedExam);
      const previousExam = currentIndex > 0 ? sortedExams[currentIndex - 1] : null;

      let previousMarks: Mark[] = [];
      if (previousExam) {
        const prevData = await getReportData(previousExam.id, Number(selectedGrade));
        previousMarks = prevData.marks || [];
      }

      const gradeName = grades.find(g => g.id.toString() === selectedGrade)?.grade_name || '';

      // ── KJJ ranking (shared logic in ../lib/kjj) ──────────────────────────
      // Subjects included = those (after the existing subject exclusions) that
      // have at least one mark in this grade/exam. Ranked by TOTAL KJJ points,
      // highest first; never divided by the number of subjects. Only learners
      // assessed in every included subject are ranked; learners with missing
      // marks are listed unranked; ties use competition ranking (1, 2, 2, 4).
      const filteredIds = new Set(filteredSubjects.map((sub: Subject) => String(sub.id)));
      const studentIdSet = new Set(students.map((st: Student) => st.id));
      const subjectSet = resolveSubjectSet(
        marks
          .filter((m: Mark) => studentIdSet.has(m.student_id) && filteredIds.has(String(m.subject_id)) && isValidMark(m.score))
          .map((m: Mark) => m.subject_id),
        gradeName,
      );
      const markFor = (studentId: number, subjectId: string | number): number | null => {
        const m = marks.find((mk: Mark) => mk.student_id === studentId && String(mk.subject_id) === String(subjectId));
        return m && isValidMark(m.score) ? m.score : null;
      };
      const meanOf = (vals: (number | null | undefined)[]) => {
        const v = vals.filter(isValidMark);
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
      };

      const distributionMap: Record<string, number> = { EE1: 0, EE2: 0, ME1: 0, ME2: 0, AE1: 0, AE2: 0, BE1: 0, BE2: 0 };
      const entries = students.map((st: Student) => {
        const marksBySubject: Record<string, number | null> = {};
        subjectSet.subjectIds.forEach(sid => { marksBySubject[sid] = markFor(st.id, sid); });
        return { item: st, marks: marksBySubject };
      });
      const rankedAll = buildKjjRanking<Student>(entries, subjectSet.subjectIds).filter(r => !r.kjj.dns);

      const studentPerformance = rankedAll.map(r => {
        const avg = meanOf(subjectSet.subjectIds.map(sid => r.marks[sid]));
        const level = getKjjLevel(avg).code;
        distributionMap[level]++;
        const subjectMarks: { [key: number]: number | string } = {};
        filteredSubjects.forEach((sub: Subject) => {
          const v = markFor(r.item.id, sub.id);
          subjectMarks[sub.id] = v === null ? '-' : v;
        });
        return {
          id: r.item.id, name: r.item.name, kjj: r.kjj, rank: r.rank, rankStatus: r.rankStatus,
          avg: parseFloat(avg.toFixed(1)), subjectMarks,
        };
      });
      const ranked = studentPerformance; // already ordered: ranked (total ↓), incomplete, —
      const rankedOnly = ranked.filter(r => r.rank !== null);

      let mostImproved: { name: string; improvement: number } | undefined;
      if (previousExam) {
        let maxImp = -Infinity;
        studentPerformance.forEach(s => {
          const prevVals = previousMarks
            .filter(m => m.student_id === s.id && filteredIds.has(String(m.subject_id)) && isValidMark(m.score))
            .map(m => m.score);
          if (prevVals.length > 0) {
            // Improvement is measured on the mean mark (%) for reference — it is not a ranking.
            const imp = s.avg - meanOf(prevVals);
            if (imp > maxImp) {
              maxImp = imp;
              mostImproved = { name: s.name, improvement: parseFloat(imp.toFixed(1)) };
            }
          }
        });
      }

      const subjectAverages = filteredSubjects.map((sub: Subject) => {
        const subMarks = marks.filter((m: Mark) => m.subject_id === sub.id);
        const avg = subMarks.length > 0
          ? subMarks.reduce((acc: number, m: Mark) => acc + m.score, 0) / subMarks.length
          : 0;
        return { name: sub.subject_name, average: parseFloat(avg.toFixed(1)) };
      });

      const distEntries = Object.entries(distributionMap).sort((a, b) => b[1] - a[1]);

      setData({
        distribution: Object.entries(distributionMap).map(([name, value]) => ({ name, value })),
        subjectAverages,
        rankedStudents: ranked,
        subjects: filteredSubjects,
        notes: subjectSet.note ? [`${gradeName || 'Grade'}: ${subjectSet.note}`] : [],
        stats: {
          totalStudents: students.length,
          rankedCount: countRanked(rankedOnly),
          mostCommon: distEntries[0]?.[0] || 'N/A',
          classAverage: studentPerformance.length > 0
            ? (studentPerformance.reduce((acc, s) => acc + s.avg, 0) / studentPerformance.length).toFixed(1)
            : '0.0',
          top5: rankedOnly.slice(0, 5).map(s => ({ name: s.name, rank: s.rank as number, kjjText: formatKjjTotal(s.kjj) })),
          bottom5: rankedOnly.slice(-5).reverse().map(s => ({ name: s.name, rank: s.rank as number, kjjText: formatKjjTotal(s.kjj) })),
          mostImproved
        }
      });
    } catch (error) {
      console.error('Analytics fetch error:', error);
    }
  }, [selectedExam, selectedGrade, selectedSchool, exams, effectiveSchoolId, isSuperAdmin]);

  useEffect(() => {
    setData(null);
    Promise.resolve().then(() => fetchAnalyticsData());
  }, [fetchAnalyticsData]);

  const downloadExcel = () => {
    if (!data) return;
    const examName = exams.find(e => e.id.toString() === selectedExam)?.exam_name || 'Exam';
    const gradeName = grades.find(g => g.id.toString() === selectedGrade)?.grade_name || 'Grade';
    const headers = ['Rank', 'Student Name', ...data.subjects.map(sub => sub.subject_name), 'Total KJJ Points', 'Maximum Possible', 'KJJ Total', 'Subjects Assessed', 'Status', 'Average (%)', 'Performance Level'];
    const rows = data.rankedStudents.map(s => [
      formatKjjRank(s.rank, s.rankStatus), s.name,
      ...data.subjects.map(sub => s.subjectMarks[sub.id]),
      s.kjj.total, s.kjj.complete ? s.kjj.max : s.kjj.maxAssessed, formatKjjTotal(s.kjj),
      `${s.kjj.assessed} of ${s.kjj.included}`,
      s.rankStatus === 'ranked' ? 'Ranked' : 'Incomplete (not ranked)',
      s.avg, getKjjLevel(s.avg).code
    ]);
    const letterhead = [
      [(user?.school_name || 'EDU NEXA ANALYTICS').toUpperCase()],
      ['P.O. Box 42-20213 Kiptere'],
      ['Motto: Strive to Excel'],
      [''],
      [`STUDENT RANKINGS: ${gradeName} - ${examName}`],
      [''],
      headers
    ];
    const policy = [
      [''],
      [`Ranking = TOTAL KJJ points (EE1=8 … BE2=1, maximum ${KJJ_MAX_POINTS_PER_SUBJECT} per subject), highest first; not divided by the number of subjects. Equal totals share a rank (1, 2, 2, 4).`],
      ['Learners with missing subject marks show their partial total and are not ranked. Average (%) is for reference only.'],
      ...data.notes.map(n => [n]),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet([...letterhead, ...rows, ...policy]);
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: headers.length - 1 } },
    ];
    worksheet['!cols'] = [{ wch: 8 }, { wch: 30 }, ...data.subjects.map(() => ({ wch: 12 })), { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 20 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rankings");
    XLSX.writeFile(workbook, `Rankings_${gradeName}_${examName}.xlsx`);
  };

  const downloadPDF = () => {
    if (!data) return;
    const doc = new jsPDF('l', 'mm', 'a4') as jsPDFWithAutoTable;
    const examName = exams.find(e => e.id.toString() === selectedExam)?.exam_name || 'Exam';
    const gradeName = grades.find(g => g.id.toString() === selectedGrade)?.grade_name || 'Grade';
    const drawHeader = () => {
      doc.setFontSize(18); doc.setFont("helvetica", "bold");
      doc.text((user?.school_name || "SCHOOL ANALYSIS").toUpperCase(), 148, 20, { align: "center" });
      doc.setFontSize(11); doc.setFont("helvetica", "normal");
      doc.text("P.O. Box 42-20213 Kiptere", 148, 26, { align: "center" });
      doc.setFont("helvetica", "italic");
      doc.text("Motto: Strive to Excel", 148, 31, { align: "center" });
      doc.line(20, 35, 277, 35);
    };
    drawHeader();
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text(`EXAM PERFORMANCE SUMMARY: ${gradeName} - ${examName}`, 148, 45, { align: "center" });
    doc.setFontSize(12);
    doc.text("Top 5 Students", 20, 55);
    autoTable(doc, { startY: 60, margin: { right: 150 }, head: [['Rank', 'Name', 'KJJ Total']], body: data.stats.top5.map(s => [s.rank, s.name, s.kjjText]), theme: 'striped', headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255] } });
    const top5Y = (doc as jsPDFWithAutoTable).lastAutoTable.finalY;
    doc.text("Bottom 5 Students", 160, 55);
    autoTable(doc, { startY: 60, margin: { left: 150 }, head: [['Rank', 'Name', 'KJJ Total']], body: data.stats.bottom5.map(s => [s.rank, s.name, s.kjjText]), theme: 'striped', headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255] } });
    const bottom5Y = (doc as jsPDFWithAutoTable).lastAutoTable.finalY;
    const summaryY = Math.max(top5Y, bottom5Y) + 15;
    doc.text("Subject Performance Analysis", 20, summaryY);
    autoTable(doc, { startY: summaryY + 5, head: [['Subject', 'Average (%)', 'Level']], body: data.subjectAverages.map(sub => [sub.name, sub.average, getKjjLevel(sub.average).code]), theme: 'grid', headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] } });
    const subjectY = (doc as jsPDFWithAutoTable).lastAutoTable.finalY + 15;
    if (data.stats.mostImproved) {
      doc.setFont("helvetica", "bold");
      doc.text("Most Improved Student:", 20, subjectY);
      doc.setFont("helvetica", "normal");
      doc.text(`${data.stats.mostImproved.name} (+${data.stats.mostImproved.improvement} points)`, 70, subjectY);
    }
    doc.addPage(); drawHeader();
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text(`FULL STUDENT RANKINGS: ${gradeName} - ${examName}`, 148, 45, { align: "center" });
    const headers = ['Rank', 'Name', ...data.subjects.map(sub => sub.subject_name), 'KJJ Total', 'Avg %', 'Level'];
    const body = data.rankedStudents.map(s => [
      formatKjjRank(s.rank, s.rankStatus), s.name, ...data.subjects.map(sub => s.subjectMarks[sub.id]),
      formatKjjTotal(s.kjj) + (formatKjjCoverage(s.kjj) ? `\n${formatKjjCoverage(s.kjj)}` : ''),
      s.avg, getKjjLevel(s.avg).code,
    ]);
    autoTable(doc, { startY: 55, head: [headers], body, theme: 'grid', styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] } });
    {
      const fy = (doc as jsPDFWithAutoTable).lastAutoTable.finalY + 6;
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(60, 60, 60);
      doc.text([
        `Ranking = TOTAL KJJ points (EE1=8 … BE2=1, maximum ${KJJ_MAX_POINTS_PER_SUBJECT} per subject), highest first; not divided by the number of subjects. Equal totals share a rank (1, 2, 2, 4).`,
        'Learners with missing subject marks show their partial total and are not ranked. Average (%) is for reference only.',
        ...data.notes,
      ], 20, fy, { maxWidth: 257 });
    }
    addBorderToAllPages(doc);
    doc.save(`Performance_Report_${gradeName}_${examName}.pdf`);
  };

  const COLORS = ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#eff6ff'];

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-blue-900 p-4 rounded-xl text-white hidden sm:block">
            <div className="text-[10px] space-y-0.5 opacity-80 border-l-2 border-blue-400 pl-3">
              <p className="font-bold text-xs opacity-100">{(user?.school_name || "EDUNEXA SCHOOL").toUpperCase()}</p>
              <p>P.O. Box 42-20213 Kiptere</p>
              <p className="italic">Motto: Strive to Excel</p>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
            <p className="text-slate-500 text-sm">In-depth performance analysis and trends.</p>
          </div>
        </div>
        {data && (
          <div className="flex gap-2">
            <button onClick={downloadExcel} className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
              <FileSpreadsheet size={18} /> Excel
            </button>
            <button onClick={downloadPDF} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
              <FileText size={18} /> PDF Report
            </button>
          </div>
        )}
      </header>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-wrap gap-6">
       {/* School selector for super admin */}
        {isSuperAdmin && (
          <div className="space-y-1 flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-slate-500 uppercase">School</label>
            <select value={selectedSchool} onChange={(e) => { setSelectedSchool(e.target.value); setSelectedExam(''); setSelectedGrade(''); setData(null); }} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Select School</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-xs font-bold text-slate-500 uppercase">Exam</label>
          <select value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">Select Exam</option>
            {exams.map(e => <option key={e.id} value={e.id}>{e.exam_name}</option>)}
          </select>
        </div>
        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-xs font-bold text-slate-500 uppercase">Grade</label>
          <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">Select Grade</option>
            {grades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
          </select>
        </div>
      </div>

      {/* Prompt super admin to select school */}
      {isSuperAdmin && !selectedSchool && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center text-blue-600 font-medium">
          Please select a school to view analytics.
        </div>
      )}

      {data ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <p className="text-sm font-medium text-slate-500">Class Average (%)</p>
              <p className="text-3xl font-bold text-blue-600">{data.stats.classAverage}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <p className="text-sm font-medium text-slate-500">Most Common Level</p>
              <p className="text-3xl font-bold text-indigo-600">{data.stats.mostCommon}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <p className="text-sm font-medium text-slate-500">Most Improved Student</p>
              <p className="text-xl font-bold text-green-600">
                {data.stats.mostImproved ? (
                  <>{data.stats.mostImproved.name}<span className="text-sm font-normal text-slate-500 ml-2">(+{data.stats.mostImproved.improvement})</span></>
                ) : 'N/A'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Top 5 Students</h3>
              <div className="space-y-3">
                {data.stats.top5.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center bg-green-100 text-green-700 rounded-full text-xs font-bold">{s.rank}</span>
                      <span className="text-sm font-medium text-slate-700">{s.name}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{s.kjjText}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Bottom 5 Students</h3>
              <div className="space-y-3">
                {data.stats.bottom5.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center bg-red-100 text-red-700 rounded-full text-xs font-bold">{s.rank}</span>
                      <span className="text-sm font-medium text-slate-700">{s.name}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{s.kjjText}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Performance Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.distribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {data.distribution.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Subject Averages</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.subjectAverages}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 12]} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="average" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center gap-3">
              <Award size={20} className="text-blue-600" />
              <h3 className="text-lg font-bold text-slate-900">Full Student Rankings — Total KJJ Points</h3>
            </div>
            <div className="px-6 pt-4 space-y-2">
              {data.notes.map(n => (
                <div key={n} className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs px-3 py-2">⚠ {n}</div>
              ))}
              <p className="text-[11px] text-slate-400">Ranked by total KJJ points (EE1 = 8 … BE2 = 1), highest first — not divided by the number of subjects. Equal totals share a rank. Learners with missing marks are not ranked. {data.stats.rankedCount} of {data.rankedStudents.length} learners ranked.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-widest">
                    <th className="px-4 py-3 text-left font-bold">Rank</th>
                    <th className="px-4 py-3 text-left font-bold">Student</th>
                    {data.subjects.map(sub => (
                      <th key={sub.id} className="px-4 py-3 text-center font-bold">{sub.subject_name}</th>
                    ))}
                    <th className="px-4 py-3 text-center font-bold">KJJ Total</th>
                    <th className="px-4 py-3 text-center font-bold">Avg %</th>
                    <th className="px-4 py-3 text-center font-bold">Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.rankedStudents.map((s, i) => (
                    <tr key={i} className={`hover:bg-slate-50 transition-colors ${s.rank !== null && s.rank <= 3 ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-4 py-3 font-bold text-slate-400">{formatKjjRank(s.rank, s.rankStatus)}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {s.name}
                        {s.rankStatus === 'incomplete' && (
                          <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700" title="Missing marks — not ranked against learners with full coverage">Incomplete · not ranked</span>
                        )}
                      </td>
                      {data.subjects.map(sub => (
                        <td key={sub.id} className="px-4 py-3 text-center text-slate-600">{s.subjectMarks[sub.id]}</td>
                      ))}
                      <td className="px-4 py-3 text-center font-bold text-blue-600 whitespace-nowrap">
                        {formatKjjTotal(s.kjj)}
                        {formatKjjCoverage(s.kjj) && <div className="text-[10px] font-normal text-amber-700">{formatKjjCoverage(s.kjj)}</div>}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">{s.avg}%</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-bold">{getKjjLevel(s.avg).code}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        (!isSuperAdmin || selectedSchool) && selectedExam && selectedGrade ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          !isSuperAdmin && (
            <div className="bg-slate-50 rounded-xl p-12 text-center text-slate-400">
              <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
              <p className="font-medium">Select an exam and grade to view analytics</p>
            </div>
          )
        )
      )}
    </div>
  );
};

export default Analytics;