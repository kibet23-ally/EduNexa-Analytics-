import React, { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { useData } from "../hooks/useData";

// Types
interface School { id: string; name: string; logo_url?: string; motto?: string; }
interface Grade { id: string; grade_name: string; school_id: string; }
interface Subject { id: string; subject_name: string; subject_code: string; school_id: string; }
interface Student { id: string; name: string; admission_number: string; grade_id: string; }
interface Result { student_id: string; subject_id: string; marks: number; term: string; year: number; }

const TABS = ["Overview", "Analysis", "Rankings", "Report Cards"] as const;
type Tab = typeof TABS[number];

export default function AssessmentHub() {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [selectedTerm, setSelectedTerm] = useState<string>("Term 1");
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [loadingExport, setLoadingExport] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Data Fetching - More defensive
  const { data: schools = [], loading: schoolLoading, error: schoolError } = useData<School>(
    "schools", "schools", {}, true
  );
  
  const school = schools[0];

  const { data: grades = [], loading: gradesLoading } = useData<Grade>(
    `grades-${school?.id}`, "grades",
    { filters: school ? [{ column: "school_id", value: school.id }] : [] },
    !!school?.id
  );

  const { data: subjects = [] } = useData<Subject>(
    `subjects-${school?.id}`, "subjects",
    { filters: school ? [{ column: "school_id", value: school.id }] : [] },
    !!school?.id
  );

  const { data: students = [] } = useData<Student>(
    `students-\( {school?.id}- \){selectedGrade}`, "students",
    { filters: selectedGrade ? [{ column: "grade_id", value: selectedGrade }] : [] },
    !!school?.id
  );

  const { data: results = [] } = useData<Result>(
    `results-\( {school?.id}- \){selectedYear}`, "results",
    {
      filters: [
        ...(school ? [{ column: "school_id", value: school.id }] : []),
        { column: "year", value: Number(selectedYear) },
        ...(selectedTerm ? [{ column: "term", value: selectedTerm }] : []),
      ],
    },
    !!school?.id
  );

  // Computed Data
  const filteredStudents = useMemo(() => {
    return selectedGrade 
      ? students.filter(s => s.grade_id === selectedGrade) 
      : students;
  }, [students, selectedGrade]);

  const filteredResults = useMemo(() => {
    return results.filter(r => filteredStudents.some(s => s.id === r.student_id));
  }, [results, filteredStudents]);

  const kpiData = useMemo(() => {
    if (!filteredResults.length) return { avg: 0, passRate: 0, top: 0 };
    const total = filteredResults.reduce((sum, r) => sum + r.marks, 0);
    const avg = Math.round((total / filteredResults.length) * 10) / 10;
    const passRate = Math.round((filteredResults.filter(r => r.marks >= 50).length / filteredResults.length) * 100);
    const top = Math.round((filteredResults.filter(r => r.marks >= 80).length / filteredResults.length) * 100);
    return { avg, passRate, top };
  }, [filteredResults]);

  const subjectPerformance = useMemo(() => {
    return subjects.map(sub => {
      const subjRes = filteredResults.filter(r => r.subject_id === sub.id);
      const avg = subjRes.length ? Math.round(subjRes.reduce((a, b) => a + b.marks, 0) / subjRes.length) : 0;
      return { name: sub.subject_name, avg, count: subjRes.length };
    }).filter(s => s.count > 0).sort((a, b) => b.avg - a.avg);
  }, [subjects, filteredResults]);

  const studentRankings = useMemo(() => {
    const map: any = {};
    filteredResults.forEach(r => {
      if (!map[r.student_id]) {
        const stu = filteredStudents.find(s => s.id === r.student_id);
        map[r.student_id] = { ...stu, total: 0, count: 0 };
      }
      map[r.student_id].total += r.marks;
      map[r.student_id].count++;
    });

    return Object.values(map)
      .map((s: any) => ({ ...s, avg: Math.round(s.total / s.count) }))
      .sort((a: any, b: any) => b.avg - a.avg)
      .map((s: any, i: number) => ({ ...s, rank: i + 1 }));
  }, [filteredResults, filteredStudents]);

  // PDF Generation
  const generateReportCard = useCallback(async (student: Student) => {
    setLoadingExport(true);
    try {
      const doc = new jsPDF();
      const width = doc.internal.pageSize.getWidth();

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, width, 50, "F");
      doc.setTextColor(245, 158, 11);
      doc.setFontSize(18);
      doc.text(school?.name?.toUpperCase() || "MARUMBASI COMPREHENSIVE SCHOOL", width / 2, 25, { align: "center" });

      doc.setTextColor(0);
      doc.setFontSize(12);
      doc.text(`Student Report - ${selectedYear} ${selectedTerm}`, width / 2, 40, { align: "center" });

      autoTable(doc, {
        startY: 70,
        head: [["Subject", "Marks", "Grade"]],
        body: subjects.map(sub => {
          const res = filteredResults.find(r => r.student_id === student.id && r.subject_id === sub.id);
          const marks = res?.marks || 0;
          return [sub.subject_name, marks, marks >= 50 ? "Pass" : "Fail"];
        }),
      });

      doc.save(`Report_${student.name.replace(/ /g, "_")}.pdf`);
    } catch (e) {
      setErrorMsg("Failed to generate PDF");
    } finally {
      setLoadingExport(false);
    }
  }, [school, subjects, filteredResults, selectedYear, selectedTerm]);

  // Show loading or error
  if (schoolLoading || !school) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 mx-auto border-4 border-blue-600 border-t-transparent rounded-full mb-4"></div>
          <p className="text-slate-600">Loading school data...</p>
          {schoolError && <p className="text-red-500 text-sm mt-2">{schoolError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Assessment Hub</h1>
            <p className="text-slate-600">Track, analyze and report student performance</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-3xl shadow border border-slate-100 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">ACADEMIC YEAR</label>
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500">
                {[2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">TERM</label>
              <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500">
                {["Term 1", "Term 2", "Term 3"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">GRADE / CLASS</label>
              <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500">
                <option value="">All Grades</option>
                {grades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {/* Export logic */}}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3.5 rounded-2xl transition"
              >
                Export Report
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-8">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === tab 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "Overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-3xl p-8 shadow border border-slate-100">
              <div className="text-sm text-slate-500">Average Score</div>
              <div className="text-6xl font-semibold text-slate-900 mt-3">{kpiData.avg}</div>
            </div>
            <div className="bg-white rounded-3xl p-8 shadow border border-slate-100">
              <div className="text-sm text-slate-500">Pass Rate</div>
              <div className="text-6xl font-semibold text-emerald-600 mt-3">{kpiData.passRate}%</div>
            </div>
            <div className="bg-white rounded-3xl p-8 shadow border border-slate-100">
              <div className="text-sm text-slate-500">Top Performers</div>
              <div className="text-6xl font-semibold text-amber-600 mt-3">{kpiData.top}%</div>
            </div>
          </div>
        )}

        {/* You can expand other tabs similarly */}
      </div>
    </div>
  );
}