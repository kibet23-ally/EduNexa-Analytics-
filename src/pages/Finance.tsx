import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { useData } from '../hooks/useData';
import { fetchWithProxy, writeWithProxy } from '../lib/fetchProxy';
import { Grade, School } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  createPdfDoc, drawPdfHeader, finalizePdf, addBorderToAllPages,
  PDF_TABLE_THEME, PDF_COLORS, PDF_CONTENT_X, drawEmptyState, drawSummaryBlock,
} from '../lib/pdfKit';
import toast from 'react-hot-toast';
import {
  Wallet, TrendingUp, AlertTriangle, Search, X, Loader2, Printer,
  Receipt, History, Plus, FileText, Settings2, ChevronDown,
} from 'lucide-react';

/* ══════════════════════════════════════════════════════════════════════
   Types
══════════════════════════════════════════════════════════════════════ */
interface StudentRow {
  id: number;
  admission_number: string;
  name: string;
  grade_id: number;
  grade_name: string;
  stream?: string | null;
  expected: number;
  paid: number;
  balance: number;
}
interface PaymentRow {
  id: number;
  student_id: number;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  receipt_number: string;
  notes: string | null;
  payment_date: string;
  voided: boolean;
  term: number;
  year: number;
  recorded_by: string | null;
}
interface VoteHead {
  id?: number;
  account_code: string;
  purpose: string;
  amount: string; // kept as string while editing in the modal
}
interface SchoolInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

const TABS = ['Dashboard', 'Student Fees', 'Reports'] as const;
type Tab = typeof TABS[number];

