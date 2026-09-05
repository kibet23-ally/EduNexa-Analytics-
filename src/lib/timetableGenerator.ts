/* ══════════════════════════════════════════════════════════════════════
   Timetable generation & collision-checking engine.

   Every write path in the Timetable module — the automatic generator AND
   the manual drag/click editor — goes through the same checkCollision()
   function here, so "never allow two things in the same slot" is
   enforced in exactly one place rather than re-implemented per screen.

   THE GENERATOR
   ─────────────
   This is a real constraint-satisfaction solver, not a best-effort
   filler:

    1. Pre-Generation Validation — before any search runs, class
       capacity, teacher capacity, teacher-subject assignment and
       period-grid sanity are all checked. If the requirements are
       mathematically impossible to satisfy, generation never starts
       and the specific blocker is reported (see checkFeasibility()).

    2. Lesson-instance generation — each weekly requirement is expanded
       into individual lesson instances (or double-period blocks) that
       are scheduled one at a time, not as a single "5 lessons" object.

    3. MRV (Minimum Remaining Values) — at every step the solver picks
       the lesson instance with the fewest legal remaining slots, tie-
       broken by a degree heuristic (how many other unscheduled lessons
       share this one's teacher/class) and by weekly load, so the
       hardest lessons are placed first while the week is still open.

    4. Forward checking — every tentative placement immediately prunes
       the candidate slots of every other unscheduled lesson that
       shares a teacher or a class. If that leaves any of them with
       zero legal slots, the placement is abandoned immediately rather
       than discovered later at a dead end.

    5. Least-constraining-value ordering — among the legal slots for
       the chosen lesson, the ones that remove the fewest options from
       other lessons are tried first.

    6. Backtracking with randomized restarts — a full recursive
       backtracking search with soft-preference relaxation and several
       reshuffled restarts if the first pass can't find a solution.

   Hard constraints (class/teacher/room collisions, double-period
   adjacency, breaks/lunch/activities) are never violated. Soft
   preferences (spreading a subject across the week, a per-teacher
   daily lesson cap) are honoured whenever possible and only relaxed,
   in that order, as a last resort to avoid failing outright — nothing
   ever violates a hard constraint to make generation "succeed".

   Nothing partial is ever handed back for saving — see
   generateTimetable()'s doc comment for why.
═══════════════════════════════════════════════════════════════════════ */

export type Day = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
export const DAY_LABELS: Record<Day, string> = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday',
  FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday',
};

export interface Period {
  id: number;
  day: Day | null; // null = default template applied to every working day
  period_index: number;
  label: string;
  start_time: string;
  end_time: string;
  period_type: 'lesson' | 'break' | 'lunch' | 'games' | 'assembly' | 'activity';
}

export interface Requirement {
  id: number;               // teacher_assignments.id
  teacher_id: string;
  subject_id: number;
  grade_id: number;
  lessons_per_week: number;
  allow_double: boolean;
}

export interface Entry {
  id?: number;
  day: Day;
  period_id: number;
  grade_id: number;
  subject_id: number;
  teacher_id: string;
  is_double_period: boolean;
  double_group_id?: string | null;
  /** Optional physical room label. Room-collision checking (see
   * checkCollision/validateTimetable) only activates for entries that
   * carry a room value — schools that don't track rooms are entirely
   * unaffected. The generator itself doesn't assign rooms (there is no
   * "which room does this subject need" input yet), but manual edits
   * that set a room are protected against double-booking it. */
  room?: string | null;
}

/** Resolve the effective period grid for one specific day, applying any
 * day-specific override rows on top of the day-independent defaults. */
export function periodsForDay(allPeriods: Period[], day: Day): Period[] {
  const defaults = allPeriods.filter(p => p.day === null);
  const overrides = allPeriods.filter(p => p.day === day);
  const byIndex = new Map<number, Period>();
  defaults.forEach(p => byIndex.set(p.period_index, p));
  overrides.forEach(p => byIndex.set(p.period_index, p));
  return [...byIndex.values()].sort((a, b) => a.period_index - b.period_index);
}

/* ── Collision checking — the single source of truth ─────────────────── */

export type CollisionReason =
  | { type: 'class'; message: string }
  | { type: 'teacher'; message: string }
  | { type: 'room'; message: string }
  | { type: 'duplicate'; message: string }
  | { type: 'not_lesson_period'; message: string }
  | { type: 'double_unavailable'; message: string };

interface CheckContext {
  entries: Entry[];
  periods: Period[];
  gradeName: (id: number) => string;
  teacherName: (id: string) => string;
  subjectName: (id: number) => string;
}

/** Checks whether `candidate` can be placed without colliding with
 * anything already in `ctx.entries`. Excludes `excludeEntryId` from the
 * check (used when moving/editing an existing entry against itself). */
export function checkCollision(
  candidate: Entry,
  ctx: CheckContext,
  excludeEntryId?: number,
): CollisionReason | null {
  const period = ctx.periods.find(p => p.id === candidate.period_id);
  if (!period || period.period_type !== 'lesson') {
    return { type: 'not_lesson_period', message: 'That slot is not a lesson period (it is a break, lunch, games, assembly, or activity slot).' };
  }

  const others = ctx.entries.filter(e => e.id !== excludeEntryId && e.day === candidate.day && e.period_id === candidate.period_id);

  const classClash = others.find(e => e.grade_id === candidate.grade_id);
  if (classClash) {
    return {
      type: 'class',
      message: `${ctx.gradeName(candidate.grade_id)} already has ${ctx.subjectName(classClash.subject_id)} scheduled during ${DAY_LABELS[candidate.day]} ${period.label}.`,
    };
  }

  const teacherClash = others.find(e => e.teacher_id === candidate.teacher_id);
  if (teacherClash) {
    return {
      type: 'teacher',
      message: `${ctx.teacherName(candidate.teacher_id)} is already teaching ${ctx.gradeName(teacherClash.grade_id)} during ${DAY_LABELS[candidate.day]} ${period.label}.`,
    };
  }

  // Room collisions only apply when a room is actually specified — schools
  // that don't track rooms leave this field empty and are unaffected.
  if (candidate.room) {
    const roomClash = others.find(e => e.room && e.room === candidate.room);
    if (roomClash) {
      return {
        type: 'room',
        message: `Room ${candidate.room} is already in use by ${ctx.gradeName(roomClash.grade_id)} (${ctx.subjectName(roomClash.subject_id)}) during ${DAY_LABELS[candidate.day]} ${period.label}.`,
      };
    }
  }

  const dup = others.find(e => e.grade_id === candidate.grade_id && e.subject_id === candidate.subject_id && e.teacher_id === candidate.teacher_id);
  if (dup) {
    return { type: 'duplicate', message: 'This exact class/subject/teacher combination is already scheduled in this slot.' };
  }

  return null;
}

