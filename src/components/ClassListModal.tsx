import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { useData } from '../hooks/useData';
import { fetchWithProxy } from '../lib/fetchProxy';
import { Grade, School } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import {
  X, Search, FileText, FileSpreadsheet, FileType, Loader2, Download, ChevronDown,
} from 'lucide-react';

interface ClassListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExportFormat = 'pdf' | 'xlsx' | 'csv';

interface OptionalColumns {
  stream: boolean;
  guardianName: boolean;
  guardianPhone: boolean;
  dateOfAdmission: boolean;
}

const isSuperAdmin = (role?: string) =>
  ['SuperAdmin', 'super_admin'].includes(role || '');

/* ─── Logo fetch helper (mirrors the pattern used in report/PDF generation
   elsewhere in the app) — converts a stored logo URL into base64 so jsPDF
   can embed it directly in the document. ─────────────────────────────── */
async function fetchLogoAsBase64(url: string): Promise<{ data: string; fmt: 'PNG' | 'JPEG' } | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const fmt: 'PNG' | 'JPEG' = blob.type.includes('png') ? 'PNG' : 'JPEG';
    const data: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    return { data, fmt };
  } catch {
    return null;
  }
}

const ClassListModal: React.FC<ClassListModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const superAdmin = isSuperAdmin(user?.role);

  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(superAdmin ? '' : String(user?.school_id || ''));
  const [selectedGradeId, setSelectedGradeId] = useState<string>('');
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [gradeSearch, setGradeSearch] = useState('');
  const [generating, setGenerating] = useState(false);
  const [columns, setColumns] = useState<OptionalColumns>({
    stream: true,
    guardianName: true,
    guardianPhone: true,
    dateOfAdmission: true,
  });

  const effectiveSchoolId = superAdmin ? (selectedSchoolId ? Number(selectedSchoolId) : null) : user?.school_id;

  // Remember the last selected class per user, scoped to this browser.
  const storageKey = user?.id ? `classlist-last-grade-${user.id}` : null;

  useEffect(() => {
    if (!isOpen || !storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setSelectedGradeId(saved);
    } catch { /* noop */ }
  }, [isOpen, storageKey]);

  useEffect(() => {
    if (selectedGradeId && storageKey) {
      try { localStorage.setItem(storageKey, selectedGradeId); } catch { /* noop */ }
    }
  }, [selectedGradeId, storageKey]);

  const schoolsQuery = useData<School>(
    'schools-list-classlist',
    'schools',
    { select: 'id, name', orderBy: { column: 'name', ascending: true } },
    isOpen && superAdmin
  );
  const schools = useMemo(() => schoolsQuery.data || [], [schoolsQuery.data]);

  const gradesQuery = useData<Grade>(
    'grades-list-classlist',
    'grades',
    {
      select: 'id, grade_name',
      orderBy: { column: 'grade_name', ascending: true },
      ...(effectiveSchoolId ? { filters: { school_id: effectiveSchoolId } } : {}),
    },
    isOpen && !!effectiveSchoolId
  );
  const grades = useMemo(() => {
    const list = gradesQuery.data || [];
    return [...list].sort((a, b) => {
      const numA = parseInt(a.grade_name.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.grade_name.match(/\d+/)?.[0] || '0');
      if (numA !== numB) return numA - numB;
      return a.grade_name.localeCompare(b.grade_name);
    });
  }, [gradesQuery.data]);

  const filteredGrades = useMemo(() => {
    if (!gradeSearch) return grades;
    const q = gradeSearch.toLowerCase();
    return grades.filter(g => g.grade_name.toLowerCase().includes(q));
  }, [grades, gradeSearch]);

  // Reset grade selection if it no longer belongs to the currently selected school.
  useEffect(() => {
    if (selectedGradeId && grades.length && !grades.some(g => String(g.id) === selectedGradeId)) {
      setSelectedGradeId('');
    }
  }, [grades, selectedGradeId]);

  if (!isOpen) return null;

  const selectedGrade = grades.find(g => String(g.id) === selectedGradeId);

  const handleGenerate = async () => {
    if (!effectiveSchoolId) { toast.error('Please select a school.'); return; }
    if (!selectedGradeId) { toast.error('Please select a grade/class.'); return; }

    setGenerating(true);
    try {
      const [schoolRes, studentsRes] = await Promise.all([
        fetchWithProxy('schools', {
          select: 'id, name, logo_url, address, phone',
          filters: { id: effectiveSchoolId },
          single: true,
        }),
        fetchWithProxy('students', {
          select: 'id, admission_number, name, gender, stream, date_of_admission, deleted_at',
          filters: { school_id: effectiveSchoolId, grade_id: Number(selectedGradeId) },
        }),
      ]);

      const school = Array.isArray(schoolRes.data) ? schoolRes.data[0] : schoolRes.data;
      let students = (Array.isArray(studentsRes.data) ? studentsRes.data : []).filter((s: any) => !s.deleted_at);

      if (!students.length) {
        toast.error(`No students found in ${selectedGrade?.grade_name || 'this class'}.`);
        setGenerating(false);
        return;
      }

      // Sort alphabetically by Admission Number, as required.
      students = [...students].sort((a: any, b: any) =>
        String(a.admission_number || '').localeCompare(String(b.admission_number || ''), undefined, { numeric: true })
      );

      // Guardian info (name/phone) — only fetched if those optional columns
      // are actually included, and only for students in this class.
      let guardiansByStudent: Record<number, { full_name: string; phone: string }> = {};
      if (columns.guardianName || columns.guardianPhone) {
        const { data: gData } = await fetchWithProxy('guardians', {
          select: 'student_id, full_name, phone, is_emergency_contact',
          filters: { school_id: effectiveSchoolId },
        });
        const guardians = Array.isArray(gData) ? gData : [];
        students.forEach((s: any) => {
          const forStudent = guardians.filter((g: any) => g.student_id === s.id);
          const primary = forStudent.find((g: any) => g.is_emergency_contact) || forStudent[0];
          if (primary) guardiansByStudent[s.id] = primary;
        });
      }

      const gradeName = selectedGrade?.grade_name || 'Class';
      const schoolName = school?.name || 'School';
      const downloadDate = new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });

      // Build the column set actually used for this export, in a fixed order.
      const activeColumns: { key: string; label: string }[] = [
        { key: 'admission_number', label: 'Admission No' },
        { key: 'name', label: 'Student Name' },
        { key: 'gender', label: 'Gender' },
        { key: 'grade', label: 'Grade/Class' },
      ];
      if (columns.stream) activeColumns.push({ key: 'stream', label: 'Stream' });
      if (columns.guardianName) activeColumns.push({ key: 'guardian_name', label: 'Parent/Guardian' });
      if (columns.guardianPhone) activeColumns.push({ key: 'guardian_phone', label: 'Parent Phone' });
      if (columns.dateOfAdmission) activeColumns.push({ key: 'date_of_admission', label: 'Date of Admission' });

      const rows = students.map((s: any) => {
        const g = guardiansByStudent[s.id];
        const row: Record<string, string> = {
          admission_number: s.admission_number || '',
          name: s.name || '',
          gender: s.gender || '',
          grade: gradeName,
          stream: s.stream || '—',
          guardian_name: g?.full_name || '—',
          guardian_phone: g?.phone || '—',
          date_of_admission: s.date_of_admission || '—',
        };
        return row;
      });

      if (format === 'pdf') {
        await generatePDF({ school, schoolName, gradeName, downloadDate, activeColumns, rows, studentCount: students.length });
      } else if (format === 'xlsx') {
        generateExcel({ schoolName, gradeName, downloadDate, activeColumns, rows, asCsv: false });
      } else {
        generateExcel({ schoolName, gradeName, downloadDate, activeColumns, rows, asCsv: true });
      }

      toast.success(`Class list for ${gradeName} downloaded successfully.`);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate the class list.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9997] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-900 flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Download Class List</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Export a printable roster for one class.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {superAdmin && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">School</label>
              <select
                value={selectedSchoolId}
                onChange={e => { setSelectedSchoolId(e.target.value); setSelectedGradeId(''); }}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white"
              >
                <option value="">Select a school</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Grade / Class</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search classes..."
                value={gradeSearch}
                onChange={e => setGradeSearch(e.target.value)}
                disabled={!effectiveSchoolId}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white disabled:opacity-50"
              />
            </div>
            {!effectiveSchoolId ? (
              <p className="text-xs text-slate-400 italic">Select a school first.</p>
            ) : gradesQuery.isLoading ? (
              <p className="text-xs text-slate-400">Loading classes…</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                {filteredGrades.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGradeId(String(g.id))}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors truncate ${
                      String(g.id) === selectedGradeId
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300'
                    }`}
                  >
                    {g.grade_name}
                  </button>
                ))}
                {filteredGrades.length === 0 && (
                  <p className="col-span-full text-xs text-slate-400 italic py-2">No matching classes.</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">File Format</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'pdf' as const, label: 'PDF', icon: FileText },
                { key: 'xlsx' as const, label: 'Excel', icon: FileSpreadsheet },
                { key: 'csv' as const, label: 'CSV', icon: FileType },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFormat(f.key)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-lg border text-xs font-bold transition-colors ${
                    format === f.key
                      ? 'bg-blue-50 border-blue-400 text-blue-700 dark:bg-blue-950/40'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <f.icon size={18} />
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer text-xs font-bold text-slate-500 uppercase select-none">
              Optional Columns
              <ChevronDown size={14} className="group-open:rotate-180 transition-transform" />
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { key: 'stream' as const, label: 'Stream' },
                { key: 'guardianName' as const, label: 'Parent/Guardian Name' },
                { key: 'guardianPhone' as const, label: 'Parent Phone Number' },
                { key: 'dateOfAdmission' as const, label: 'Date of Admission' },
              ].map(c => (
                <label key={c.key} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={columns[c.key]}
                    onChange={e => setColumns(prev => ({ ...prev, [c.key]: e.target.checked }))}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </details>
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-slate-900 p-5 border-t border-slate-100 dark:border-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedGradeId || !effectiveSchoolId}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {generating ? 'Generating…' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   PDF generation
═══════════════════════════════════════════════════════════════════════ */
async function generatePDF(params: {
  school: any; schoolName: string; gradeName: string; downloadDate: string;
  activeColumns: { key: string; label: string }[]; rows: Record<string, string>[]; studentCount: number;
}) {
  const { school, schoolName, gradeName, downloadDate, activeColumns, rows, studentCount } = params;
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = doc.internal.pageSize.width;
  const M = 14;

  const logo = school?.logo_url ? await fetchLogoAsBase64(school.logo_url) : null;

  const drawHeader = () => {
    doc.setFillColor(30, 58, 95); // brand navy
    doc.rect(0, 0, W, 30, 'F');
    doc.setFillColor(234, 179, 8); // gold accent stripe
    doc.rect(0, 30, W, 1.5, 'F');

    if (logo) {
      try { doc.addImage(logo.data, logo.fmt, M, 5, 20, 20); } catch { /* noop */ }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15); doc.setFont('helvetica', 'bold');
    doc.text(schoolName.toUpperCase(), W / 2, 13, { align: 'center' });
    if (school?.address || school?.phone) {
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 215, 235);
      doc.text([school?.address, school?.phone].filter(Boolean).join('  |  '), W / 2, 19, { align: 'center' });
    }
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(253, 224, 71);
    doc.text('CLASS LIST', W / 2, 26, { align: 'center' });
  };

  drawHeader();

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text(`Class: ${gradeName}`, M, 40);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
  doc.text(`Downloaded: ${downloadDate}  •  Total Students: ${studentCount}`, M, 46);

  autoTable(doc, {
    startY: 52,
    head: [activeColumns.map(c => c.label)],
    body: rows.map(r => activeColumns.map(c => r[c.key])),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 52, left: M, right: M },
    didDrawPage: () => {
      // Header repeats on every page (autoTable's `margin.top` reserves the space).
      if (doc.internal.getCurrentPageInfo().pageNumber > 1) drawHeader();
    },
  });

  // Page numbers, added last across every page now that the table is complete.
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const H = doc.internal.pageSize.height;
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${totalPages}`, W - M, H - 8, { align: 'right' });
    doc.text('Generated by EduNexa Analytics', M, H - 8);
  }

  doc.save(`Class_List_${gradeName.replace(/\s+/g, '_')}.pdf`);
}