const isSuperAdmin = (role?: string) => ['SuperAdmin', 'super_admin'].includes(role || '');
const money = (n: number) => `KSh ${n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const inputCls = "w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white";

/* ── Number → words, Kenyan-shillings receipt style ─────────────────────── */
const ONES = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
  'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

function threeDigitsToWords(n: number): string {
  let out = '';
  if (n >= 100) { out += `${ONES[Math.floor(n / 100)]} HUNDRED `; n %= 100; }
  if (n >= 20) { out += `${TENS[Math.floor(n / 10)]} `; n %= 10; }
  if (n > 0) out += `${ONES[n]} `;
  return out.trim();
}

function numberToWords(amount: number): string {
  const whole = Math.floor(amount);
  if (whole === 0) return 'ZERO SHILLINGS ONLY';
  const parts: string[] = [];
  const billions = Math.floor(whole / 1_000_000_000);
  const millions = Math.floor((whole % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((whole % 1_000_000) / 1_000);
  const remainder = whole % 1_000;
  if (billions) parts.push(`${threeDigitsToWords(billions)} BILLION`);
  if (millions) parts.push(`${threeDigitsToWords(millions)} MILLION`);
  if (thousands) parts.push(`${threeDigitsToWords(thousands)} THOUSAND`);
  if (remainder) parts.push(threeDigitsToWords(remainder));
  return `${parts.join(' ')} SHILLINGS ONLY`.replace(/\s+/g, ' ').trim();
}

const Finance: React.FC = () => {
  const { user } = useAuth();
  const superAdmin = isSuperAdmin(user?.role);

  const [tab, setTab] = useState<Tab>('Dashboard');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(superAdmin ? '' : String(user?.school_id || ''));
  const [term, setTerm] = useState(1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [feeStructureModal, setFeeStructureModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState<StudentRow | null>(null);
  const [historyModal, setHistoryModal] = useState<StudentRow | null>(null);

  const effectiveSchoolId = superAdmin ? (selectedSchoolId ? Number(selectedSchoolId) : null) : user?.school_id;

  const schoolsQuery = useData<School>('schools-list-finance', 'schools',
    { select: 'id, name, address, phone, email', orderBy: { column: 'name', ascending: true } }, superAdmin);
  const schools = useMemo(() => schoolsQuery.data || [], [schoolsQuery.data]);

  // For non-super-admins, fetch just their own school's full info (schoolsQuery
  // above only runs for super admins, who get the full list for the picker).
  // Deliberately NOT using useData here: it auto-injects a `school_id: X`
  // filter for every non-super-admin query, but the `schools` table has no
  // school_id column (it's keyed by `id`) - that filter silently fails the
  // query every time, which is exactly why the receipt was always falling
  // back to the literal "School" placeholder. fetchWithProxy bypasses that
  // auto-scoping entirely.
  const [ownSchool, setOwnSchool] = useState<School | null>(null);
  useEffect(() => {
    if (superAdmin || !effectiveSchoolId) { setOwnSchool(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await fetchWithProxy('schools', {
        select: 'id, name, address, phone, email', filters: { id: effectiveSchoolId },
      });
      const row = Array.isArray(data) ? data[0] : null;
      if (!cancelled) setOwnSchool(row || null);
    })();
    return () => { cancelled = true; };
  }, [superAdmin, effectiveSchoolId]);

  const gradesQuery = useData<Grade>('grades-list-finance', 'grades',
    { select: 'id, grade_name', ...(effectiveSchoolId ? { filters: { school_id: effectiveSchoolId } } : {}) },
    !!effectiveSchoolId);
  const grades = useMemo(() => {
    const list = gradesQuery.data || [];
    return [...list].sort((a, b) => (parseInt(a.grade_name.match(/\d+/)?.[0] || '0') - parseInt(b.grade_name.match(/\d+/)?.[0] || '0')));
  }, [gradesQuery.data]);

  /* ── Load students + fee structure + payments for the selected period ── */
  const loadData = async () => {
    if (!effectiveSchoolId) { setStudents([]); return; }
    setLoading(true);
    try {
      const [studentsRes, structuresRes, paymentsRes] = await Promise.all([
        fetchWithProxy('students', {
          select: 'id, admission_number, name, grade_id, stream, deleted_at',
          filters: { school_id: effectiveSchoolId },
        }),
        fetchWithProxy('fee_structures', {
          select: 'grade_id, amount',
          filters: { school_id: effectiveSchoolId, term, year },
        }),
        fetchWithProxy('fee_payments', {
          select: 'student_id, amount, voided',
          filters: { school_id: effectiveSchoolId, term, year },
        }),
      ]);

      const activeStudents = (Array.isArray(studentsRes.data) ? studentsRes.data : []).filter((s: any) => !s.deleted_at);
      const structures: Record<number, number> = {};
      (Array.isArray(structuresRes.data) ? structuresRes.data : []).forEach((s: any) => { structures[s.grade_id] = Number(s.amount); });
      const paidByStudent: Record<number, number> = {};
      (Array.isArray(paymentsRes.data) ? paymentsRes.data : []).forEach((p: any) => {
        if (p.voided) return;
        paidByStudent[p.student_id] = (paidByStudent[p.student_id] || 0) + Number(p.amount);
      });
      const gradeName = (id: number) => grades.find(g => g.id === id)?.grade_name || '—';

      const rows: StudentRow[] = activeStudents.map((s: any) => {
        const expected = structures[s.grade_id] || 0;
        const paid = paidByStudent[s.id] || 0;
        return {
          id: s.id, admission_number: s.admission_number, name: s.name, grade_id: s.grade_id,
          grade_name: gradeName(s.grade_id), stream: s.stream, expected, paid, balance: expected - paid,
        };
      });
      setStudents(rows);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load fee data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [effectiveSchoolId, term, year, grades.length]);

  const filteredStudents = useMemo(() => {
    if (!search) return students;
    const q = search.toLowerCase();
    return students.filter(s => s.name.toLowerCase().includes(q) || s.admission_number.toLowerCase().includes(q));
  }, [students, search]);

  const totals = useMemo(() => ({
    expected: students.reduce((a, s) => a + s.expected, 0),
    collected: students.reduce((a, s) => a + s.paid, 0),
    outstanding: students.reduce((a, s) => a + Math.max(0, s.balance), 0),
  }), [students]);

  const school: SchoolInfo = useMemo(() => {
    const found = schools.find(s => String(s.id) === selectedSchoolId) || ownSchool;
    return {
      name: found?.name || 'School',
      address: found?.address, phone: found?.phone, email: found?.email,
    };
  }, [schools, selectedSchoolId, ownSchool]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#1e3a5f] flex items-center justify-center">
            <Wallet className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Finance</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Fee collection, receipts, and reports.</p>
          </div>
        </div>
      </header>

      {/* Period + school selectors */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-wrap gap-3 items-end">
        {superAdmin && (
          <div className="space-y-1 min-w-[200px]">
            <label className="text-xs font-bold text-slate-500 uppercase">School</label>
            <select value={selectedSchoolId} onChange={e => setSelectedSchoolId(e.target.value)} className={inputCls}>
              <option value="">Select School</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase">Term</label>
          <select value={term} onChange={e => setTerm(Number(e.target.value))} className={inputCls}>
            <option value={1}>Term 1</option><option value={2}>Term 2</option><option value={3}>Term 3</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase">Year</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className={inputCls}>
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {effectiveSchoolId && (
          <button onClick={() => setFeeStructureModal(true)} className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
            <Settings2 size={16} /> Set Fee Structure
          </button>
        )}
      </div>

      {!effectiveSchoolId ? (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl p-8 text-center text-blue-600 dark:text-blue-300 font-medium">
          {superAdmin ? 'Select a school to view its finance data.' : 'Loading your school…'}
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${tab === t ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500'}`}>
                {t}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-600" size={28} /></div>
          ) : tab === 'Dashboard' ? (
            <DashboardTab totals={totals} studentCount={students.length} />
          ) : tab === 'Student Fees' ? (
            <StudentFeesTab
              students={filteredStudents} search={search} setSearch={setSearch}
              onRecordPayment={setPaymentModal} onViewHistory={setHistoryModal}
            />
          ) : (
            <ReportsTab
              students={students} schoolName={school.name} term={term} year={year}
              effectiveSchoolId={effectiveSchoolId} grades={grades}
            />
          )}
        </>
      )}

      {feeStructureModal && effectiveSchoolId && (
        <FeeStructureModal
          schoolId={effectiveSchoolId} grades={grades} term={term} year={year}
          onClose={() => setFeeStructureModal(false)}
          onSaved={() => { setFeeStructureModal(false); loadData(); }}
        />
      )}
      {paymentModal && effectiveSchoolId && (
        <RecordPaymentModal
          student={paymentModal} schoolId={effectiveSchoolId} term={term} year={year}
          school={school} userId={user?.id} clerkName={user?.name || 'Accounts Clerk'}
          onClose={() => setPaymentModal(null)}
          onSaved={() => { setPaymentModal(null); loadData(); }}
        />
      )}
      {historyModal && effectiveSchoolId && (
        <PaymentHistoryModal
          student={historyModal} school={school} schoolId={effectiveSchoolId}
          onClose={() => setHistoryModal(null)}
        />
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════
   Dashboard tab
══════════════════════════════════════════════════════════════════════ */
const DashboardTab: React.FC<{ totals: { expected: number; collected: number; outstanding: number }; studentCount: number }> = ({ totals, studentCount }) => {
  const pct = totals.expected > 0 ? Math.round((totals.collected / totals.expected) * 100) : 0;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium mb-2"><Wallet size={16} /> Total Fees Expected</div>
        <p className="text-3xl font-bold text-slate-900 dark:text-white">{money(totals.expected)}</p>
        <p className="text-xs text-slate-400 mt-1">{studentCount} students</p>
      </div>
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 text-green-600 text-sm font-medium mb-2"><TrendingUp size={16} /> Total Fees Collected</div>
        <p className="text-3xl font-bold text-green-600">{money(totals.collected)}</p>
        <p className="text-xs text-slate-400 mt-1">{pct}% of expected</p>
      </div>
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 text-red-500 text-sm font-medium mb-2"><AlertTriangle size={16} /> Outstanding Balance</div>
        <p className="text-3xl font-bold text-red-500">{money(totals.outstanding)}</p>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════
   Student Fees tab
══════════════════════════════════════════════════════════════════════ */
const StudentFeesTab: React.FC<{
  students: StudentRow[]; search: string; setSearch: (s: string) => void;
  onRecordPayment: (s: StudentRow) => void; onViewHistory: (s: StudentRow) => void;
}> = ({ students, search, setSearch, onRecordPayment, onViewHistory }) => (
  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
    <div className="p-4 border-b border-slate-100 dark:border-slate-800">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or admission number..."
          className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white" />
      </div>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase">
            <th className="px-4 py-3 text-left">Admission No</th>
            <th className="px-4 py-3 text-left">Name</th>
            <th className="px-4 py-3 text-left">Grade</th>
            <th className="px-4 py-3 text-right">Expected</th>
            <th className="px-4 py-3 text-right">Paid</th>
            <th className="px-4 py-3 text-right">Balance</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
          {students.map(s => (
            <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="px-4 py-3 font-mono text-blue-600">{s.admission_number}</td>
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{s.name}</td>
              <td className="px-4 py-3 text-slate-500">{s.grade_name}</td>
              <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{money(s.expected)}</td>
              <td className="px-4 py-3 text-right text-green-600">{money(s.paid)}</td>
              <td className={`px-4 py-3 text-right font-bold ${s.balance > 0 ? 'text-red-500' : 'text-green-600'}`}>{money(Math.max(0, s.balance))}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <button onClick={() => onViewHistory(s)} title="Payment History" className="p-1.5 text-slate-400 hover:text-blue-600"><History size={16} /></button>
                  <button onClick={() => onRecordPayment(s)} title="Record Payment" className="p-1.5 text-slate-400 hover:text-green-600"><Plus size={16} /></button>
                </div>
              </td>
            </tr>
          ))}
          {students.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No students found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

/* ══════════════════════════════════════════════════════════════════════
   Fee Structure modal — set expected fee per grade for the selected period
══════════════════════════════════════════════════════════════════════ */
const FeeStructureModal: React.FC<{
  schoolId: number; grades: Grade[]; term: number; year: number;
  onClose: () => void; onSaved: () => void;
}> = ({ schoolId, grades, term, year, onClose, onSaved }) => {
  const [selectedGradeId, setSelectedGradeId] = useState<string>(grades[0] ? String(grades[0].id) : '');
  const [voteHeads, setVoteHeads] = useState<VoteHead[]>([]);
  const [structureId, setStructureId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);

  const loadForGrade = async (gradeId: string) => {
    if (!gradeId) return;
    setLoadingExisting(true);
    try {
      const { data } = await fetchWithProxy('fee_structures', {
        select: 'id, amount', filters: { school_id: schoolId, grade_id: Number(gradeId), term, year },
      });
      const structure = Array.isArray(data) ? data[0] : null;
      setStructureId(structure?.id ?? null);
      if (structure?.id) {
        const { data: vhData } = await fetchWithProxy('fee_vote_heads', {
          select: 'id, account_code, purpose, amount, sort_order',
          filters: { fee_structure_id: structure.id },
          orderBy: { column: 'sort_order', ascending: true },
        });
        const rows = (Array.isArray(vhData) ? vhData : []).map((v: any) => ({
          id: v.id, account_code: v.account_code || '', purpose: v.purpose, amount: String(v.amount),
        }));
        setVoteHeads(rows.length ? rows : (structure.amount ? [{ account_code: '', purpose: 'School Fees', amount: String(structure.amount) }] : []));
      } else {
        setVoteHeads([]);
      }
    } finally {
      setLoadingExisting(false);
    }
  };

  useEffect(() => { loadForGrade(selectedGradeId); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedGradeId, schoolId, term, year]);

  const addRow = () => setVoteHeads(prev => [...prev, { account_code: '', purpose: '', amount: '' }]);
  const removeRow = (idx: number) => setVoteHeads(prev => prev.filter((_, i) => i !== idx));
  const updateRow = (idx: number, patch: Partial<VoteHead>) =>
    setVoteHeads(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));

  const total = useMemo(() => voteHeads.reduce((a, v) => a + (Number(v.amount) || 0), 0), [voteHeads]);

  const handleSave = async () => {
    if (!selectedGradeId) { toast.error('Select a grade first.'); return; }
    const validRows = voteHeads.filter(v => v.purpose && Number(v.amount) > 0);
    if (!validRows.length) { toast.error('Add at least one fee purpose with an amount.'); return; }

    setSaving(true);
    try {
      const { data } = await writeWithProxy('fee_structures', 'upsert',
        { school_id: schoolId, grade_id: Number(selectedGradeId), term, year, amount: total },
        undefined,
        'school_id,grade_id,term,year'
      );
      const savedStructure = Array.isArray(data) ? data[0] : data;
      const feeStructureId = savedStructure?.id ?? structureId;
      if (!feeStructureId) throw new Error('Could not resolve the fee structure record.');

      // Replace the vote-head breakdown wholesale for this structure -
      // simplest way to keep additions/edits/removals all in sync.
      await writeWithProxy('fee_vote_heads', 'delete', undefined, { fee_structure_id: feeStructureId });
      for (let i = 0; i < validRows.length; i++) {
        const v = validRows[i];
        await writeWithProxy('fee_vote_heads', 'insert', {
          fee_structure_id: feeStructureId, school_id: schoolId,
          account_code: v.account_code || null, purpose: v.purpose, amount: Number(v.amount), sort_order: i,
        });
      }

      toast.success('Fee structure saved.');
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save fee structure.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Fee Structure — Term {term}, {year}</h2>
            <p className="text-xs text-slate-500">Break the fee down by purpose, the way it prints on the receipt.</p>
          </div>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Grade</label>
            <select value={selectedGradeId} onChange={e => setSelectedGradeId(e.target.value)} className={inputCls}>
              {grades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
            </select>
          </div>

          {loadingExisting ? <Loader2 className="animate-spin text-blue-600 mx-auto" /> : (
            <div className="space-y-2">
              <div className="grid grid-cols-[80px_1fr_100px_28px] gap-2 text-xs font-bold text-slate-400 uppercase px-1">
                <span>Code</span><span>Purpose</span><span className="text-right">Amount</span><span />
              </div>
              {voteHeads.map((v, idx) => (
                <div key={idx} className="grid grid-cols-[80px_1fr_100px_28px] gap-2 items-center">
                  <input value={v.account_code} onChange={e => updateRow(idx, { account_code: e.target.value })} placeholder="10011003"
                    className="px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white" />
                  <input value={v.purpose} onChange={e => updateRow(idx, { purpose: e.target.value })} placeholder="e.g. Boarding Equipment and Stores"
                    className="px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white" />
                  <input type="number" min={0} value={v.amount} onChange={e => updateRow(idx, { amount: e.target.value })} placeholder="0"
                    className="px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-right outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white" />
                  <button onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600"><X size={16} /></button>
                </div>
              ))}
              <button onClick={addRow} className="text-xs font-bold text-blue-600 flex items-center gap-1 pt-1"><Plus size={14} /> Add fee purpose</button>

              <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Total Expected</span>
                <span className="text-lg font-bold text-blue-600">{money(total)}</span>
              </div>
            </div>
          )}
          {!loadingExisting && grades.length === 0 && <p className="text-sm text-slate-400 text-center">No grades set up for this school yet.</p>}
        </div>
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-blue-600 text-white disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════
   Record Payment modal
══════════════════════════════════════════════════════════════════════ */
const RecordPaymentModal: React.FC<{
  student: StudentRow; schoolId: number; term: number; year: number; school: SchoolInfo; userId?: string; clerkName: string;
  onClose: () => void; onSaved: () => void;
}> = ({ student, schoolId, term, year, school, userId, clerkName, onClose, onSaved }) => {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount.'); return; }
    setSaving(true);
    try {
      const { data } = await writeWithProxy('fee_payments', 'insert', {
        school_id: schoolId, student_id: student.id, term, year, amount: amt,
        payment_method: method, reference_number: reference || null, notes: notes || null,
        recorded_by: userId,
      });
      const payment = Array.isArray(data) ? data[0] : data;
      toast.success('Payment recorded successfully.');
      if (payment) {
        const voteHeads = await fetchVoteHeadsForGrade(schoolId, student.grade_id, term, year);
        const totalPaid = student.paid + amt;
        printReceipt({
          payment, student, school, term, year, clerkName, voteHeads,
          totalPaid, balanceDue: Math.max(0, student.expected - totalPaid),
        });
      }
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Record Payment</h2>
            <p className="text-xs text-slate-500">{student.name} · {student.admission_number}</p>
          </div>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300 font-medium">
            Current balance: {money(Math.max(0, student.balance))}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Amount (KSh)</label>
            <input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)} className={inputCls} autoFocus />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Payment Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)} className={inputCls}>
              {['Cash', 'M-Pesa', 'Bank Transfer', 'Cheque', 'Other'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Reference Number (optional)</label>
            <input value={reference} onChange={e => setReference(e.target.value)} className={inputCls} placeholder="M-Pesa code, cheque no..." />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} rows={2} />
          </div>
        </div>
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-green-600 text-white disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : 'Record & Print Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════
   Payment History modal
══════════════════════════════════════════════════════════════════════ */
const PaymentHistoryModal: React.FC<{ student: StudentRow; school: SchoolInfo; schoolId: number; onClose: () => void }> = ({ student, school, schoolId, onClose }) => {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [printingId, setPrintingId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await fetchWithProxy('fee_payments', {
        select: 'id, student_id, amount, payment_method, reference_number, receipt_number, notes, payment_date, voided, term, year, recorded_by',
        filters: { student_id: student.id },
        orderBy: { column: 'payment_date', ascending: false },
      });
      setPayments(Array.isArray(data) ? data : []);
      setLoading(false);
    })();
  }, [student.id]);

  const handleReprint = async (p: PaymentRow) => {
    setPrintingId(p.id);
    try {
      const [voteHeads, clerkName] = await Promise.all([
        fetchVoteHeadsForGrade(schoolId, student.grade_id, p.term, p.year),
        resolveClerkName(p.recorded_by),
      ]);
      // Reprints show the balance as of NOW (not as of the original payment
      // date) since that's the figure that's actually useful on a reprint.
      printReceipt({
        payment: p, student, school, term: p.term, year: p.year, clerkName, voteHeads,
        totalPaid: student.paid, balanceDue: Math.max(0, student.balance),
      });
    } finally {
      setPrintingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Payment History</h2>
            <p className="text-xs text-slate-500">{student.name} · {student.admission_number}</p>
          </div>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="p-5">
          {loading ? <Loader2 className="animate-spin text-blue-600 mx-auto" /> : payments.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No payments recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {payments.map(p => (
                <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${p.voided ? 'border-red-100 bg-red-50/50 opacity-60' : 'border-slate-100 dark:border-slate-800'}`}>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{money(p.amount)} {p.voided && <span className="text-red-500 text-xs font-normal">(voided)</span>}</p>
                    <p className="text-xs text-slate-400">{new Date(p.payment_date).toLocaleDateString()} · {p.payment_method} · {p.receipt_number}</p>
                  </div>
                  <button onClick={() => handleReprint(p)} disabled={printingId === p.id} title="Print Receipt" className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-50">
                    {printingId === p.id ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════
   Reports tab
══════════════════════════════════════════════════════════════════════ */
const ReportsTab: React.FC<{ students: StudentRow[]; schoolName: string; term: number; year: number; effectiveSchoolId: number; grades: Grade[] }> = ({ students, schoolName, term, year, effectiveSchoolId, grades }) => {
  const [statementStudentId, setStatementStudentId] = useState('');
  const [outstandingGradeId, setOutstandingGradeId] = useState('');
  const [generating, setGenerating] = useState('');

  const handleCollectionReport = async () => {
    setGenerating('collection');
    try {
      const { data } = await fetchWithProxy('fee_payments', {
        select: 'student_id, amount, payment_method, receipt_number, payment_date, voided',
        filters: { school_id: effectiveSchoolId, term, year },
        orderBy: { column: 'payment_date', ascending: true },
      });
      const payments = (Array.isArray(data) ? data : []).filter((p: any) => !p.voided);
      const doc = createPdfDoc('p');
      const startY = drawPdfHeader(doc, {
        schoolName, title: 'FEE COLLECTION REPORT', subtitle: `Term ${term}, ${year}`,
        meta: [`Generated: ${new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}`],
      });
      autoTable(doc, {
        ...PDF_TABLE_THEME,
        startY,
        head: [['Date', 'Student', 'Admission No', 'Amount', 'Method', 'Receipt No']],
        body: payments.map((p: any) => {
          const s = students.find(st => st.id === p.student_id);
          return [new Date(p.payment_date).toLocaleDateString(), s?.name || '—', s?.admission_number || '—', money(p.amount), p.payment_method, p.receipt_number];
        }),
      });
      finalizePdf(doc);
      doc.save(`Fee_Collection_Report_T${term}_${year}.pdf`);
      toast.success('Fee Collection Report downloaded.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate report.');
    } finally { setGenerating(''); }
  };

  const handleOutstandingReport = () => {
    if (!outstandingGradeId) { toast.error('Select a class first.'); return; }
    setGenerating('outstanding');
    const grade = grades.find(g => String(g.id) === outstandingGradeId);
    const gradeName = grade?.grade_name || 'Selected Class';

    // Class + tenant scoping happens entirely against `students`, which was
    // already fetched scoped to effectiveSchoolId (the authenticated user's
    // own school — see loadData() above). Filtering further by grade_id
    // here is a client-side narrowing of an already tenant-safe list, never
    // a new query a caller could redirect to another school's data; RLS on
    // the server backs this regardless of what the client sends.
    const outstanding = students
      .filter(s => s.grade_id === grade?.id && s.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    const doc = createPdfDoc('p');
    const dateStr = new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
    const startY = drawPdfHeader(doc, {
      schoolName, title: 'OUTSTANDING FEES REPORT',
      meta: [`CLASS: ${gradeName}`, `DATE: ${dateStr}`],
    });

    if (outstanding.length === 0) {
      drawEmptyState(doc, `No outstanding fee balances found for ${gradeName}.`, startY);
      finalizePdf(doc);
    } else {
      autoTable(doc, {
        ...PDF_TABLE_THEME,
        startY,
        head: [['Admission No', 'Student Name', 'Class', 'Amount Due', 'Amount Paid', 'Outstanding Balance']],
        body: outstanding.map(s => [s.admission_number, s.name, s.grade_name, money(s.expected), money(s.paid), money(s.balance)]),
      });
      const totals = outstanding.reduce((a, s) => ({
        due: a.due + s.expected, paid: a.paid + s.paid, balance: a.balance + s.balance,
      }), { due: 0, paid: 0, balance: 0 });
      const afterTable = (doc as any).lastAutoTable.finalY + 8;
      drawSummaryBlock(doc, [
        ['Total students with outstanding balances', String(outstanding.length)],
        ['Total amount due', money(totals.due)],
        ['Total amount paid', money(totals.paid)],
        ['Total outstanding balance', money(totals.balance)],
      ], afterTable);
      finalizePdf(doc);
    }

    doc.save(`Outstanding_Fees_${gradeName.replace(/\s+/g, '_')}_T${term}_${year}.pdf`);
    toast.success('Outstanding Fees Report downloaded.');
    setGenerating('');
  };

  const handleStatement = async () => {
    if (!statementStudentId) { toast.error('Select a student first.'); return; }
    setGenerating('statement');
    try {
      const student = students.find(s => String(s.id) === statementStudentId);
      if (!student) return;
      const { data } = await fetchWithProxy('fee_payments', {
        select: 'amount, payment_method, receipt_number, payment_date, voided',
        filters: { student_id: student.id },
        orderBy: { column: 'payment_date', ascending: true },
      });
      const payments = (Array.isArray(data) ? data : []).filter((p: any) => !p.voided);
      const doc = createPdfDoc('p');
      const startY = drawPdfHeader(doc, {
        schoolName, title: 'STUDENT FEE STATEMENT', subtitle: `${student.name} (${student.admission_number})`,
      });
      autoTable(doc, {
        ...PDF_TABLE_THEME,
        startY,
        head: [['Date', 'Amount', 'Method', 'Receipt No']],
        body: payments.map((p: any) => [new Date(p.payment_date).toLocaleDateString(), money(p.amount), p.payment_method, p.receipt_number]),
      });
      const afterTable = (doc as any).lastAutoTable.finalY + 8;
      drawSummaryBlock(doc, [
        ['Total Expected', money(student.expected)],
        ['Total Paid', money(student.paid)],
        ['Balance', money(Math.max(0, student.balance))],
      ], afterTable);
      finalizePdf(doc);
      doc.save(`Fee_Statement_${student.admission_number}.pdf`);
      toast.success('Student Fee Statement downloaded.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate statement.');
    } finally { setGenerating(''); }
  };

  return (
    <div className="grid md:grid-cols-3 gap-5">
      <ReportCard icon={FileText} title="Fee Collection Report" desc="All payments received this term." loading={generating === 'collection'} onClick={handleCollectionReport} />
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold text-sm"><AlertTriangle size={16} /> Outstanding Fees Report</div>
        <p className="text-xs text-slate-400">Select a class to see who still owes fees.</p>
        <select value={outstandingGradeId} onChange={e => setOutstandingGradeId(e.target.value)} className={inputCls}>
          <option value="">Select class</option>
          {grades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
        </select>
        <button onClick={handleOutstandingReport} disabled={generating === 'outstanding' || !outstandingGradeId} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white disabled:opacity-50">
          {generating === 'outstanding' ? <Loader2 size={16} className="animate-spin" /> : 'Generate PDF'}
        </button>
      </div>
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold text-sm"><Receipt size={16} /> Student Fee Statement</div>
        <p className="text-xs text-slate-400">Full payment history for one student.</p>
        <select value={statementStudentId} onChange={e => setStatementStudentId(e.target.value)} className={inputCls}>
          <option value="">Select student</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.name} — {s.admission_number}</option>)}
        </select>
        <button onClick={handleStatement} disabled={generating === 'statement'} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white disabled:opacity-50">
          {generating === 'statement' ? <Loader2 size={16} className="animate-spin" /> : 'Generate'}
        </button>
      </div>
    </div>
  );
};

const ReportCard: React.FC<{ icon: any; title: string; desc: string; loading: boolean; onClick: () => void }> = ({ icon: Icon, title, desc, loading, onClick }) => (
  <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold text-sm"><Icon size={16} /> {title}</div>
    <p className="text-xs text-slate-400">{desc}</p>
    <button onClick={onClick} disabled={loading} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white disabled:opacity-50">
      {loading ? <Loader2 size={16} className="animate-spin" /> : 'Download PDF'}
    </button>
  </div>
);

/* ══════════════════════════════════════════════════════════════════════
   PDF helpers now come from ../lib/pdfKit (createPdfDoc, drawPdfHeader,
   finalizePdf) — every report in this file uses those instead of its
   own letterhead/footer logic, so styling stays centralized and
   monochrome/bordered across the whole app.
══════════════════════════════════════════════════════════════════════ */

/* ── Shared: load a grade's vote-head fee breakdown for a given period ──── */
async function fetchVoteHeadsForGrade(schoolId: number, gradeId: number, term: number, year: number): Promise<VoteHead[]> {
  if (!term || !year) return [];
  const { data: structureData } = await fetchWithProxy('fee_structures', {
    select: 'id', filters: { school_id: schoolId, grade_id: gradeId, term, year },
  });
  const structure = Array.isArray(structureData) ? structureData[0] : null;
  if (!structure?.id) return [];
  const { data } = await fetchWithProxy('fee_vote_heads', {
    select: 'account_code, purpose, amount', filters: { fee_structure_id: structure.id },
    orderBy: { column: 'sort_order', ascending: true },
  });
  return (Array.isArray(data) ? data : []).map((v: any) => ({ account_code: v.account_code || '', purpose: v.purpose, amount: String(v.amount) }));
}

/* ── Shared: resolve who recorded a payment, for the "Served By" line ───── */
async function resolveClerkName(recordedBy: string | null): Promise<string> {
  if (!recordedBy) return 'Accounts Clerk';
  try {
    const { data } = await fetchWithProxy('profiles', { select: 'full_name', filters: { id: recordedBy } });
    const row = Array.isArray(data) ? data[0] : null;
    return row?.full_name || 'Accounts Clerk';
  } catch {
    return 'Accounts Clerk';
  }
}

/* ── Official payment receipt — matches the school's traditional paper
   receipt layout: letterhead, account/date/slip details, amount in words,
   a "Being Payment Of" purpose breakdown, totals, and a clerk sign-off. ──── */
function printReceipt(params: {
  payment: any; student: StudentRow; school: SchoolInfo; term: number; year: number;
  clerkName: string; voteHeads: VoteHead[]; totalPaid: number; balanceDue: number;
}) {
  const { payment, student, school, term, year, clerkName, voteHeads, totalPaid, balanceDue } = params;
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = doc.internal.pageSize.width;
  const H = doc.internal.pageSize.height;
  const M = 14;
  const SLOT_H = H / 2; // two identical copies per sheet - cut/photocopy along the middle

  // Draws one full copy of the receipt, confined to the vertical band
  // starting at `top` and SLOT_H tall.
  const drawCopy = (top: number) => {
    let y = top + 10;

    const center = (text: string, size: number, bold = true) => {
      doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(0, 0, 0);
      doc.text(text, W / 2, y, { align: 'center' });
      y += size * 0.55;
    };

    // ── Letterhead ──────────────────────────────────────────────────────
    center(school.name.toUpperCase(), 14);
    if (school.address) center(school.address, 8, false);
    const contactLine = [school.phone ? `Tel: ${school.phone}` : '', school.email ? `Email: ${school.email}` : ''].filter(Boolean).join('   ');
    if (contactLine) center(contactLine, 8, false);
    y += 2;
    doc.setDrawColor(0); doc.setLineWidth(0.4);
    doc.line(M, y, W - M, y);
    y += 6;

    // ── Details — condensed into 3 rows, 2 columns each ──────────────────
    const colL = M, colR = W / 2 + 4;
    const cell = (x: number, label: string, value: string) => {
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
      doc.text(label, x, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, x, y + 4.5);
    };
    cell(colL, 'ACCOUNT NAME', student.name.toUpperCase());
    cell(colR, 'RECEIPT NO.', payment.receipt_number);
    y += 10;
    cell(colL, 'ADM. NO.', student.admission_number);
    cell(colR, 'DATE', new Date(payment.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));
    y += 10;
    cell(colL, 'FORM/GRADE', `${student.grade_name}${student.stream ? ' ' + student.stream : ''}`);
    cell(colR, 'TIME', new Date(payment.payment_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    y += 8;

    // ── Amount in words ───────────────────────────────────────────────
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    doc.text('Amount in Words:-', M, y);
    doc.setFont('helvetica', 'normal');
    const wordsLines = doc.splitTextToSize(numberToWords(payment.amount), W - M * 2 - 40);
    doc.text(wordsLines, M + 40, y);
    y += Math.max(wordsLines.length * 4.5, 5) + 4;

    // ── Being Payment Of: purpose breakdown ───────────────────────────
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    doc.text('Being Payment Of:', M, y);
    y += 2;

    const rows = voteHeads.length ? voteHeads : [{ account_code: '', purpose: 'School Fees', amount: String(payment.amount) }];
    autoTable(doc, {
      startY: y,
      head: [['Code', 'Description', 'Kshs.']],
      body: rows.map(v => [v.account_code || '—', v.purpose, Number(v.amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })]),
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: 1, textColor: [0, 0, 0] },
      headStyles: { fontStyle: 'bold', fillColor: false, textColor: [0, 0, 0] },
      columnStyles: { 0: { cellWidth: 24, font: 'courier' }, 2: { halign: 'right', cellWidth: 28 } },
      margin: { left: M, right: M },
      tableWidth: W - M * 2,
    });
    y = (doc as any).lastAutoTable.finalY + 3;
    doc.setDrawColor(0); doc.line(M, y, W - M, y);
    y += 6;

    // ── Totals ───────────────────────────────────────────────────────
    const totalsLine = (label: string, value: string, bold = true) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(9.5);
      doc.text(label, M, y);
      doc.text(value, W - M, y, { align: 'right' });
      y += 5.5;
    };
    totalsLine('Amount Paid', `Kshs. ${Number(payment.amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`);
    totalsLine('Total Paid (to date)', `Kshs. ${totalPaid.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`, false);
    totalsLine('Balance Due', `Kshs. ${balanceDue.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`, false);
    y += 3;

    // ── Payment method / bank slip ref ─────────────────────────────────
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(`Payment Method: ${payment.payment_method}${payment.reference_number ? '   Bank Slip: ' + payment.reference_number : ''}`, M, y);
    y += 9;

    // ── Sign-off ───────────────────────────────────────────────────────
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
    doc.text(`Served By: ${clerkName}`, M, y);
    doc.text(new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }), M, y + 5);

    const boxW = 42, boxH = 18;
    doc.setDrawColor(120); doc.setLineDash([1, 1], 0);
    doc.rect(W - M - boxW, y - 12, boxW, boxH);
    doc.setLineDash([]);
    doc.setFontSize(6.5); doc.setTextColor(130, 130, 130);
    doc.text('OFFICIAL STAMP', W - M - boxW / 2, y - 2, { align: 'center' });

    if (payment.voided) {
      doc.setTextColor(...PDF_COLORS.darkGray); doc.setFontSize(22); doc.setFont('helvetica', 'bold');
      doc.text('VOIDED', W / 2, top + SLOT_H / 2, { align: 'center', angle: 25 });
    }

    doc.setFontSize(6.5); doc.setTextColor(150, 150, 150); doc.setFont('helvetica', 'normal');
    doc.text('Generated by EduNexa Analytics', W / 2, top + SLOT_H - 5, { align: 'center' });
  };

  drawCopy(0);
  drawCopy(SLOT_H);

  // Cut line between the two copies.
  doc.setDrawColor(0); doc.setLineDash([2, 2], 0);
  doc.line(M / 2, SLOT_H, W - M / 2, SLOT_H);
  doc.setLineDash([]);
  doc.setFontSize(6.5); doc.setTextColor(150, 150, 150);
  doc.text('✂ cut here', M / 2, SLOT_H - 1.5);

  addBorderToAllPages(doc);
  doc.save(`Receipt_${payment.receipt_number}.pdf`);
}

export default Finance;