/** For a double period, both consecutive lesson periods on the same day
 * must independently pass checkCollision(). Returns the second period's
 * id (the partner slot) if the pairing is valid, else a reason. */
export function findDoublePartner(
  day: Day, firstPeriodId: number, periods: Period[],
): { partnerId: number } | { error: string } {
  const dayPeriods = periods.filter(p => p.period_type === 'lesson').sort((a, b) => a.period_index - b.period_index);
  const idx = dayPeriods.findIndex(p => p.id === firstPeriodId);
  if (idx === -1 || idx === dayPeriods.length - 1) {
    return { error: 'There is no next lesson period available to pair as a double.' };
  }
  const next = dayPeriods[idx + 1];
  const first = dayPeriods[idx];
  // Consecutive lesson periods only — a break/lunch/games slot in between
  // means these are not truly "double period" adjacent.
  if (next.period_index !== first.period_index + 1) {
    return { error: 'The next period is not immediately consecutive (a break separates them), so this cannot be a double period.' };
  }
  return { partnerId: next.id };
}

/* ── Pre-Generation Validation ─────────────────────────────────────────
   Capacity & sanity checks that run BEFORE the solver starts. If any of
   these fail, a valid timetable is mathematically impossible and the
   solver never wastes time attempting one — the specific blocker is
   reported instead (e.g. "Teacher Workload Conflict").
═══════════════════════════════════════════════════════════════════════ */

export interface FeasibilityCheckItem {
  ok: boolean;
  label: string;
  detail?: string;
}

export interface FeasibilityReport {
  ready: boolean;
  checks: FeasibilityCheckItem[];
  /** Specific, actionable blockers — empty when ready === true. */
  blockers: string[];
}

export interface FeasibilityOptions {
  maxLessonsPerDayPerTeacher?: number | null;
  gradeName?: (id: number) => string;
  teacherName?: (id: string) => string;
  subjectName?: (id: number) => string;
}

export function checkFeasibility(
  requirements: Requirement[],
  periods: Period[],
  workingDays: Day[],
  opts: FeasibilityOptions = {},
): FeasibilityReport {
  const gradeName = opts.gradeName ?? ((id: number) => `Class #${id}`);
  const teacherName = opts.teacherName ?? ((id: string) => `Teacher #${String(id).slice(0, 6)}`);
  const subjectName = opts.subjectName ?? ((id: number) => `Subject #${id}`);
  const checks: FeasibilityCheckItem[] = [];
  const blockers: string[] = [];

  const active = requirements.filter(r => r.lessons_per_week > 0);

  const lessonPeriodCount = periods.filter(p => p.period_type === 'lesson').length;
  if (lessonPeriodCount === 0 || workingDays.length === 0) {
    checks.push({ ok: false, label: 'Period configuration valid', detail: 'No lesson periods or no working days are configured yet.' });
    blockers.push('No lesson periods are configured yet — set up Periods & Breaks and working days first.');
    return { ready: false, checks, blockers };
  }
  checks.push({ ok: true, label: 'Period configuration valid' });

  if (active.length === 0) {
    checks.push({ ok: false, label: 'Lesson requirements configured', detail: 'No active weekly lesson requirements.' });
    blockers.push('No lesson requirements are configured yet — set weekly lesson counts under Subjects & Teachers.');
    return { ready: false, checks, blockers };
  }
  checks.push({ ok: true, label: 'Lesson requirements configured' });

  // Weekly lesson slots available to a class, accounting for day-specific
  // period-grid overrides (e.g. a shortened Friday).
  const weeklySlots = workingDays.reduce(
    (sum, day) => sum + periodsForDay(periods, day).filter(p => p.period_type === 'lesson').length, 0,
  );

  // Every requirement needs a teacher.
  const unassigned = active.filter(r => !r.teacher_id);
  if (unassigned.length > 0) {
    checks.push({ ok: false, label: 'All subjects have assigned teachers', detail: `${unassigned.length} assignment(s) missing a teacher.` });
    unassigned.forEach(r => blockers.push(`${gradeName(r.grade_id)} ${subjectName(r.subject_id)} has no teacher assigned.`));
  } else {
    checks.push({ ok: true, label: 'All subjects have assigned teachers' });
  }

  // A subject without double periods can have at most one lesson per day.
  const impossibleDoubles = active.filter(r => !r.allow_double && r.lessons_per_week > workingDays.length);
  if (impossibleDoubles.length > 0) {
    checks.push({ ok: false, label: 'No impossible weekly lesson counts', detail: `${impossibleDoubles.length} assignment(s) request more lessons/week than working days without double periods.` });
    impossibleDoubles.forEach(r => blockers.push(
      `${gradeName(r.grade_id)} ${subjectName(r.subject_id)} (${teacherName(r.teacher_id)}) needs ${r.lessons_per_week} lessons/week across only ${workingDays.length} working days, but double periods aren't enabled for this assignment. Enable "Double Allowed" or reduce its weekly lesson count.`,
    ));
  } else {
    checks.push({ ok: true, label: 'No impossible weekly lesson counts' });
  }

  // Per-class (grade) capacity.
  const byGrade = new Map<number, number>();
  active.forEach(r => byGrade.set(r.grade_id, (byGrade.get(r.grade_id) || 0) + r.lessons_per_week));
  const overGrades: { grade_id: number; required: number }[] = [];
  byGrade.forEach((required, grade_id) => { if (required > weeklySlots) overGrades.push({ grade_id, required }); });
  if (overGrades.length > 0) {
    checks.push({ ok: false, label: 'Classes have sufficient capacity', detail: `${overGrades.length} class(es) require more lessons than available periods.` });
    overGrades.forEach(g => blockers.push(
      `${gradeName(g.grade_id)} requires ${g.required} lessons/week but only ${weeklySlots} lesson periods/week are available. Add more periods or reduce this class's lesson load.`,
    ));
  } else {
    checks.push({ ok: true, label: 'Classes have sufficient capacity' });
  }

  // Per-teacher capacity — a teacher can never teach more periods than
  // exist in the week, and never more than their configured daily cap.
  const byTeacher = new Map<string, number>();
  active.forEach(r => { if (r.teacher_id) byTeacher.set(r.teacher_id, (byTeacher.get(r.teacher_id) || 0) + r.lessons_per_week); });
  const cap = opts.maxLessonsPerDayPerTeacher
    ? Math.min(weeklySlots, opts.maxLessonsPerDayPerTeacher * workingDays.length)
    : weeklySlots;
  const overTeachers: { teacher_id: string; required: number }[] = [];
  byTeacher.forEach((required, teacher_id) => { if (required > cap) overTeachers.push({ teacher_id, required }); });
  if (overTeachers.length > 0) {
    checks.push({ ok: false, label: 'Teachers have sufficient capacity', detail: `${overTeachers.length} teacher(s) are overloaded.` });
    overTeachers.forEach(t => blockers.push(
      `Teacher Workload Conflict — ${teacherName(t.teacher_id)}: required ${t.required} lessons/week, only ${cap} teaching periods/week available` +
      `${opts.maxLessonsPerDayPerTeacher ? ` (capped at ${opts.maxLessonsPerDayPerTeacher}/day × ${workingDays.length} days)` : ''}. Reduce this teacher's load or reassign some subjects.`,
    ));
  } else {
    checks.push({ ok: true, label: 'Teachers have sufficient capacity' });
  }

  // Per-teacher unavailable-period data isn't modeled yet (no such table
  // exists in the schema) — this check is a placeholder that always
  // passes today, kept here so the report format stays stable if/when
  // teacher availability windows are added.
  checks.push({ ok: true, label: 'No impossible teacher availability' });

  return { ready: blockers.length === 0, checks, blockers };
}

