import React, { useState, useMemo, useCallback } from "react";
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
  const [loadingExport, setLoadingExport] = useState(false);

  // Data Fetching
  const { 
    data: schools = [], 
    loading: schoolLoading, 
    error: schoolError 
  } = useData<School>("schools", "schools", {}, true);

  const school = schools[0];

  const { data: grades = [] } = useData<Grade>(
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
      filters: school ? [
        { column: "school_id", value: school.id },
        { column: "year", value: Number(selectedYear) },
        ...(selectedTerm ? [{ column: "term", value: selectedTerm }] : []),
      ] : [],
    },
    !!school?.id
  );

  // Computed Data (Safe)
  const filteredStudents = useMemo(() => selectedGrade 
    ? students.filter((s: any) => s.grade_id === selectedGrade) 
    : students, [students, selectedGrade]);

  const filteredResults = useMemo(() => 
    results.filter((r: any) => filteredStudents.some((s: any) => s.id === r.student_id)),
    [results, filteredStudents]
  );

  const kpiData = useMemo(() => {
    if (!filteredResults.length) return { avg: 0, passRate: 0, top: 0 };
    const total = filteredResults.reduce((sum: number, r: any) => sum + r.marks, 0);
    const avg = Math.round((total / filteredResults.length) * 10) / 10;
    const passRate = Math.round((filteredResults.filter((r: any) => r.marks >= 50).length / filteredResults.length) * 100);
    const top = Math.round((filteredResults.filter((r: any) => r.marks >= 80).length / filteredResults.length) * 100);
    return { avg, passRate, top };
  }, [filteredResults]);

  // Loading & Error States
  if (schoolLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 mx-auto border-4 border-blue-600 border-t-transparent rounded-full mb-4"></div>
          <p className="text-slate-600">Loading school data...</p>
        </div>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="text-amber-500 text-6xl mb-6">🏫</div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-3">School Not Configured</h2>
          <p className="text-slate-600 mb-8">
            No school data was found for your account. This is required for Assessment Hub to work.
          </p>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-left text-sm">
            <p className="font-medium mb-2">Possible Solutions:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li>Make sure you are logged in as a school admin</li>
              <li>Ensure your user profile has a linked school</li>
              <li>Contact your system administrator to link your account to a school</li>
            </ul>
          </div>
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
            <p className="text-slate-600">Track, analyze and report student performance • {school.name}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-3xl shadow border border-slate-100 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">ACADEMIC YEAR</label>
              <select 
                value={selectedYear} 
                onChange={e => setSelectedYear(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500"
              >
                {[2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">TERM</label>
              <select 
                value={selectedTerm} 
                onChange={e => setSelectedTerm(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500"
              >
                {["Term 1", "Term 2", "Term 3"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">GRADE / CLASS</label>
              <select 
                value={selectedGrade} 
                onChange={e => setSelectedGrade(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500"
              >
                <option value="">All Grades</option>
                {grades.map((g: Grade) => (
                  <option key={g.id} value={g.id}>{g.grade_name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3.5 rounded-2xl transition">
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

        {/* Overview */}
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
      </div>
    </div>
  );
}