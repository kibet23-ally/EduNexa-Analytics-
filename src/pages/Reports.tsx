import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { Exam, Grade, Subject, Mark, Student, School } from '../types';
import { getCBCGrade, getOverallGrade, getRemarks } from '../lib/utils';
import { fetchWithProxy } from '../lib/fetchProxy';
import { useData } from '../hooks/useData';
import { FileText, Download, Printer, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Letterhead from '../components/Letterhead';

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
  const { user } = useAuth();
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [reportData, setReportData] = useState<ReportData | null>(null);

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

  const schoolInfo = useMemo(() => {
    return (schoolsQuery.data as School[])?.find(s => s.id === user?.school_id) || null;
  }, [schoolsQuery.data, user?.school_id]);

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
        marks: marksRes.data || [],
        subjects: subjectsRes.data || []
      };
      
      const filteredSubjects = (data.subjects || []).filter((sub: Subject) => {
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
  }, [selectedExam, selectedGrade, exams, grades]);

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

    const schoolTitle = schoolInfo?.name?.toUpperCase() || (user?.school_name || 'EDU NEXA ANALYTICS').toUpperCase();
    const schoolAddress = schoolInfo?.address || 'P.O. Box 42-20213 Kiptere';
    const schoolMotto = schoolInfo?.motto ? `Motto: ${schoolInfo.motto}` : 'Motto: Strive to Excel';

    const letterhead = [
      [schoolTitle],
      [schoolAddress],
      [schoolMotto],
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

    const schoolTitle = schoolInfo?.name?.toUpperCase() || (user?.school_name || "SCHOOL PROGRESS REPORT").toUpperCase();
    const schoolAddress = schoolInfo?.address || "P.O. Box 42-20213 Kiptere";
    const schoolMotto = schoolInfo?.motto ? `Motto: ${schoolInfo.motto}` : "Motto: Strive to Excel";

    reportData.students.forEach((student: ProcessedStudent, index: number) => {
      if (index > 0) doc.addPage();
      
      // Letterhead
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(schoolTitle, 105, 20, { align: "center" });
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(schoolAddress, 105, 26, { align: "center" });
      doc.setFont("helvetica", "italic");
      doc.text(schoolMotto, 105, 31, { align: "center" });
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

    // Reduced margins: top 20, bottom 20, left 15, right 15
    const marginLeft = 15;
    const marginTop = 20;

    const schoolTitle = schoolInfo?.name?.toUpperCase() || (user?.school_name || "SCHOOL REPORT").toUpperCase();
    const schoolAddress = schoolInfo?.address || "P.O. Box 42-20213 Kiptere";
    const schoolMotto = schoolInfo?.motto ? `Motto: ${schoolInfo.motto}` : "Motto: Strive to Excel";

    // Letterhead (Landscape Centered) - Reduced font sizes
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(schoolTitle, 148, marginTop, { align: "center" });
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(schoolAddress, 148, marginTop + 6, { align: "center" });
    doc.setFont("helvetica", "italic");
    doc.text(schoolMotto, 148, marginTop + 11, { align: "center" });
    doc.line(marginLeft, marginTop + 15, 282, marginTop + 15);

    // Report Title - Reduced spacing
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("STUDENT RANKINGS REPORT", 148, marginTop + 23, { align: "center" });
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const subHeaderY = marginTop + 30;
    doc.text(`Grade: ${grade.grade_name}`, marginLeft, subHeaderY);
    doc.text(`Exam: ${exam.exam_name}`, marginLeft, subHeaderY + 5);
    doc.text(`Term: ${exam.term} | Year: ${exam.year}`, 148, subHeaderY, { align: "center" });
    doc.text(`Total Students: ${reportData.students.length}`, 282, subHeaderY, { align: "right" });

    // Filter out students with no marks
    const validStudents = reportData.students.filter(s => s.marks && s.marks.length > 0);

    // Table Headers
    const headers = ['Rank', 'Name', 'Adm No', ...reportData.subjects.map((s: Subject) => s.subject_code), 'Total', 'Avg Pts', 'Grade'];
    
    // Table Body
    const body = validStudents.map((s: ProcessedStudent) => {
      const row: (string | number)[] = [s.rank || '-', s.name, s.admission_number];
      reportData.subjects.forEach((sub: Subject) => {
        const mark = s.marks.find((m: Mark) => m.subject_id === sub.id);
        row.push(mark ? mark.score : '-');
      });
      row.push(s.totalScore, s.avgPoints.toFixed(1), s.grade);
      return row;
    });

    autoTable(doc, {
      startY: subHeaderY + 12,
      head: [headers],
      body: body,
      theme: 'grid',
      showHead: 'everyPage', // repeatRows = 1
      styles: { 
        fontSize: 8, 
        cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 }, // Approximately 4pt/3pt
        overflow: 'linebreak',
        halign: 'center',
        lineWidth: 0.1, // thin grid lines
        textColor: 40
      },
      headStyles: { 
        fillColor: [30, 58, 138], 
        textColor: 255, 
        fontStyle: 'bold', 
        fontSize: 9,
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 10 }, // Rank
        1: { cellWidth: 50, halign: 'left' }, // Name
        2: { cellWidth: 20 }, // Adm No
      },
      margin: { left: marginLeft, right: marginLeft, top: marginTop, bottom: marginTop },
      tableWidth: 'auto'
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    
    // Bottom signatures - only if space permits on same page
    if (finalY < 180) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Class Teacher Signature: ________________________", marginLeft, finalY);
      doc.text("Principal Signature: ________________________", 200, finalY);
    }

    doc.save(`Rankings_Report_${grade.grade_name}_${exam.exam_name}.pdf`);
  };

  const printClassResults = () => {
    if (!reportData) return;
    const doc = new jsPDF('l', 'mm', 'a4') as jsPDFWithAutoTable;
    const exam = reportData.exam;
    const grade = reportData.grade;

    const marginLeft = 15;
    const marginTop = 20;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`${(user?.school_name || "SCHOOL").toUpperCase()} - CLASS RESULTS`, 148, marginTop, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${grade?.grade_name} | ${exam?.exam_name} | Term ${exam?.term} ${exam?.year}`, 148, marginTop + 7, { align: "center" });

    // Filter valid data
    const validStudents = reportData.students.filter(s => s.marks && s.marks.length > 0);

    const headers = ['Rank', 'Name', 'Adm No', ...reportData.subjects.map((s: Subject) => s.subject_code), 'Total', 'Avg Pts', 'Grade', 'Pts'];
    const body = validStudents.map((s: ProcessedStudent) => {
      const row: (string | number)[] = [s.rank || '-', s.name, s.admission_number];
      reportData.subjects.forEach((sub: Subject) => {
        const mark = s.marks.find((m: Mark) => m.subject_id === sub.id);
        row.push(mark ? mark.score : '-');
      });
      row.push(s.totalScore, s.avgPoints.toFixed(1), s.grade, s.totalPoints);
      return row;
    });

    autoTable(doc, {
      startY: marginTop + 15,
      head: [headers],
      body: body,
      theme: 'grid',
      showHead: 'everyPage',
      styles: { 
        fontSize: 8, 
        cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
        halign: 'center',
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [30, 58, 138],
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 50, halign: 'left' },
        2: { cellWidth: 20 }
      },
      margin: { left: marginLeft, right: marginLeft, top: marginTop, bottom: marginTop }
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
                <p className="font-bold text-xs opacity-100">{(schoolInfo?.name || user?.school_name || "EDUNEXA SCHOOL").toUpperCase()}</p>
                <p>{schoolInfo?.address || 'P.O. Box 42-20213 Kiptere'}</p>
                <p className="italic">Motto: {schoolInfo?.motto || 'Strive to Excel'}</p>
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