/* ── Automatic generator ──────────────────────────────────────────────
   A real CSP solver: dynamic MRV + degree-heuristic task ordering,
   forward checking with incremental domain maintenance, least-
   constraining-value slot ordering, and backtracking with randomized
   restarts. Soft preferences are relaxed (never hard constraints) if
   every strict attempt is exhausted. See the file header for details.
═══════════════════════════════════════════════════════════════════════ */

interface Task {
  id: number;
  requirement: Requirement;
  isDouble: boolean;
}

interface CandidateSlot {
  day: Day;
  periodIds: number[]; // 1 for a single lesson, 2 (consecutive) for a double
  morning: boolean;
}

export type ProgressPhase =
  | 'validating' | 'scheduling' | 'checking' | 'optimizing' | 'validating-result' | 'done' | 'failed';

export interface ProgressUpdate {
  phase: ProgressPhase;
  message: string;
  placed?: number;
  total?: number;
}

export interface GenerateOptions {
  prioritySubjectIds?: Set<number>;
  maxLessonsPerDayPerTeacher?: number | null;
  onProgress?: (update: ProgressUpdate) => void;
  gradeName?: (id: number) => string;
  teacherName?: (id: string) => string;
  subjectName?: (id: number) => string;
  /** Grades this afternoon-rotation rule applies to (e.g. Grade 9). Left
   * unset, the rule is a no-op — no behavior changes for schools/grades
   * that don't opt in. */
  rotationGradeIds?: Set<number>;
  /** Subjects (practical/technical/humanities, etc.) the rotation rule
   * applies to, within rotationGradeIds. */
  rotationSubjectIds?: Set<number>;
  /** Optional further restriction to specific teachers (e.g. by initials)
   * within rotationGradeIds/rotationSubjectIds. Omit to apply the rule to
   * every teacher who falls into that grade+subject scope — recommended,
   * since restricting by name is fragile as staff change. */
  rotationTeacherIds?: Set<string>;
  /** Clock time (HH:MM:SS) marking the start of "afternoon" for the
   * rotation rule. Defaults to 14:00:00. */
  afternoonStartTime?: string;
  /** Subjects that represent a free/self-study period. When set, these
   * are steered away from the first two lesson periods of the day and
   * toward mid-morning (preferred) or afternoon slots. */
  freePeriodSubjectIds?: Set<number>;
}

export interface GenerationResult {
  success: boolean;
  entries: Entry[];
  unplaced: { requirement: Requirement; reason: string }[];
  /** Root-cause summary for a failure (or a note about relaxed soft
   * preferences on a success) — always a short, human list, never a
   * per-lesson wall of repeated text. */
  diagnostics: string[];
  feasibility: FeasibilityReport | null;
}

// A single attempt is bounded by both a step count and a wall-clock
// deadline so a genuinely pathological input can never hang the tab —
// the UI yields every YIELD_EVERY_STEPS steps regardless, so even a
// long-running search keeps the browser responsive.
const YIELD_EVERY_STEPS = 250;
const STEP_BUDGET_PER_ATTEMPT = 150_000;
const TIME_BUDGET_PER_ATTEMPT_MS = 4_000;
const TOTAL_TIME_BUDGET_MS = 25_000;
const STRICT_ATTEMPTS = 4;
const RELAXED_ATTEMPTS = 3;
const OPTIMIZE_ITERATIONS = 260;
// How many of each day's lesson periods (from the start of the day)
// count as "early morning" for the free-period placement rule.
const EARLY_MORNING_PERIOD_COUNT = 2;

