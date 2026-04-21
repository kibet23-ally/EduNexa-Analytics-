import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { Exam, Grade, Subject, Mark, Student } from '../types';
import { getCBCGrade, getOverallGrade, getRemarks } from '../lib/utils';
import { FileText, Download, Printer, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

const Reports = () => {
  const { token, user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [reportData, setReportData] = useState<ReportData | null>(null);

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

  const loadReportData = React.useCallback(async () => {
    try {
      if (!selectedExam || !selectedGrade) return;
      const res = await fetch(`/api/reports/class-results?exam_id=${selectedExam}&grade_id=${selectedGrade}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load report data');
      const data = await res.json();
    
    const filteredSubjects = data.subjects.filter((sub: Subject) => {
      const name = sub.subject_name.toLowerCase().trim();
      return !['science & technology', 'science and technology', 'music', 'art & craft', 'art and craft', 'physical education'].includes(name);
    });

    // Process data for ranking
    const processedStudents: ProcessedStudent[] = data.students.map((s: Student) => {
      const sMarks = data.marks.filter((m: Mark) => m.student_id === s.id && filteredSubjects.some(sub => sub.id === m.subject_id));
      const totalScore = sMarks.reduce((acc: number, m: Mark) => acc + m.score, 0);
      const totalPoints = sMarks.reduce((acc: number, m: Mark) => acc + getCBCGrade(m.score).points, 0);
      const meanScore = totalScore / 9;
      const avgPoints = meanScore;
      
      return {
        ...s,
        marks: sMarks,
        totalScore,
        totalPoints,
        avgPoints,
        meanScore,
        grade: getOverallGrade(avgPoints)
      };
    }).sort((a: ProcessedStudent, b: ProcessedStudent) => b.totalScore - a.totalScore);

    // Add ranks
    processedStudents.forEach((s: ProcessedStudent, i: number) => {
      s.rank = i + 1;
    });

    setReportData({
      ...data,
      subjects: filteredSubjects,
      students: processedStudents,
      exam: exams.find(e => e.id.toString() === selectedExam)!,
      grade: grades.find(g => g.id.toString() === selectedGrade)!
    });
    } catch (error) {
      console.error('Reports fetch error:', error);
    }
  }, [selectedExam, selectedGrade, token, exams, grades]);

  useEffect(() => { 
    Promise.resolve().then(() => loadReportData()); 
  }, [loadReportData]);

  const exportToExcel = () => {
    if (!reportData) return;
    
    const headers = ['Rank', 'Name', 'Admission No', 'Class', ...reportData.subjects.map((s: Subject) => s.subject_name), 'Total Score', 'Avg Points', 'Grade'];
    const rows = reportData.students.map((s: ProcessedStudent) => {
      const row: (string | number)[] = [s.rank || '-', s.name, s.admission_number, s.grade_name || reportData.grade.grade_name];
      reportData.subjects.forEach((sub: Subject) => {
        const mark = s.marks.find((m: Mark) => m.subject_id === sub.id);
        row.push(mark ? mark.score : '-');
      });
      row.push(s.totalScore, s.avgPoints.toFixed(1), s.grade);
      return row;
    });

    const letterhead = [
      [(user?.school_name || 'EDU NEXA ANALYTICS').toUpperCase()],
      ['P.O. Box 42-20213 Kiptere'],
      ['Motto: Strive to Excel'],
      [''],
      [`CLASS RESULTS: ${reportData.grade.grade_name} - ${reportData.exam.exam_name}`],
      [''],
      headers
    ];

    const ws = XLSX.utils.aoa_to_sheet([...letterhead, ...rows]);
    
    // Merge letterhead cells
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: headers.length - 1 } },
    ];
    
    // Set column widths
    const colWidths = [
      { wch: 8 },  // Rank
      { wch: 30 }, // Name
      { wch: 15 }, // Adm No
      { wch: 15 }, // Class
      ...reportData.subjects.map(() => ({ wch: 12 })), // Subjects
      { wch: 12 }, // Total Score
      { wch: 12 }, // Avg Points
      { wch: 10 }  // Grade
    ];
    ws['!cols'] = colWidths;

    // Set page setup to landscape
    ws['!pageSetup'] = { orientation: 'landscape' };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Class Results");
    XLSX.writeFile(wb, `Rankings_Report_${reportData.grade.grade_name}_${reportData.exam.exam_name}.xlsx`);
  };

  const generateReportCards = () => {
    if (!reportData) return;
    const doc = new jsPDF();
    const exam = exams.find(e => e.id === parseInt(selectedExam));
    const grade = grades.find(g => g.id === parseInt(selectedGrade));

    reportData.students.forEach((student: ProcessedStudent, index: number) => {
      if (index > 0) doc.addPage();
      
      // Letterhead
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text((user?.school_name || "SCHOOL PROGRESS REPORT").toUpperCase(), 105, 20, { align: "center" });
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("P.O. Box 42-20213 Kiptere", 105, 26, { align: "center" });
      doc.setFont("helvetica", "italic");
      doc.text("Motto: Strive to Excel", 105, 31, { align: "center" });
      doc.line(20, 35, 190, 35);

      // Student Details
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("STUDENT PROGRESS REPORT", 105, 45, { align: "center" });
      
      doc.setFontSize(10);
      doc.text(`Name: ${student.name}`, 20, 55);
      doc.text(`Adm No: ${student.admission_number}`, 20, 60);
      doc.text(`Grade: ${grade?.grade_name}`, 20, 65);
      
      doc.text(`Exam: ${exam?.exam_name}`, 140, 55);
      doc.text(`Term: ${exam?.term}`, 140, 60);
      doc.text(`Year: ${exam?.year}`, 140, 65);
      doc.text(`Position: ${student.rank} of ${reportData.students.length}`, 140, 70);

      // Table
      const tableData = reportData.subjects.map((sub: Subject) => {
        const mark = student.marks.find((m: Mark) => m.subject_id === sub.id);
        const g = mark ? getCBCGrade(mark.score) : { level: '-', points: '-' };
        return [sub.subject_name, mark ? mark.score : '-', g.level, g.points];
      });

      autoTable(doc, {
        startY: 75,
        head: [['Subject', 'Score', 'Performance Level', 'Points']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 2 }
      });

      const finalY = (doc as jsPDFWithAutoTable).lastAutoTable.finalY + 10;
      
      // Summary
      doc.setFont("helvetica", "bold");
      doc.text(`Total Points: ${student.totalPoints}`, 20, finalY);
      doc.text(`Average Points: ${student.avgPoints.toFixed(1)}`, 20, finalY + 5);
      doc.text(`Overall Grade: ${student.grade}`, 20, finalY + 10);

      // Remarks
      const remarks = getRemarks(student.avgPoints);
      doc.setFont("helvetica", "normal");
      doc.text("Teacher's Remarks:", 20, finalY + 25);
      doc.setFont("helvetica", "italic");
      doc.text(remarks.teacher, 25, finalY + 30, { maxWidth: 160 });
      
      doc.setFont("helvetica", "normal");
      doc.text("Principal's Remarks:", 20, finalY + 45);
      doc.setFont("helvetica", "italic");
      doc.text(remarks.principal, 25, finalY + 50, { maxWidth: 160 });

      doc.setFont("helvetica", "bold");
      doc.text("________________________", 20, finalY + 70);
      doc.text("Class Teacher Signature", 20, finalY + 75);
      
      doc.text("________________________", 140, finalY + 70);
      doc.text("Principal Signature", 140, finalY + 75);
    });

    doc.save(`Report_Cards_${selectedGrade}.pdf`);
  };

  const generateRankingsReport = () => {
    if (!reportData) return;
    const doc = new jsPDF('l', 'mm', 'a4') as jsPDFWithAutoTable;
    const exam = reportData.exam;
    const grade = reportData.grade;

    // Letterhead (Landscape Centered)
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text((user?.school_name || "SCHOOL REPORT").toUpperCase(), 148, 20, { align: "center" });
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("P.O. Box 42-20213 Kiptere", 148, 26, { align: "center" });
    doc.setFont("helvetica", "italic");
    doc.text("Motto: Strive to Excel", 148, 31, { align: "center" });
    doc.line(20, 35, 277, 35);

    // Report Title
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("STUDENT RANKINGS REPORT", 148, 45, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Grade: ${grade.grade_name}`, 20, 55);
    doc.text(`Exam: ${exam.exam_name}`, 20, 60);
    doc.text(`Term: ${exam.term}`, 140, 55);
    doc.text(`Year: ${exam.year}`, 140, 60);
    doc.text(`Total Students: ${reportData.students.length}`, 240, 55);

    // Table Headers
    const headers = ['Rank', 'Name', 'Adm No', 'Class', ...reportData.subjects.map((s: Subject) => s.subject_name), 'Total', 'Avg Points', 'Grade'];
    
    // Table Body
    const body = reportData.students.map((s: ProcessedStudent) => {
      const row: (string | number)[] = [s.rank || '-', s.name, s.admission_number, s.grade_name || grade.grade_name];
      reportData.subjects.forEach((sub: Subject) => {
        const mark = s.marks.find((m: Mark) => m.subject_id === sub.id);
        row.push(mark ? mark.score : '-');
      });
      row.push(s.totalScore, s.avgPoints.toFixed(1), s.grade);
      return row;
    });

    autoTable(doc, {
      startY: 65,
      head: [headers],
      body: body,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 10 }, // Rank
        1: { cellWidth: 35 }, // Name
        2: { cellWidth: 15 }, // Adm No
        3: { cellWidth: 15 }, // Class
      },
      margin: { left: 10, right: 10 }
    });

    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Class Teacher Signature: ________________________", 20, finalY);
    doc.text("Principal Signature: ________________________", 180, finalY);

    doc.save(`Rankings_Report_${grade.grade_name}_${exam.exam_name}.pdf`);
  };

  const printClassResults = () => {
    if (!reportData) return;
    const doc = new jsPDF('l', 'mm', 'a4');
    const exam = exams.find(e => e.id === parseInt(selectedExam));
    const grade = grades.find(g => g.id === parseInt(selectedGrade));

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`${(user?.school_name || "SCHOOL").toUpperCase()} - CLASS RESULTS`, 148, 15, { align: "center" });
    doc.setFontSize(10);
    doc.text(`${grade?.grade_name} | ${exam?.exam_name} | Term ${exam?.term} ${exam?.year}`, 148, 22, { align: "center" });

    const headers = ['Rank', 'Name', 'Adm No', ...reportData.subjects.map((s: Subject) => s.subject_code), 'Total', 'Avg Pts', 'Grade', 'Pts'];
    const body = reportData.students.map((s: ProcessedStudent) => {
      const row: (string | number)[] = [s.rank, s.name, s.admission_number];
      reportData.subjects.forEach((sub: Subject) => {
        const mark = s.marks.find((m: Mark) => m.subject_id === sub.id);
        row.push(mark ? mark.score : '-');
      });
      row.push(s.totalScore, s.avgPoints.toFixed(1), s.grade, s.totalPoints);
      return row;
    });

    autoTable(doc, {
      startY: 30,
      head: [headers],
      body: body,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1 },
      headStyles: { fillColor: [30, 58, 138] }
    });

    doc.save(`Class_Results_${selectedGrade}.pdf`);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Reports & Exports</h1>
        <p className="text-slate-500 text-sm">Generate report cards, class lists, and data exports.</p>
      </header>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase">Exam</label>
          <select value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">Select Exam</option>
            {exams.map(e => <option key={e.id} value={e.id}>{e.exam_name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase">Grade</label>
          <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">Select Grade</option>
            {grades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
          </select>
        </div>
      </div>

      {reportData ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Preview: Class Results</h3>
                <div className="flex gap-2">
                  <button onClick={exportToExcel} className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors">
                    <FileSpreadsheet size={14} />
                    Excel
                  </button>
                  <button onClick={generateRankingsReport} className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors">
                    <FileText size={14} />
                    Rankings Report
                  </button>
                  <button onClick={printClassResults} className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors">
                    <Printer size={14} />
                    Print
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
                      <th className="px-3 py-2">Avg Points</th>
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
                <FileText size={20} className="text-blue-600" />
                Report Cards
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                Generate individual student progress reports for the selected exam and grade.
              </p>
              <button 
                onClick={generateReportCards}
                className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-200"
              >
                <Download size={18} />
                Download All Report Cards
              </button>
            </div>

            <div className="bg-blue-900 p-6 rounded-xl shadow-sm text-white">
              <h4 className="font-bold mb-2">School Letterhead</h4>
              <div className="text-[10px] space-y-1 opacity-80 border-l-2 border-blue-400 pl-4">
                <p className="font-bold text-xs opacity-100">{(user?.school_name || "EDUNEXA SCHOOL").toUpperCase()}</p>
                <p>P.O. Box 42-20213 Kiptere</p>
                <p className="italic">Motto: Strive to Excel</p>
              </div>
              <p className="text-[10px] mt-4 opacity-60">
                This branding is automatically applied to all official PDF reports.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <FileText size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-slate-900 font-bold">Select parameters to generate reports</h3>
          <p className="text-slate-500 text-sm mt-1">Choose an exam and grade to load the results preview.</p>
        </div>
      )}
    </div>
  );
};

export default Reports;
