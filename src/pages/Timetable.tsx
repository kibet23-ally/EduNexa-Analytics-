import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Calendar, Clock, Wand2, LayoutGrid, GraduationCap,
  ShieldCheck, Loader2, Plus, Trash2, Download, X, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../useAuth';
import { useData, useDataMutation } from '../hooks/useData';
import { fetchWithProxy } from '../lib/fetchProxy';
import { Grade, Subject, TeacherAssignment, School } from '../types';
import {
  Day, DAY_LABELS, Period, Requirement, Entry, periodsForDay,
  checkCollision, generateTimetable, validateTimetable, ValidationReport,
} from '../lib/timetableGenerator';
import { exportClassTimetablePdf, exportTeacherTimetablePdf, exportMasterTimetablePdf } from '../lib/timetablePdf';

const ALL_DAYS: Day[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const inputCls = "w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white";
const cardCls = "bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800";

interface TeacherRow { id: string; name: string; }
interface TTSettings { id: number; academic_year: number; term: number; working_days: Day[]; max_lessons_per_day_per_teacher: number | null; }

const TABS = ['Dashboard', 'Periods & Breaks', 'Subjects & Teachers', 'Generate', 'Master Timetable', 'Class Timetables', 'Teacher Timetables', 'Validation'] as const;
type Tab = typeof TABS[number];

const Timetable = () => {
  const { user } = useAuth();
  const rawRole = (user?.role || '').toLowerCase();
  const canManage = ['admin', 'school_admin', 'schooladmin', 'principal', 'superadmin', 'super_admin', 'timetabler'].includes(rawRole);
  const isTeacherRole = rawRole === 'teacher';

  const [year, setYear] = useState(new Date().getFullYear());
  const [term, setTerm] = useState(1);
  const [tab, setTab] = useState<Tab>('Dashboard');

  const [school, setSchool] = useState<School | null>(null);
  useEffect(() => {
    if (!user?.school_id) { setSchool(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await fetchWithProxy('schools', { select: 'id, name', filters: { id: user.school_id } });
      const row = Array.isArray(data) ? data[0] : null;
      if (!cancelled) setSchool(row || null);
    })();
    return () => { cancelled = true; };
  }, [user?.school_id]);
  const schoolName = school?.name || 'School';

  const settingsQuery = useData<TTSettings>('tt-settings', 'timetable_settings', { select: '*', filters: { academic_year: year, term } }, !!user?.school_id);
  const settings = (settingsQuery.data && settingsQuery.data[0]) || null;
  const workingDays: Day[] = settings?.working_days || ['MON', 'TUE', 'WED', 'THU', 'FRI'];

  const periodsQuery = useData<Period>('tt-periods', 'timetable_periods', { select: '*', filters: { academic_year: year, term }, orderBy: { column: 'period_index', ascending: true } }, !!user?.school_id);
  const periods = periodsQuery.data || [];

  const gradesQuery = useData<Grade>('tt-grades', 'grades', { select: 'id, grade_name', orderBy: { column: 'grade_name' } }, !!user?.school_id);
  const grades = gradesQuery.data || [];

  const subjectsQuery = useData<Subject>('tt-subjects', 'subjects', { select: 'id, subject_name, subject_code' }, !!user?.school_id);
  const subjects = subjectsQuery.data || [];

  const teachersQuery = useData<TeacherRow>('tt-teachers', 'teachers', { select: 'id, name' }, !!user?.school_id);
  const teachers = teachersQuery.data || [];

  const reqsQuery = useData<TeacherAssignment>('tt-requirements', 'teacher_assignments', { select: '*', filters: { is_active: true } }, !!user?.school_id);
  const requirements: Requirement[] = useMemo(() => (reqsQuery.data || []).map(r => ({
    id: r.id, teacher_id: r.teacher_id, subject_id: r.subject_id, grade_id: r.grade_id,
    lessons_per_week: r.lessons_per_week || 0, allow_double: !!r.allow_double,
  })), [reqsQuery.data]);

  const entriesQuery = useData<Entry & { id: number }>('tt-entries', 'timetable_entries', { select: '*', filters: { academic_year: year, term } }, !!user?.school_id);
  const entries = (entriesQuery.data || []) as (Entry & { id: number })[];

  const gradeName = (id: number) => grades.find(g => g.id === id)?.grade_name || `#${id}`;
  const subjectName = (id: number) => subjects.find(s => s.id === id)?.subject_name || `#${id}`;
  const subjectCode = (id: number) => subjects.find(s => s.id === id)?.subject_code || subjectName(id).slice(0, 4).toUpperCase();
  const teacherName = (id: string) => teachers.find(t => t.id === id)?.name || 'Unassigned';
  const teacherInitials = (id: string) => {
    const n = teacherName(id);
    return n.split(' ').map(p => p[0]).join('').slice(0, 3).toUpperCase();
  };

  // A Teacher gets a read-only view of just their own timetable — never
  // the editor, generator, or configuration screens.
  if (isTeacherRole && !canManage) {
    return <MyTimetableView user={user} entries={entries} periods={periods} workingDays={workingDays}
      gradeName={gradeName} subjectCode={subjectCode} teacherName={teacherName}
      schoolName={schoolName} year={year} term={term} setYear={setYear} setTerm={setTerm} />;
  }

  if (!canManage) {
    return (
      <div className="max-w-lg mx-auto mt-24 text-center">
        <ShieldCheck className="mx-auto text-slate-300" size={48} />
        <p className="mt-4 text-slate-500">The Timetable module is only available to School Admins and Timetablers.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Timetable</h1>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))} className={inputCls + ' w-28'}>
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={term} onChange={e => setTerm(Number(e.target.value))} className={inputCls + ' w-32'}>
            <option value={1}>Term 1</option><option value={2}>Term 2</option><option value={3}>Term 3</option>
          </select>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap ${tab === t ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Dashboard' && (
        <DashboardTab settings={settings} periods={periods} entries={entries} requirements={requirements} grades={grades} year={year} term={term} />
      )}
      {tab === 'Periods & Breaks' && (
        <PeriodsTab year={year} term={term} periods={periods} settings={settings} workingDays={workingDays} schoolId={user?.school_id} />
      )}
      {tab === 'Subjects & Teachers' && (
        <RequirementsTab reqsRaw={reqsQuery.data || []} grades={grades} subjects={subjects} teachers={teachers} />
      )}
      {tab === 'Generate' && (
        <GenerateTab year={year} term={term} requirements={requirements} periods={periods} workingDays={workingDays}
          gradeName={gradeName} subjectName={subjectName} teacherName={teacherName} existingCount={entries.length} schoolId={user?.school_id} />
      )}
      {tab === 'Master Timetable' && (
        <GridTab title="Master Timetable" scope="all" grades={grades} entries={entries} periods={periods} workingDays={workingDays}
          subjectCode={subjectCode} teacherInitials={teacherInitials} gradeName={gradeName} subjectName={subjectName} teacherName={teacherName}
          onExport={() => exportMasterTimetablePdf(grades, entries, { schoolName, academicYear: year, term, workingDays, allPeriods: periods }, subjectCode, teacherInitials)}
          year={year} term={term} />
      )}
      {tab === 'Class Timetables' && (
        <ClassTimetablesTab grades={grades} entries={entries} periods={periods} workingDays={workingDays}
          subjectCode={subjectCode} teacherInitials={teacherInitials} gradeName={gradeName} subjectName={subjectName} teacherName={teacherName}
          year={year} term={term} schoolName={schoolName} />
      )}
      {tab === 'Teacher Timetables' && (
        <TeacherTimetablesTab teachers={teachers} entries={entries} periods={periods} workingDays={workingDays}
          subjectCode={subjectCode} gradeName={gradeName} subjectName={subjectName} teacherName={teacherName}
          year={year} term={term} schoolName={schoolName} />
      )}
      {tab === 'Validation' && (
        <ValidationTab entries={entries} requirements={requirements} gradeName={gradeName} teacherName={teacherName} subjectName={subjectName} />
      )}
    </div>
  );
};