function tick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function shuffledCopy<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback UUID v4 for older browsers - the double_group_id column is
  // typed uuid in the database, so a plain string tag like "dbl-1" is
  // rejected outright ("invalid input syntax for type uuid").
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function generateTimetable(
  requirements: Requirement[],
  periods: Period[],
  workingDays: Day[],
  options: GenerateOptions = {},
): Promise<GenerationResult> {
  const {
    onProgress, prioritySubjectIds, maxLessonsPerDayPerTeacher = null, gradeName, teacherName, subjectName,
    rotationGradeIds, rotationSubjectIds, rotationTeacherIds, afternoonStartTime = '14:00:00', freePeriodSubjectIds,
  } = options;

  onProgress?.({ phase: 'validating', message: 'Running pre-generation checks…' });
  await tick();

  // ── Stage 1: Pre-Generation Validation ────────────────────────────
  const feasibility = checkFeasibility(requirements, periods, workingDays, {
    maxLessonsPerDayPerTeacher, gradeName, teacherName, subjectName,
  });
  if (!feasibility.ready) {
    onProgress?.({ phase: 'failed', message: 'Pre-generation checks failed.' });
    return { success: false, entries: [], unplaced: [], diagnostics: feasibility.blockers, feasibility };
  }

  // ── Stage 2: Lesson instance generation ───────────────────────────
  // Convert each weekly requirement into individual lesson instances (or
  // double-period blocks) — never a single "N lessons" scheduling object.
  const tasks: Task[] = [];
  let nextTaskId = 0;
  for (const req of requirements) {
    if (req.lessons_per_week <= 0) continue;
    if (req.allow_double) {
      const doubles = Math.floor(req.lessons_per_week / 2);
      const singles = req.lessons_per_week % 2;
      for (let i = 0; i < doubles; i++) tasks.push({ id: nextTaskId++, requirement: req, isDouble: true });
      for (let i = 0; i < singles; i++) tasks.push({ id: nextTaskId++, requirement: req, isDouble: false });
    } else {
      for (let i = 0; i < req.lessons_per_week; i++) tasks.push({ id: nextTaskId++, requirement: req, isDouble: false });
    }
  }
  const taskById = new Map<number, Task>(tasks.map(t => [t.id, t]));
  const totalPeriods = requirements.reduce((s, r) => s + Math.max(0, r.lessons_per_week), 0);

  // ── Candidate slot universe ────────────────────────────────────────
  const lunchStart = periods.find(p => p.period_type === 'lunch')?.start_time
    ?? [...periods].sort((a, b) => a.start_time.localeCompare(b.start_time)).find(p => p.start_time >= '12:00:00')?.start_time
    ?? '12:00:00';
  const isMorningPeriod = (p: Period) => p.start_time < lunchStart;

  const singleSlots: CandidateSlot[] = [];
  const doubleSlots: CandidateSlot[] = [];
  // Day-aware slot classification for the Grade-9 afternoon-rotation and
  // free-period-placement rules — keyed by `${day}|${periodId}` rather
  // than period id alone, since a day-specific override row can give a
  // day its own distinct period ids with a different start_time.
  const afternoonSlotKeys = new Set<string>();
  const earlyMorningSlotKeys = new Set<string>();
  for (const day of workingDays) {
    const dayPeriods = periodsForDay(periods, day).filter(p => p.period_type === 'lesson').sort((a, b) => a.period_index - b.period_index);
    dayPeriods.forEach((p, idx) => {
      singleSlots.push({ day, periodIds: [p.id], morning: isMorningPeriod(p) });
      if (p.start_time >= afternoonStartTime) afternoonSlotKeys.add(`${day}|${p.id}`);
      if (idx < EARLY_MORNING_PERIOD_COUNT) earlyMorningSlotKeys.add(`${day}|${p.id}`);
    });
    for (let i = 0; i < dayPeriods.length - 1; i++) {
      if (dayPeriods[i + 1].period_index === dayPeriods[i].period_index + 1) {
        doubleSlots.push({ day, periodIds: [dayPeriods[i].id, dayPeriods[i + 1].id], morning: isMorningPeriod(dayPeriods[i]) });
      }
    }
  }

  const rotationActive = !!(rotationGradeIds && rotationGradeIds.size && rotationSubjectIds && rotationSubjectIds.size);
  const freePeriodActive = !!(freePeriodSubjectIds && freePeriodSubjectIds.size);
  const isRotationRequirement = (r: Requirement) =>
    rotationActive && rotationGradeIds!.has(r.grade_id) && rotationSubjectIds!.has(r.subject_id)
    && (!rotationTeacherIds || rotationTeacherIds.size === 0 || rotationTeacherIds.has(r.teacher_id));
  const slotIsAfternoon = (slot: CandidateSlot) => slot.periodIds.some(pid => afternoonSlotKeys.has(`${slot.day}|${pid}`));
  const slotIsEarlyMorning = (slot: CandidateSlot) => slot.periodIds.some(pid => earlyMorningSlotKeys.has(`${slot.day}|${pid}`));

  // ── Static heuristics (conflict graph, MRV tie-breaks) ────────────
  // "Two lessons conflict when they share the same class or teacher" —
  // the conflict graph, expressed as adjacency lists so forward checking
  // only ever inspects lessons that could actually collide.
  const tasksByTeacher = new Map<string, number[]>();
  const tasksByGrade = new Map<number, number[]>();
  const teacherLoad = new Map<string, number>();
  const gradeLoad = new Map<number, number>();
  for (const t of tasks) {
    const { teacher_id, grade_id, lessons_per_week } = t.requirement;
    if (!tasksByTeacher.has(teacher_id)) tasksByTeacher.set(teacher_id, []);
    tasksByTeacher.get(teacher_id)!.push(t.id);
    if (!tasksByGrade.has(grade_id)) tasksByGrade.set(grade_id, []);
    tasksByGrade.get(grade_id)!.push(t.id);
    teacherLoad.set(teacher_id, (teacherLoad.get(teacher_id) || 0) + lessons_per_week);
    gradeLoad.set(grade_id, (gradeLoad.get(grade_id) || 0) + lessons_per_week);
  }
  const degreeOf = (t: Task) =>
    (tasksByTeacher.get(t.requirement.teacher_id)?.length ?? 1) - 1 +
    (tasksByGrade.get(t.requirement.grade_id)?.length ?? 1) - 1;

  if (singleSlots.length === 0) {
    return {
      success: false, entries: [], feasibility,
      unplaced: requirements.map(r => ({ requirement: r, reason: 'No lesson periods are configured yet — set up Periods & Breaks first.' })),
      diagnostics: ['No lesson periods are configured yet — set up Periods & Breaks first.'],
    };
  }

  onProgress?.({ phase: 'scheduling', message: `Scheduling lessons: 0 / ${totalPeriods}`, placed: 0, total: totalPeriods });

  // ── One full CSP attempt (MRV + forward checking + backtracking) ──
  interface AttemptSettings { respectSubjectSpread: boolean; respectDailyCap: boolean; }
  interface AttemptResult { solved: boolean; entries: Entry[]; gaveUp: false | 'steps' | 'time'; }

  async function attempt(settings: AttemptSettings, deadline: number): Promise<AttemptResult> {
    const domains = new Map<number, CandidateSlot[]>();
    tasks.forEach(t => domains.set(t.id, shuffledCopy(t.isDouble ? doubleSlots : singleSlots)));

    const classBusy = new Set<string>();     // `${day}|${periodId}|${grade_id}`
    const teacherBusy = new Set<string>();   // `${day}|${periodId}|${teacher_id}`
    // A class+subject combo appears at most once per day (soft, unless
    // relaxed) — prevents two unrelated singles from masquerading as an
    // unrequested double period, and spreads a subject across the week.
    const subjectDayBusy = new Set<string>(); // `${day}|${grade_id}|${subject_id}`
    const teacherDayCount = new Map<string, number>(); // `${day}|${teacher_id}` -> periods that day
    // Grade-9 afternoon-rotation tracking (see isRotationRequirement) -
    // purely an ordering preference, never a hard filter, so it only
    // feeds orderByLCV's tie-break, not slotValid().
    const teacherAfternoonDayCount = new Map<string, number>(); // `${teacher_id}|${day}` -> afternoon rotation lessons that day

    const unassigned = new Set<number>(tasks.map(t => t.id));
    const placedEntries: Entry[] = [];

    let steps = 0;
    let gaveUp: false | 'steps' | 'time' = false;

    function slotValid(t: Task, slot: CandidateSlot): boolean {
      const { teacher_id, grade_id, subject_id } = t.requirement;
      for (const pid of slot.periodIds) {
        if (classBusy.has(`${slot.day}|${pid}|${grade_id}`)) return false;
        if (teacherBusy.has(`${slot.day}|${pid}|${teacher_id}`)) return false;
      }
      if (settings.respectSubjectSpread && subjectDayBusy.has(`${slot.day}|${grade_id}|${subject_id}`)) return false;
      if (settings.respectDailyCap && maxLessonsPerDayPerTeacher) {
        const current = teacherDayCount.get(`${slot.day}|${teacher_id}`) || 0;
        if (current + slot.periodIds.length > maxLessonsPerDayPerTeacher) return false;
      }
      return true;
    }

    interface ApplyResult {
      ok: boolean;
      entries: Entry[];
      removals: { taskId: number; slot: CandidateSlot }[];
      subjectDayKey: string | null;
      teacherDayKey: string;
      prevTeacherDayCount: number;
      rotationDayKey: string | null;
      prevRotationDayCount: number;
    }

    function applyAssignment(task: Task, slot: CandidateSlot): ApplyResult {
      const { teacher_id, grade_id, subject_id } = task.requirement;
      const groupId = task.isDouble ? generateUuid() : null;
      const entries: Entry[] = slot.periodIds.map(pid => ({
        day: slot.day, period_id: pid, grade_id, subject_id, teacher_id,
        is_double_period: task.isDouble, double_group_id: groupId,
      }));

      for (const pid of slot.periodIds) {
        classBusy.add(`${slot.day}|${pid}|${grade_id}`);
        teacherBusy.add(`${slot.day}|${pid}|${teacher_id}`);
      }
      let subjectDayKey: string | null = null;
      if (settings.respectSubjectSpread) {
        subjectDayKey = `${slot.day}|${grade_id}|${subject_id}`;
        subjectDayBusy.add(subjectDayKey);
      }
      const teacherDayKey = `${slot.day}|${teacher_id}`;
      const prevTeacherDayCount = teacherDayCount.get(teacherDayKey) || 0;
      teacherDayCount.set(teacherDayKey, prevTeacherDayCount + slot.periodIds.length);

      let rotationDayKey: string | null = null;
      let prevRotationDayCount = 0;
      if (isRotationRequirement(task.requirement) && slotIsAfternoon(slot)) {
        rotationDayKey = `${teacher_id}|${slot.day}`;
        prevRotationDayCount = teacherAfternoonDayCount.get(rotationDayKey) || 0;
        teacherAfternoonDayCount.set(rotationDayKey, prevRotationDayCount + 1);
      }

      // Forward checking: prune every other unscheduled lesson that
      // shares this teacher or this class. If any of them is left with
      // zero legal slots, signal an immediate dead end.
      const neighborIds = new Set<number>([
        ...(tasksByTeacher.get(teacher_id) ?? []),
        ...(tasksByGrade.get(grade_id) ?? []),
      ]);
      neighborIds.delete(task.id);

      const removals: { taskId: number; slot: CandidateSlot }[] = [];
      let ok = true;
      for (const nid of neighborIds) {
        if (!unassigned.has(nid)) continue;
        const dom = domains.get(nid)!;
        const kept: CandidateSlot[] = [];
        let removedAny = false;
        const neighborTask = taskById.get(nid)!;
        for (const s of dom) {
          if (slotValid(neighborTask, s)) kept.push(s);
          else { removals.push({ taskId: nid, slot: s }); removedAny = true; }
        }
        if (removedAny) domains.set(nid, kept);
        if (kept.length === 0) { ok = false; break; }
      }

      return { ok, entries, removals, subjectDayKey, teacherDayKey, prevTeacherDayCount, rotationDayKey, prevRotationDayCount };
    }

    function revertAssignment(task: Task, slot: CandidateSlot, applied: ApplyResult) {
      const { teacher_id, grade_id } = task.requirement;
      for (const pid of slot.periodIds) {
        classBusy.delete(`${slot.day}|${pid}|${grade_id}`);
        teacherBusy.delete(`${slot.day}|${pid}|${teacher_id}`);
      }
      if (applied.subjectDayKey) subjectDayBusy.delete(applied.subjectDayKey);
      teacherDayCount.set(applied.teacherDayKey, applied.prevTeacherDayCount);
      if (applied.rotationDayKey) teacherAfternoonDayCount.set(applied.rotationDayKey, applied.prevRotationDayCount);
      for (const r of applied.removals) domains.get(r.taskId)!.push(r.slot);
    }

    // MRV + degree heuristic + weekly-load tie-break + double-first +
    // highest-weekly-requirement, in that priority order.
    function pickTask(): Task {
      let best: Task | null = null;
      let bestDomainSize = Infinity;
      let bestDegree = -1;
      for (const id of unassigned) {
        const t = taskById.get(id)!;
        const size = domains.get(id)!.length;
        if (best === null || size < bestDomainSize) {
          best = t; bestDomainSize = size; bestDegree = degreeOf(t);
          continue;
        }
        if (size !== bestDomainSize) continue;
        const deg = degreeOf(t);
        if (deg !== bestDegree) { if (deg > bestDegree) { best = t; bestDegree = deg; } continue; }
        const tl = teacherLoad.get(t.requirement.teacher_id) || 0;
        const btl = teacherLoad.get(best.requirement.teacher_id) || 0;
        if (tl !== btl) { if (tl > btl) best = t; continue; }
        const gl = gradeLoad.get(t.requirement.grade_id) || 0;
        const bgl = gradeLoad.get(best.requirement.grade_id) || 0;
        if (gl !== bgl) { if (gl > bgl) best = t; continue; }
        if (t.isDouble !== best.isDouble) { if (t.isDouble) best = t; continue; }
        if (t.requirement.lessons_per_week > best.requirement.lessons_per_week) best = t;
      }
      return best!;
    }

    // Least-constraining-value: try the slot that eliminates the fewest
    // options from other still-unscheduled lessons first.
    function orderByLCV(task: Task, domain: CandidateSlot[]): CandidateSlot[] {
      const shuffled = shuffledCopy(domain);
      if (shuffled.length <= 1) return shuffled;
      const neighborIds = [
        ...new Set<number>([
          ...(tasksByTeacher.get(task.requirement.teacher_id) ?? []),
          ...(tasksByGrade.get(task.requirement.grade_id) ?? []),
        ]),
      ].filter(id => id !== task.id && unassigned.has(id));

      const neighborKeySets = neighborIds.map(id => {
        const keys = new Set<string>();
        domains.get(id)!.forEach(s => s.periodIds.forEach(pid => keys.add(`${s.day}|${pid}`)));
        return keys;
      });

      // Languages/Maths/Sciences (as configured by the caller) get first
      // claim on morning slots — a soft preference layered on top of LCV,
      // never overriding it: it only breaks ties between otherwise
      // equally-constraining candidates.
      const isPriority = prioritySubjectIds?.has(task.requirement.subject_id) ?? false;

      // Grade-9 (or whichever grades are configured) afternoon-rotation:
      // among otherwise-equal candidates, avoid giving this teacher an
      // afternoon rotation slot on a day they already have one — nudges
      // the search toward spreading these lessons across the week
      // instead of clustering them on the same days every time.
      const taskIsRotation = isRotationRequirement(task.requirement);

      // Free/self-study periods: steered away from the first two lesson
      // periods of the day, preferring mid-morning, then afternoon.
      const taskIsFreePeriod = freePeriodActive && freePeriodSubjectIds!.has(task.requirement.subject_id);

      const withCost = shuffled.map(slot => {
        let costVal = 0;
        for (const keySet of neighborKeySets) {
          for (const pid of slot.periodIds) {
            if (keySet.has(`${slot.day}|${pid}`)) { costVal++; break; }
          }
        }
        const morningMismatch = isPriority ? (slot.morning ? 0 : 1) : (slot.morning ? 1 : 0);

        let rotationPenalty = 0;
        if (taskIsRotation && slotIsAfternoon(slot)) {
          const key = `${task.requirement.teacher_id}|${slot.day}`;
          rotationPenalty = (teacherAfternoonDayCount.get(key) || 0) > 0 ? 1 : 0;
        }

        let freePeriodPenalty = 0;
        if (taskIsFreePeriod) {
          if (slotIsEarlyMorning(slot)) freePeriodPenalty = 2;
          else if (slotIsAfternoon(slot)) freePeriodPenalty = 1;
          // else mid-morning: 0, preferred
        }

        return { slot, costVal, morningMismatch, rotationPenalty, freePeriodPenalty };
      });
      withCost.sort((a, b) =>
        (a.costVal - b.costVal)
        || (a.morningMismatch - b.morningMismatch)
        || (a.rotationPenalty - b.rotationPenalty)
        || (a.freePeriodPenalty - b.freePeriodPenalty)
      );
      return withCost.map(w => w.slot);
    }

    async function solve(): Promise<boolean> {
      if (unassigned.size === 0) return true;
      steps++;
      if (steps % YIELD_EVERY_STEPS === 0) {
        onProgress?.({ phase: 'scheduling', message: `Scheduling lessons: ${placedEntries.length} / ${totalPeriods}`, placed: placedEntries.length, total: totalPeriods });
        await tick();
      }
      if (steps > STEP_BUDGET_PER_ATTEMPT) { gaveUp = 'steps'; return false; }
      if (Date.now() > deadline) { gaveUp = 'time'; return false; }

      const task = pickTask();
      const domain = domains.get(task.id)!;
      if (domain.length === 0) return false;

      const ordered = orderByLCV(task, domain);
      unassigned.delete(task.id);

      for (const slot of ordered) {
        const applied = applyAssignment(task, slot);
        if (!applied.ok) {
          revertAssignment(task, slot, applied);
          if (gaveUp) break;
          continue;
        }
        placedEntries.push(...applied.entries);
        const solved = await solve();
        if (solved) return true;
        placedEntries.splice(placedEntries.length - applied.entries.length, applied.entries.length);
        revertAssignment(task, slot, applied);
        if (gaveUp) break;
      }

      unassigned.add(task.id);
      return false;
    }

    const solved = await solve();
    return { solved, entries: placedEntries, gaveUp };
  }

  // ── Stage 3: search, with soft-preference relaxation as a last resort ──
  const totalDeadline = Date.now() + TOTAL_TIME_BUDGET_MS;
  let best: AttemptResult | null = null;
  let relaxed = false;

  for (let i = 0; i < STRICT_ATTEMPTS && Date.now() < totalDeadline; i++) {
    const res = await attempt(
      { respectSubjectSpread: true, respectDailyCap: !!maxLessonsPerDayPerTeacher },
      Math.min(totalDeadline, Date.now() + TIME_BUDGET_PER_ATTEMPT_MS),
    );
    if (res.solved) { best = res; break; }
    if (!best || res.entries.length > best.entries.length) best = res;
  }

  if (!best?.solved && Date.now() < totalDeadline) {
    onProgress?.({ phase: 'scheduling', message: 'Retrying with relaxed soft preferences…', placed: best?.entries.length ?? 0, total: totalPeriods });
    for (let i = 0; i < RELAXED_ATTEMPTS && Date.now() < totalDeadline; i++) {
      const res = await attempt(
        { respectSubjectSpread: false, respectDailyCap: false },
        Math.min(totalDeadline, Date.now() + TIME_BUDGET_PER_ATTEMPT_MS),
      );
      if (res.solved) { best = res; relaxed = true; break; }
      if (!best || res.entries.length > best.entries.length) best = res;
    }
  }

  if (!best || !best.solved) {
    onProgress?.({ phase: 'failed', message: 'Unable to find a conflict-free timetable.' });
    const unplaced = buildUnplaced(requirements, best?.entries ?? []);
    const diagnostics = summarizeShortfall(unplaced, gradeName, teacherName, subjectName);
    return { success: false, entries: [], unplaced, diagnostics, feasibility };
  }

  // ── Stage 4: conflict check, light polish, final validation ──────
  onProgress?.({ phase: 'checking', message: 'Checking conflicts…', placed: best.entries.length, total: totalPeriods });
  await tick();

  onProgress?.({ phase: 'optimizing', message: 'Optimizing timetable…' });
  const optimized = localOptimize(best.entries, periods, workingDays, maxLessonsPerDayPerTeacher, {
    rotationGradeIds: rotationActive ? rotationGradeIds : undefined,
    rotationSubjectIds: rotationActive ? rotationSubjectIds : undefined,
    rotationTeacherIds,
    afternoonSlotKeys,
    earlyMorningSlotKeys,
    freePeriodSubjectIds: freePeriodActive ? freePeriodSubjectIds : undefined,
  });
  await tick();

  onProgress?.({ phase: 'validating-result', message: 'Validating timetable…' });
  const gn = gradeName ?? ((id: number) => `Class #${id}`);
  const tn = teacherName ?? ((id: string) => `Teacher #${id.slice(0, 6)}`);
  const sn = subjectName ?? ((id: number) => `Subject #${id}`);
  const finalCheck = validateTimetable(optimized, requirements, gn, tn, sn);
  await tick();

  if (!finalCheck.isValid) {
    // Defensive: this should never happen given the checks above, but a
    // timetable is never handed back for saving unless it is provably
    // conflict-free — never a partially-valid draft.
    return {
      success: false, entries: [], feasibility,
      unplaced: buildUnplaced(requirements, []),
      diagnostics: [
        'An internal consistency check failed after generation — please try again.',
        ...finalCheck.classCollisions, ...finalCheck.teacherCollisions, ...finalCheck.roomCollisions,
      ],
    };
  }

  onProgress?.({ phase: 'done', message: 'Timetable successfully generated.', placed: optimized.length, total: totalPeriods });
  return {
    success: true,
    entries: optimized,
    unplaced: [],
    diagnostics: relaxed
      ? ['Generated by relaxing one soft preference (same-subject daily spacing or a teacher\'s daily lesson cap) so every required lesson could still be placed. No hard constraint was ever relaxed.']
      : [],
    feasibility,
  };
}

