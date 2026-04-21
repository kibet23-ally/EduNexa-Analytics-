import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { Exam, Grade, Subject, Mark, Student } from '../types';
import { getOverallGrade } from '../lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { BarChart3, Award, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable: { finalY: number };
}

interface AnalyticsData {
  distribution: { name: string; value: number }[];
  subjectAverages: { name: string; average: number }[];
  rankedStudents: { name: string; avgPoints: number; totalScore: number; subjectMarks: { [key: number]: number | string } }[];
  subjects: Subject[];
  stats: {
    totalStudents: number;
    mostCommon: string;
    classAverage: string;
    top5: { name: string; avgPoints: number }[];
    bottom5: { name: string; avgPoints: number }[];
    mostImproved?: { name: string; improvement: number };
  };
}

const Analytics = () => {
  const { token, user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [e, g] = await Promise.all([
        fetch('/api/exams', { headers }).then(r => r.json()),
        fetch('/api/grades', { headers }).then(r => r.json())
      ]);
      setExams(e);
      setGrades(g);
    };
    fetchData();
  }, [token]);

  const fetchAnalyticsData = React.useCallback(async () => {
    try {
      if (!selectedExam || !selectedGrade) return;
      const res = await fetch(`/api/reports/class-results?exam_id=${selectedExam}&grade_id=${selectedGrade}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch analytics data');
      const data = await res.json();
    const { students, subjects, marks } = data;
    
    const filteredSubjects = subjects.filter((sub: Subject) => {
      const name = sub.subject_name.toLowerCase().trim();
      return !['science & technology', 'science and technology', 'music', 'art & craft', 'art and craft', 'physical education'].includes(name);
    });

    // Sort exams to find previous
    const sortedExams = [...exams].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.term !== b.term) return a.term - b.term;
      return a.id - b.id;
    });
    const currentIndex = sortedExams.findIndex(e => e.id.toString() === selectedExam);
    const previousExam = currentIndex > 0 ? sortedExams[currentIndex - 1] : null;

    let previousMarks: Mark[] = [];
    if (previousExam) {
      const prevRes = await fetch(`/api/reports/class-results?exam_id=${previousExam.id}&grade_id=${selectedGrade}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const prevData = await prevRes.json();
      previousMarks = prevData.marks;
    }

    // Calculate distribution
    const distributionMap: Record<string, number> = { EE1: 0, EE2: 0, ME1: 0, ME2: 0, AE1: 0, AE2: 0, BE1: 0, BE2: 0 };
    const studentPerformance: { id: number; name: string; avgPoints: number; totalScore: number; subjectMarks: { [key: number]: number | string } }[] = [];

    students.forEach((s: Student) => {
      const sMarks = marks.filter((m: Mark) => m.student_id === s.id && filteredSubjects.some(sub => sub.id === m.subject_id));
      if (sMarks.length === 0) return;

      const totalScore = sMarks.reduce((acc: number, m: Mark) => acc + m.score, 0);
      const avgPoints = totalScore / 9;
      const grade = getOverallGrade(avgPoints);
      distributionMap[grade as keyof typeof distributionMap]++;
      
      const subjectMarks: { [key: number]: number | string } = {};
      filteredSubjects.forEach((sub: Subject) => {
        const mark = sMarks.find((m: Mark) => m.subject_id === sub.id);
        subjectMarks[sub.id] = mark ? mark.score : '-';
      });

      studentPerformance.push({
        id: s.id,
        name: s.name,
        avgPoints: parseFloat(avgPoints.toFixed(1)),
        totalScore,
        subjectMarks
      });
    });

    const ranked = [...studentPerformance].sort((a, b) => b.avgPoints - a.avgPoints);

    // Calculate improvement
    let mostImproved: { name: string; improvement: number } | undefined;
    if (previousExam) {
      let maxImp = -Infinity;
      studentPerformance.forEach(s => {
        const prevSMarks = previousMarks.filter(m => m.student_id === s.id && filteredSubjects.some(sub => sub.id === m.subject_id));
        if (prevSMarks.length > 0) {
          const prevTotal = prevSMarks.reduce((acc, m) => acc + m.score, 0);
          const prevAvg = prevTotal / 9;
          const imp = s.avgPoints - prevAvg;
          if (imp > maxImp) {
            maxImp = imp;
            mostImproved = { name: s.name, improvement: parseFloat(imp.toFixed(1)) };
          }
        }
      });
    }

    // Subject averages
    const subjectAverages = filteredSubjects.map((sub: Subject) => {
      const subMarks = marks.filter((m: Mark) => m.subject_id === sub.id);
      const avg = subMarks.length > 0 
        ? subMarks.reduce((acc: number, m: Mark) => acc + m.score, 0) / subMarks.length 
        : 0;
      return { name: sub.subject_name, average: parseFloat(avg.toFixed(1)) };
    });

    setData({
      distribution: Object.entries(distributionMap).map(([name, value]) => ({ name, value })),
      subjectAverages,
      rankedStudents: ranked,
      subjects: filteredSubjects,
      stats: {
        totalStudents: students.length,
        mostCommon: Object.entries(distributionMap).sort((a, b) => b[1] - a[1])[0][0],
        classAverage: studentPerformance.length > 0 
          ? (studentPerformance.reduce((acc, s) => acc + s.avgPoints, 0) / studentPerformance.length).toFixed(2)
          : '0.00',
        top5: ranked.slice(0, 5).map(s => ({ name: s.name, avgPoints: s.avgPoints })),
        bottom5: ranked.slice(-5).reverse().map(s => ({ name: s.name, avgPoints: s.avgPoints })),
        mostImproved
      }
    });
    } catch (error) {
      console.error('Analytics fetch error:', error);
    }
  }, [selectedExam, selectedGrade, token, exams]);

  useEffect(() => {
    Promise.resolve().then(() => fetchAnalyticsData());
  }, [fetchAnalyticsData]);

  const downloadExcel = () => {
    if (!data) return;

    const examName = exams.find(e => e.id.toString() === selectedExam)?.exam_name || 'Exam';
    const gradeName = grades.find(g => g.id.toString() === selectedGrade)?.grade_name || 'Grade';

    const headers = ['Rank', 'Student Name', ...data.subjects.map(sub => sub.subject_name), 'Average Points', 'Total Score', 'Performance Level'];
    
    const rows = data.rankedStudents.map((s, index) => {
      const row = [
        index + 1,
        s.name,
        ...data.subjects.map(sub => s.subjectMarks[sub.id]),
        s.avgPoints,
        s.totalScore,
        getOverallGrade(s.avgPoints)
      ];
      return row;
    });

    const letterhead = [
      [(user?.school_name || 'EDU NEXA ANALYTICS').toUpperCase()],
      ['P.O. Box 42-20213 Kiptere'],
      ['Motto: Strive to Excel'],
      [''],
      [`STUDENT RANKINGS: ${gradeName} - ${examName}`],
      [''],
      headers
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([...letterhead, ...rows]);
    
    // Merge letterhead cells
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: headers.length - 1 } },
    ];

    // Set column widths
    const colWidths = [
      { wch: 8 },  // Rank
      { wch: 30 }, // Student Name
      ...data.subjects.map(() => ({ wch: 12 })), // Subjects
      { wch: 15 }, // Average Points
      { wch: 15 }, // Total Score
      { wch: 20 }  // Performance Level
    ];
    worksheet['!cols'] = colWidths;

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
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text((user?.school_name || "SCHOOL ANALYSIS").toUpperCase(), 148, 20, { align: "center" });
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("P.O. Box 42-20213 Kiptere", 148, 26, { align: "center" });
      doc.setFont("helvetica", "italic");
      doc.text("Motto: Strive to Excel", 148, 31, { align: "center" });
      doc.line(20, 35, 277, 35);
    };

    // Page 1: Summary Analysis
    drawHeader();
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`EXAM PERFORMANCE SUMMARY: ${gradeName} - ${examName}`, 148, 45, { align: "center" });

    // Top 5 and Bottom 5 side by side
    doc.setFontSize(12);
    doc.text("Top 5 Students", 20, 55);
    autoTable(doc, {
      startY: 60,
      margin: { right: 150 },
      head: [['Rank', 'Name', 'Avg Points']],
      body: data.stats.top5.map((s, i) => [i + 1, s.name, s.avgPoints]),
      theme: 'striped',
      headStyles: { fillColor: [22, 163, 74] }
    });

    const top5Y = (doc as jsPDFWithAutoTable).lastAutoTable.finalY;

    doc.text("Bottom 5 Students", 160, 55);
    autoTable(doc, {
      startY: 60,
      margin: { left: 150 },
      head: [['Rank', 'Name', 'Avg Points']],
      body: data.stats.bottom5.map((s, i) => [data.stats.totalStudents - 4 + i, s.name, s.avgPoints]),
      theme: 'striped',
      headStyles: { fillColor: [220, 38, 38] }
    });

    const bottom5Y = (doc as jsPDFWithAutoTable).lastAutoTable.finalY;
    const summaryY = Math.max(top5Y, bottom5Y) + 15;

    // Subject Analysis
    doc.text("Subject Performance Analysis", 20, summaryY);
    autoTable(doc, {
      startY: summaryY + 5,
      head: [['Subject', 'Average Points', 'Grade']],
      body: data.subjectAverages.map(sub => [
        sub.name, 
        sub.average, 
        getOverallGrade(sub.average)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138] }
    });

    const subjectY = (doc as jsPDFWithAutoTable).lastAutoTable.finalY + 15;

    // Most Improved
    if (data.stats.mostImproved) {
      doc.setFont("helvetica", "bold");
      doc.text("Most Improved Student:", 20, subjectY);
      doc.setFont("helvetica", "normal");
      doc.text(`${data.stats.mostImproved.name} (+${data.stats.mostImproved.improvement} points)`, 70, subjectY);
    }

    // Page 2: Full Rankings
    doc.addPage();
    drawHeader();
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`FULL STUDENT RANKINGS: ${gradeName} - ${examName}`, 148, 45, { align: "center" });

    const headers = ['Rank', 'Name', ...data.subjects.map(sub => sub.subject_name), 'Avg Points', 'Total', 'Grade'];
    const body = data.rankedStudents.map((s, i) => [
      i + 1,
      s.name,
      ...data.subjects.map(sub => s.subjectMarks[sub.id]),
      s.avgPoints,
      s.totalScore,
      getOverallGrade(s.avgPoints)
    ]);

    autoTable(doc, {
      startY: 55,
      head: [headers],
      body: body,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 138], textColor: 255 },
    });

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
            <button 
              onClick={downloadExcel}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <FileSpreadsheet size={18} />
              Excel
            </button>
            <button 
              onClick={downloadPDF}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <FileText size={18} />
              PDF Report
            </button>
          </div>
        )}
      </header>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-wrap gap-6">
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

      {data ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <p className="text-sm font-medium text-slate-500">Class Average Points</p>
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
                  <>
                    {data.stats.mostImproved.name}
                    <span className="text-sm font-normal text-slate-500 ml-2">
                      (+{data.stats.mostImproved.improvement})
                    </span>
                  </>
                ) : (
                  'N/A'
                )}
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
                      <span className="w-6 h-6 flex items-center justify-center bg-green-100 text-green-700 rounded-full text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-slate-700">{s.name}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{s.avgPoints} pts</span>
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
                      <span className="w-6 h-6 flex items-center justify-center bg-red-100 text-red-700 rounded-full text-xs font-bold">
                        {data.stats.totalStudents - 4 + i}
                      </span>
                      <span className="text-sm font-medium text-slate-700">{s.name}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{s.avgPoints} pts</span>
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
                      {data.distribution.map((_entry: { name: string; value: number }, index: number) => (
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
              <h3 className="text-lg font-bold text-slate-900 mb-6">Subject Performance (Average %)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.subjectAverages} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="average" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
              <Award className="text-blue-600" size={20} />
              <h3 className="font-bold text-slate-900">Student Rankings</h3>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                    <th className="px-6 py-3">Rank</th>
                    <th className="px-6 py-3">Name</th>
                    {data.subjects.map(sub => (
                      <th key={sub.id} className="px-6 py-3">{sub.subject_name}</th>
                    ))}
                    <th className="px-6 py-3">Avg Points</th>
                    <th className="px-6 py-3">Total Score</th>
                    <th className="px-6 py-3">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {data.rankedStudents.map((s, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-blue-600">#{i + 1}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{s.name}</td>
                      {data.subjects.map(sub => (
                        <td key={sub.id} className="px-6 py-4">{s.subjectMarks[sub.id]}</td>
                      ))}
                      <td className="px-6 py-4">{s.avgPoints}</td>
                      <td className="px-6 py-4">{s.totalScore}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                          {getOverallGrade(s.avgPoints)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <BarChart3 size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-slate-900 font-bold">Select parameters to view analytics</h3>
          <p className="text-slate-500 text-sm mt-1">Choose an exam and grade to generate the performance overview.</p>
        </div>
      )}
    </div>
  );
};

export default Analytics;