/* ═══════════════════════════ Dashboard ═══════════════════════════ */
const DashboardTab: React.FC<{ settings: TTSettings | null; periods: Period[]; entries: Entry[]; requirements: Requirement[]; grades: Grade[]; year: number; term: number }> =
({ settings, periods, entries, requirements, grades, year, term }) => {
  const requiredTotal = requirements.reduce((s, r) => s + r.lessons_per_week, 0);
  const stats = [
    { label: 'Working Days', value: settings?.working_days?.length ?? 5, icon: Calendar },
    { label: 'Lesson Periods/Day', value: periods.filter(p => p.period_type === 'lesson' && p.day === null).length, icon: Clock },
    { label: 'Classes', value: grades.length, icon: GraduationCap },
    { label: 'Entries Scheduled', value: `${entries.length} / ${requiredTotal}`, icon: LayoutGrid },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className={cardCls + ' p-4'}>
            <s.icon className="text-blue-500 mb-2" size={18} />
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</div>
            <div className="text-xs text-slate-400">{s.label}</div>
          </div>
        ))}
      </div>
      {!settings && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 text-sm">
          No timetable settings found for Academic Year {year}, Term {term}. Set working days under "Periods & Breaks" to get started.
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════ Periods & Breaks ═══════════════════════════ */
const PeriodsTab: React.FC<{ year: number; term: number; periods: Period[]; settings: TTSettings | null; workingDays: Day[]; schoolId?: number }> =
({ year, term, periods, settings, workingDays, schoolId }) => {
  const settingsMutation = useDataMutation('timetable_settings');
  const periodsMutation = useDataMutation('timetable_periods');
  const [days, setDays] = useState<Day[]>(workingDays);
  const [maxPerDay, setMaxPerDay] = useState(settings?.max_lessons_per_day_per_teacher ?? 6);
  const [form, setForm] = useState({ label: '', start_time: '', end_time: '', period_type: 'lesson' as Period['period_type'] });
  const [saving, setSaving] = useState(false);

  const defaults = periods.filter(p => p.day === null).sort((a, b) => a.period_index - b.period_index);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await settingsMutation.mutateAsync({
        operation: 'upsert',
        payload: { school_id: schoolId, academic_year: year, term, working_days: days, max_lessons_per_day_per_teacher: maxPerDay },
        onConflict: 'school_id,academic_year,term',
      });
      toast.success('Timetable settings saved.');
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to save settings.'); }
    finally { setSaving(false); }
  };

  const addPeriod = async () => {
    if (!form.label || !form.start_time || !form.end_time) { toast.error('Fill in label, start and end time.'); return; }
    setSaving(true);
    try {
      const nextIndex = (defaults[defaults.length - 1]?.period_index ?? 0) + 1;
      await periodsMutation.mutateAsync({
        operation: 'insert',
        payload: { school_id: schoolId, academic_year: year, term, day: null, period_index: nextIndex, ...form },
      });
      setForm({ label: '', start_time: '', end_time: '', period_type: 'lesson' });
      toast.success('Period added.');
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to add period.'); }
    finally { setSaving(false); }
  };

  const removePeriod = async (id: number) => {
    try {
      await periodsMutation.mutateAsync({ operation: 'delete', filters: { id } });
      toast.success('Period removed.');
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to remove period.'); }
  };

  return (
    <div className="space-y-5">
      <div className={cardCls + ' p-4 space-y-3'}>
        <div className="font-bold text-sm text-slate-900 dark:text-white">Working Days & Load</div>
        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.slice(0, 5).map(d => (
            <button key={d} onClick={() => setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${days.includes(d) ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}>
              {DAY_LABELS[d]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 max-w-xs">
          <label className="text-xs text-slate-400 whitespace-nowrap">Max lessons/day/teacher</label>
          <input type="number" min={1} value={maxPerDay} onChange={e => setMaxPerDay(Number(e.target.value))} className={inputCls} />
        </div>
        <button onClick={saveSettings} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin" /> : 'Save Settings'}
        </button>
      </div>

      <div className={cardCls}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white">Period Grid (applies to every working day by default)</div>
        <div className="p-4 space-y-2">
          {defaults.map(p => (
            <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{p.label}</span>
              <span className="text-slate-400">{p.start_time.slice(0, 5)} – {p.end_time.slice(0, 5)}</span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500">{p.period_type}</span>
              <button onClick={() => removePeriod(p.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
          {defaults.length === 0 && <p className="text-center text-slate-400 text-sm py-6">No periods configured yet.</p>}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 mt-3">
            <input placeholder="Label e.g. Period 1" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className={inputCls} />
            <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className={inputCls} />
            <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className={inputCls} />
            <select value={form.period_type} onChange={e => setForm(f => ({ ...f, period_type: e.target.value as Period['period_type'] }))} className={inputCls}>
              <option value="lesson">Lesson</option><option value="break">Break</option><option value="lunch">Lunch</option>
              <option value="games">Games</option><option value="assembly">Assembly</option><option value="activity">Activity</option>
            </select>
            <button onClick={addPeriod} disabled={saving} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
              <Plus size={14} /> Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════ Subjects & Teachers (requirements) ═══════════════════════════ */
const RequirementsTab: React.FC<{ reqsRaw: TeacherAssignment[]; grades: Grade[]; subjects: Subject[]; teachers: TeacherRow[] }> =
({ reqsRaw, grades, subjects, teachers }) => {
  const mutation = useDataMutation('teacher_assignments');
  const [saving, setSaving] = useState<number | null>(null);

  const save = async (id: number, lessons_per_week: number, allow_double: boolean) => {
    setSaving(id);
    try {
      await mutation.mutateAsync({ operation: 'update', payload: { lessons_per_week, allow_double }, filters: { id } });
      toast.success('Requirement updated.');
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to update.'); }
    finally { setSaving(null); }
  };

  return (
    <div className={cardCls}>
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white">
        Weekly Lesson Requirements
      </div>
      <p className="px-4 pt-3 text-xs text-slate-400">Set how many lessons per week each teacher-subject-class assignment needs. Manage the assignments themselves from the Teachers page.</p>
      <div className="p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <th className="pb-2">Teacher</th><th className="pb-2">Subject</th><th className="pb-2">Class</th>
              <th className="pb-2">Lessons/Week</th><th className="pb-2">Double Allowed</th><th></th>
            </tr>
          </thead>
          <tbody>
            {reqsRaw.map(r => (
              <RequirementRow key={r.id} r={r} teacherName={teachers.find(t => t.id === r.teacher_id)?.name || '—'}
                subjectName={subjects.find(s => s.id === r.subject_id)?.subject_name || '—'}
                gradeName={grades.find(g => g.id === r.grade_id)?.grade_name || '—'}
                saving={saving === r.id} onSave={(lpw, dbl) => save(r.id, lpw, dbl)} />
            ))}
            {reqsRaw.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-8">No teacher-subject-class assignments yet. Create them on the Teachers page first.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const RequirementRow: React.FC<{ r: TeacherAssignment; teacherName: string; subjectName: string; gradeName: string; saving: boolean; onSave: (lpw: number, dbl: boolean) => void }> =
({ r, teacherName, subjectName, gradeName, saving, onSave }) => {
  const [lpw, setLpw] = useState(r.lessons_per_week ?? 0);
  const [dbl, setDbl] = useState(!!r.allow_double);
  return (
    <tr className="border-b border-slate-50 dark:border-slate-800/60">
      <td className="py-2 font-semibold text-slate-700 dark:text-slate-200">{teacherName}</td>
      <td className="py-2 text-slate-500">{subjectName}</td>
      <td className="py-2 text-slate-500">{gradeName}</td>
      <td className="py-2"><input type="number" min={0} max={20} value={lpw} onChange={e => setLpw(Number(e.target.value))} className="w-16 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-transparent text-sm" /></td>
      <td className="py-2"><input type="checkbox" checked={dbl} onChange={e => setDbl(e.target.checked)} /></td>
      <td className="py-2"><button onClick={() => onSave(lpw, dbl)} disabled={saving} className="text-xs font-bold text-blue-600 disabled:opacity-50">{saving ? '…' : 'Save'}</button></td>
    </tr>
  );
};

/* ═══════════════════════════ Generate ═══════════════════════════ */
const GenerateTab: React.FC<{
  year: number; term: number; requirements: Requirement[]; periods: Period[]; workingDays: Day[];
  gradeName: (id: number) => string; subjectName: (id: number) => string; teacherName: (id: string) => string; existingCount: number; schoolId?: number;
}> = ({ year, term, requirements, periods, workingDays, gradeName, subjectName, teacherName, existingCount, schoolId }) => {
  const entriesMutation = useDataMutation('timetable_entries');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof generateTimetable> | null>(null);

  const runGenerate = async () => {
    if (requirements.length === 0) { toast.error('No lesson requirements configured yet.'); return; }
    if (periods.filter(p => p.period_type === 'lesson').length === 0) { toast.error('No lesson periods configured yet.'); return; }
    setRunning(true);
    setResult(null);
    // Yield to the browser so the spinner actually paints before the
    // (synchronous, potentially CPU-heavy) backtracking search runs.
    await new Promise(r => setTimeout(r, 30));
    const res = generateTimetable(requirements, periods, workingDays);
    setResult(res);
    setRunning(false);

    if (!res.success) {
      toast.error('Unable to generate a conflict-free timetable — see details below.');
      return;
    }

    try {
      // Replace this term's entries wholesale with the freshly generated,
      // internally-consistent set — never a partial merge that could
      // leave stale conflicting rows behind.
      await entriesMutation.mutateAsync({ operation: 'delete', filters: { academic_year: year, term } });
      await entriesMutation.mutateAsync({
        operation: 'insert',
        payload: res.entries.map(e => ({ ...e, school_id: schoolId, academic_year: year, term })),
      });
      toast.success(`Generated ${res.entries.length} lesson entries.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Generated successfully but failed to save.');
    }
  };

  return (
    <div className="space-y-5">
      <div className={cardCls + ' p-5'}>
        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-1"><Wand2 size={16} /> Automatic Timetable Generator</div>
        <p className="text-xs text-slate-400 mb-4">
          Academic Year {year}, Term {term} · {requirements.reduce((s, r) => s + r.lessons_per_week, 0)} lessons required across {requirements.length} assignments · {existingCount} currently scheduled.
        </p>
        <p className="text-xs text-slate-400 mb-4">
          Generating replaces every existing entry for this term with a freshly computed, collision-free schedule. If a fully conflict-free timetable cannot be found, nothing is saved and the specific blockers are listed below.
        </p>
        <button onClick={runGenerate} disabled={running} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50">
          {running ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} {running ? 'Generating…' : 'Generate Timetable'}
        </button>
      </div>

      {result && !result.success && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
          <div className="font-bold text-red-700 dark:text-red-300 text-sm mb-2">Unable to generate a conflict-free timetable.</div>
          <ul className="space-y-1 text-xs text-red-600 dark:text-red-400">
            {result.unplaced.map((u, i) => (
              <li key={i}>• {gradeName(u.requirement.grade_id)} — {subjectName(u.requirement.subject_id)} ({teacherName(u.requirement.teacher_id)}): {u.reason}</li>
            ))}
          </ul>
        </div>
      )}
      {result && result.success && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-sm font-bold">
          <CheckCircle2 size={16} /> Timetable generated and saved — {result.entries.length} entries, zero collisions.
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════ Grid rendering (shared) ═══════════════════════════ */
const TimetableGrid: React.FC<{
  entries: (Entry & { id?: number })[]; periods: Period[]; workingDays: Day[]; gradeFilter?: number; teacherFilter?: string;
  subjectCode: (id: number) => string; teacherInitials?: (id: string) => string; gradeShort?: (id: number) => string;
  editable?: boolean; onCellClick?: (day: Day, period: Period, entry?: Entry & { id?: number }) => void; selected?: { day: Day; periodId: number } | null;
}> = ({ entries, periods, workingDays, gradeFilter, teacherFilter, subjectCode, teacherInitials, gradeShort, editable, onCellClick, selected }) => {
  const templatePeriods = periodsForDay(periods, workingDays[0] || 'MON').filter(p => p.period_type === 'lesson' || true).sort((a, b) => a.period_index - b.period_index);
  const filtered = entries.filter(e => (gradeFilter === undefined || e.grade_id === gradeFilter) && (teacherFilter === undefined || e.teacher_id === teacherFilter));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="p-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500">Day</th>
            {templatePeriods.map(p => (
              <th key={p.id} className="p-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold whitespace-nowrap">
                {p.label}<div className="font-normal text-[10px] text-slate-400">{p.start_time.slice(0, 5)}-{p.end_time.slice(0, 5)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {workingDays.map(day => {
            const dayPeriods = periodsForDay(periods, day).sort((a, b) => a.period_index - b.period_index);
            return (
              <tr key={day}>
                <td className="p-2 border border-slate-200 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 whitespace-nowrap">{DAY_LABELS[day]}</td>
                {templatePeriods.map(tp => {
                  const p = dayPeriods.find(dp => dp.period_index === tp.period_index) || tp;
                  if (p.period_type !== 'lesson') {
                    return <td key={tp.id} className="p-2 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-center text-slate-400 uppercase text-[10px] font-bold">{p.period_type}</td>;
                  }
                  const e = filtered.find(x => x.day === day && x.period_id === p.id);
                  const isSelected = selected && selected.day === day && selected.periodId === p.id;
                  return (
                    <td key={tp.id}
                      onClick={() => editable && onCellClick?.(day, p, e)}
                      className={`p-2 border border-slate-200 dark:border-slate-700 text-center align-middle ${editable ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30' : ''} ${isSelected ? 'ring-2 ring-inset ring-blue-500 bg-blue-50 dark:bg-blue-950/30' : ''}`}>
                      {e ? (
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-100">{subjectCode(e.subject_id)}</div>
                          <div className="text-[10px] text-slate-400">{teacherInitials ? teacherInitials(e.teacher_id) : ''}{gradeShort ? ` · ${gradeShort(e.grade_id)}` : ''}</div>
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* ═══════════════════════════ Master Timetable (with manual editor) ═══════════════════════════ */
const GridTab: React.FC<{
  title: string; scope: 'all'; grades: Grade[]; entries: (Entry & { id: number })[]; periods: Period[]; workingDays: Day[];
  subjectCode: (id: number) => string; teacherInitials: (id: string) => string;
  gradeName: (id: number) => string; subjectName: (id: number) => string; teacherName: (id: string) => string;
  onExport: () => void; year: number; term: number;
}> = ({ title, grades, entries, periods, workingDays, subjectCode, teacherInitials, gradeName, subjectName, teacherName, onExport, year, term }) => {
  const entriesMutation = useDataMutation('timetable_entries');
  const [gradeFilter, setGradeFilter] = useState<number | ''>('');
  const [selected, setSelected] = useState<(Entry & { id: number }) | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const gradeShort = (id: number) => gradeName(id).replace(/[^A-Za-z0-9]/g, '').slice(0, 6);

  const handleCellClick = async (day: Day, period: Period, entry?: Entry & { id?: number }) => {
    setConflict(null);
    if (!selected) {
      if (entry) setSelected(entry as Entry & { id: number });
      return;
    }
    // Attempt to move the selected lesson to this day/period.
    const candidate: Entry = { ...selected, day, period_id: period.id };
    const ctx = { entries, periods, gradeName, teacherName, subjectName };
    const reason = checkCollision(candidate, ctx, selected.id);
    if (reason) { setConflict(reason.message); return; }
    try {
      await entriesMutation.mutateAsync({ operation: 'update', payload: { day, period_id: period.id }, filters: { id: selected.id } });
      toast.success('Lesson moved.');
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to move lesson.'); }
    setSelected(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value ? Number(e.target.value) : '')} className={inputCls + ' w-48'}>
            <option value="">All classes</option>
            {grades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
          </select>
          {selected && (
            <span className="text-xs text-blue-600 font-semibold flex items-center gap-1">
              Moving {subjectCode(selected.subject_id)} — click a destination cell
              <button onClick={() => setSelected(null)}><X size={12} /></button>
            </span>
          )}
        </div>
        <button onClick={onExport} className="px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5"><Download size={13} /> Download PDF</button>
      </div>
      {conflict && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle size={14} /> Scheduling Conflict — {conflict}
        </div>
      )}
      <div className={cardCls + ' p-2'}>
        <TimetableGrid entries={entries} periods={periods} workingDays={workingDays} gradeFilter={gradeFilter || undefined}
          subjectCode={subjectCode} teacherInitials={teacherInitials} gradeShort={gradeFilter ? undefined : gradeShort}
          editable onCellClick={handleCellClick} selected={selected ? { day: selected.day, periodId: selected.period_id } : null} />
      </div>
    </div>
  );
};

/* ═══════════════════════════ Class Timetables ═══════════════════════════ */
const ClassTimetablesTab: React.FC<{
  grades: Grade[]; entries: Entry[]; periods: Period[]; workingDays: Day[];
  subjectCode: (id: number) => string; teacherInitials: (id: string) => string;
  gradeName: (id: number) => string; subjectName: (id: number) => string; teacherName: (id: string) => string;
  year: number; term: number; schoolName: string;
}> = ({ grades, entries, periods, workingDays, subjectCode, teacherInitials, year, term, schoolName }) => {
  const [gradeId, setGradeId] = useState<number | ''>(grades[0]?.id ?? '');
  const grade = grades.find(g => g.id === gradeId);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <select value={gradeId} onChange={e => setGradeId(Number(e.target.value))} className={inputCls + ' w-56'}>
          {grades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
        </select>
        <button disabled={!grade} onClick={() => grade && exportClassTimetablePdf(grade.grade_name, entries, { schoolName, academicYear: year, term, workingDays, allPeriods: periods }, subjectCode, teacherInitials)}
          className="px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><Download size={13} /> Download PDF</button>
      </div>
      <div className={cardCls + ' p-2'}>
        <TimetableGrid entries={entries} periods={periods} workingDays={workingDays} gradeFilter={gradeId || undefined} subjectCode={subjectCode} teacherInitials={teacherInitials} />
      </div>
    </div>
  );
};

/* ═══════════════════════════ Teacher Timetables ═══════════════════════════ */
const TeacherTimetablesTab: React.FC<{
  teachers: TeacherRow[]; entries: Entry[]; periods: Period[]; workingDays: Day[];
  subjectCode: (id: number) => string; gradeName: (id: number) => string; subjectName: (id: number) => string; teacherName: (id: string) => string;
  year: number; term: number; schoolName: string;
}> = ({ teachers, entries, periods, workingDays, subjectCode, gradeName, year, term, schoolName }) => {
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? '');
  const teacher = teachers.find(t => t.id === teacherId);
  const gradeShort = (id: number) => gradeName(id).replace(/[^A-Za-z0-9]/g, '').slice(0, 6);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className={inputCls + ' w-56'}>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button disabled={!teacher} onClick={() => teacher && exportTeacherTimetablePdf(teacher.name, entries, { schoolName, academicYear: year, term, workingDays, allPeriods: periods }, subjectCode, gradeShort)}
          className="px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><Download size={13} /> Download PDF</button>
      </div>
      <div className={cardCls + ' p-2'}>
        <TimetableGrid entries={entries} periods={periods} workingDays={workingDays} teacherFilter={teacherId || undefined} subjectCode={subjectCode} gradeShort={gradeShort} />
      </div>
    </div>
  );
};

/* ═══════════════════════════ Validation ═══════════════════════════ */
const ValidationTab: React.FC<{ entries: Entry[]; requirements: Requirement[]; gradeName: (id: number) => string; teacherName: (id: string) => string; subjectName: (id: number) => string }> =
({ entries, requirements, gradeName, teacherName, subjectName }) => {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const run = () => setReport(validateTimetable(entries, requirements, gradeName, teacherName, subjectName));

  const rows: { label: string; items: string[] }[] = report ? [
    { label: 'Class collisions', items: report.classCollisions },
    { label: 'Teacher collisions', items: report.teacherCollisions },
    { label: 'Room collisions', items: report.roomCollisions },
    { label: 'Duplicate lessons', items: report.duplicates },
    { label: 'Missing lessons', items: report.missingLessons },
    { label: 'Unassigned requirements', items: report.unassignedRequirements },
  ] : [];

  return (
    <div className="space-y-4">
      <button onClick={run} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-bold flex items-center gap-2"><ShieldCheck size={16} /> Validate Timetable</button>
      {report && (
        <div className={cardCls + ' p-5 space-y-3'}>
          <div className={`font-bold text-sm flex items-center gap-2 ${report.isValid ? 'text-emerald-600' : 'text-red-600'}`}>
            {report.isValid ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            STATUS: {report.isValid ? 'TIMETABLE VALID' : 'ISSUES FOUND'}
          </div>
          {rows.map(r => (
            <div key={r.label}>
              <div className={`text-xs font-bold ${r.items.length ? 'text-red-600' : 'text-emerald-600'}`}>
                {r.items.length ? '✗' : '✓'} {r.label} {r.items.length ? `(${r.items.length})` : '— none'}
              </div>
              {r.items.length > 0 && (
                <ul className="mt-1 ml-4 text-xs text-slate-500 list-disc space-y-0.5">
                  {r.items.map((it, i) => <li key={i}>{it}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════ Teacher's own read-only view ═══════════════════════════ */
const MyTimetableView: React.FC<{
  user: any; entries: Entry[]; periods: Period[]; workingDays: Day[];
  gradeName: (id: number) => string; subjectCode: (id: number) => string; teacherName: (id: string) => string;
  schoolName: string; year: number; term: number; setYear: (y: number) => void; setTerm: (t: number) => void;
}> = ({ user, entries, periods, workingDays, gradeName, subjectCode, schoolName, year, term, setYear, setTerm }) => {
  const gradeShort = (id: number) => gradeName(id).replace(/[^A-Za-z0-9]/g, '').slice(0, 6);
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">My Timetable</h1>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))} className={inputCls + ' w-28'}>
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={term} onChange={e => setTerm(Number(e.target.value))} className={inputCls + ' w-32'}>
            <option value={1}>Term 1</option><option value={2}>Term 2</option><option value={3}>Term 3</option>
          </select>
          <button onClick={() => exportTeacherTimetablePdf(user?.name || 'Teacher', entries, { schoolName, academicYear: year, term, workingDays, allPeriods: periods }, subjectCode, gradeShort)}
            className="px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5"><Download size={13} /> Download PDF</button>
        </div>
      </div>
      <div className={cardCls + ' p-2'}>
        <TimetableGrid entries={entries} periods={periods} workingDays={workingDays} teacherFilter={user?.id} subjectCode={subjectCode} gradeShort={gradeShort} />
      </div>
    </div>
  );
};

export default Timetable;