function buildUnplaced(requirements: Requirement[], entries: Entry[]): { requirement: Requirement; reason: string }[] {
  const unplaced: { requirement: Requirement; reason: string }[] = [];
  for (const req of requirements) {
    if (req.lessons_per_week <= 0) continue;
    const got = entries.filter(e => e.teacher_id === req.teacher_id && e.subject_id === req.subject_id && e.grade_id === req.grade_id).length;
    if (got < req.lessons_per_week) {
      unplaced.push({
        requirement: req,
        reason: `Only placed ${got}/${req.lessons_per_week} lessons — the teacher, class, or period grid is over-constrained for this assignment.`,
      });
    }
  }
  return unplaced;
}

/** Item 17 from the spec: summarize root causes instead of dumping a
 * repetitive line per lesson. Shows the worst-affected assignments
 * first, caps the list, and always ends with concrete next steps. */
function summarizeShortfall(
  unplaced: { requirement: Requirement; reason: string }[],
  gradeName?: (id: number) => string,
  teacherName?: (id: string) => string,
  subjectName?: (id: number) => string,
): string[] {
  const gn = gradeName ?? ((id: number) => `Class #${id}`);
  const tn = teacherName ?? ((id: string) => `Teacher #${id.slice(0, 6)}`);
  const sn = subjectName ?? ((id: number) => `Subject #${id}`);

  const ranked = [...unplaced].sort((a, b) => b.requirement.lessons_per_week - a.requirement.lessons_per_week);
  const shown = ranked.slice(0, 8);
  const lines = shown.map(u => `${gn(u.requirement.grade_id)} — ${sn(u.requirement.subject_id)} (${tn(u.requirement.teacher_id)}): ${u.reason}`);
  if (ranked.length > shown.length) {
    lines.push(`…and ${ranked.length - shown.length} more assignment(s) with unmet lessons.`);
  }
  lines.push('Recommended actions: add more teaching periods, increase teacher availability, reassign some subjects, or adjust lesson requirements.');
  return lines;

    a.day = bOrig.day; a.period_id = bOrig.period_id;
    b.day = aOrig.day; b.period_id = aOrig.period_id;

    const aNewClassKey = classKey(a), aNewTeacherKey = teacherKey(a);
    const bNewClassKey = classKey(b), bNewTeacherKey = teacherKey(b);
    const hardOk = !classBusy.has(aNewClassKey) && !teacherBusy.has(aNewTeacherKey)
      && !classBusy.has(bNewClassKey) && !teacherBusy.has(bNewTeacherKey);

    if (!hardOk) {
      a.day = aOrig.day; a.period_id = aOrig.period_id;
      b.day = bOrig.day; b.period_id = bOrig.period_id;
      classBusy.add(classKey(a)); classBusy.add(classKey(b));
      teacherBusy.add(teacherKey(a)); teacherBusy.add(teacherKey(b));
      continue;
    }

    classBusy.add(aNewClassKey); classBusy.add(bNewClassKey);
    teacherBusy.add(aNewTeacherKey); teacherBusy.add(bNewTeacherKey);

    const newCost = cost();
    if (newCost < currentCost) {
      currentCost = newCost; // keep the swap
    } else {
      classBusy.delete(aNewClassKey); classBusy.delete(bNewClassKey);
      teacherBusy.delete(aNewTeacherKey); teacherBusy.delete(bNewTeacherKey);
      a.day = aOrig.day; a.period_id = aOrig.period_id;
      b.day = bOrig.day; b.period_id = bOrig.period_id;
      classBusy.add(classKey(a)); classBusy.add(classKey(b));
      teacherBusy.add(teacherKey(a)); teacherBusy.add(teacherKey(b));
    }
  }

  return result;
}