/* ═══════════════════════════════════════════════════════════════════════
   Excel (.xlsx) and CSV generation — share the same sheet-building logic
═══════════════════════════════════════════════════════════════════════ */
function generateExcel(params: {
  schoolName: string; gradeName: string; downloadDate: string;
  activeColumns: { key: string; label: string }[]; rows: Record<string, string>[]; asCsv: boolean;
}) {
  const { schoolName, gradeName, downloadDate, activeColumns, rows, asCsv } = params;

  const letterhead = [
    [schoolName.toUpperCase()],
    ['CLASS LIST'],
    [`Class: ${gradeName}`],
    [`Downloaded: ${downloadDate}`],
    [''],
    activeColumns.map(c => c.label),
  ];
  const body = rows.map(r => activeColumns.map(c => r[c.key]));
  const worksheet = XLSX.utils.aoa_to_sheet([...letterhead, ...body]);

  if (asCsv) {
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Class_List_${gradeName.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: activeColumns.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: activeColumns.length - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: activeColumns.length - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: activeColumns.length - 1 } },
  ];
  worksheet['!cols'] = activeColumns.map(() => ({ wch: 20 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Class List');
  XLSX.writeFile(workbook, `Class_List_${gradeName.replace(/\s+/g, '_')}.xlsx`);
}

export default ClassListModal;