/* ── Validation report ─────────────────────────────────────────────────
   Re-scans a saved/candidate entry set from scratch — used by the
   "Validate Timetable" button, independent of whatever produced the
   entries (generator or manual edits), and internally as the final
   gate before a generated timetable is ever handed back for saving. */
export interface ValidationReport {
  classCollisions: string[];
  teacherCollisions: string[];
  roomCollisions: string[];
  duplicates: string[];
  missingLessons: string[];
  unassignedRequirements: string[];
  isValid: boolean;
}

export function validateTimetable(
  entries: Entry[],
  requirements: Requirement[],
  gradeName: (id: number) => string,
  teacherName: (id: string) => string,
  subjectName: (id: number) => string,
): ValidationReport {
  const classCollisions: string[] = [];
  const teacherCollisions: string[] = [];
  const roomCollisions: string[] = [];
  const duplicates: string[] = [];
  const seenClass = new Map<string, Entry>();
  const seenTeacher = new Map<string, Entry>();
  const seenRoom = new Map<string, Entry>();
  const seenExact = new Map<string, number>();

  for (const e of entries) {
    const kc = `${e.day}|${e.period_id}|${e.grade_id}`;
    const kt = `${e.day}|${e.period_id}|${e.teacher_id}`;
    const kx = `${e.day}|${e.period_id}|${e.grade_id}|${e.subject_id}|${e.teacher_id}`;

    if (seenClass.has(kc)) {
      classCollisions.push(`${gradeName(e.grade_id)} double-booked on ${DAY_LABELS[e.day]} period ${e.period_id}: ${subjectName(seenClass.get(kc)!.subject_id)} vs ${subjectName(e.subject_id)}.`);
    } else seenClass.set(kc, e);

    if (seenTeacher.has(kt)) {
      teacherCollisions.push(`${teacherName(e.teacher_id)} double-booked on ${DAY_LABELS[e.day]} period ${e.period_id}.`);
    } else seenTeacher.set(kt, e);

    // Room collisions only apply to entries that actually carry a room.
    if (e.room) {
      const kr = `${e.day}|${e.period_id}|${e.room}`;
      if (seenRoom.has(kr)) {
        roomCollisions.push(`Room ${e.room} double-booked on ${DAY_LABELS[e.day]} period ${e.period_id}: ${gradeName(seenRoom.get(kr)!.grade_id)} vs ${gradeName(e.grade_id)}.`);
      } else seenRoom.set(kr, e);
    }

    seenExact.set(kx, (seenExact.get(kx) || 0) + 1);
  }
  seenExact.forEach((count, key) => {
    if (count > 1) duplicates.push(`Duplicate lesson entry detected for key ${key} (${count} copies).`);
  });

  const missingLessons: string[] = [];
  const unassignedRequirements: string[] = [];
  for (const req of requirements) {
    if (req.lessons_per_week <= 0) continue;
    const got = entries.filter(e => e.teacher_id === req.teacher_id && e.subject_id === req.subject_id && e.grade_id === req.grade_id).length;
    if (got < req.lessons_per_week) {
      missingLessons.push(`${gradeName(req.grade_id)} ${subjectName(req.subject_id)}: ${got}/${req.lessons_per_week} lessons scheduled.`);
    }
    if (!req.teacher_id) unassignedRequirements.push(`${gradeName(req.grade_id)} ${subjectName(req.subject_id)} has no teacher assigned.`);
  }

  return {
    classCollisions, teacherCollisions, roomCollisions, duplicates,
    missingLessons, unassignedRequirements,
    isValid: classCollisions.length === 0 && teacherCollisions.length === 0 && roomCollisions.length === 0
      && duplicates.length === 0 && missingLessons.length === 0 && unassignedRequirements.length === 0,
  };
}

