/* ══════════════════════════════════════════════════════════════════════
   Timetable generation & collision-checking engine.

   Every write path in the Timetable module — the automatic generator AND
   the manual drag/click editor — goes through the same checkCollision()
   function here, so "never allow two things in the same slot" is
   enforced in exactly one place rather than re-implemented per screen.

   THE GENERATOR
   ─────────────
   A real constraint-satisfaction solver combined with controlled
   randomization and multi-candidate scoring — not a best-effort filler,
   and not a solver that locks any subject to a fixed part of the day:

    1. Pre-Generation Validation — before any search runs, class
       capacity, teacher capacity, teacher-subject assignment and
       period-grid sanity are all checked. If the requirements are
       mathematically impossible to satisfy, generation never starts
       and the specific blocker is reported (see checkFeasibility()).

    2. Lesson-instance generation — each weekly requirement is expanded
       into individual lesson instances (or double-period blocks),
       scheduled one at a time, never as a single "5 lessons" object.

    3. Global optimization — every class and every teacher across the
       ENTIRE school (every grade in `requirements`) are scheduled
       together in one solve, never grade-by-grade in isolation. A
       placement is only ever accepted when the class is free, the
       teacher is free, the period is a genuine lesson period, the
       subject's weekly requirement isn't exceeded, and every other
       hard constraint holds.

    4. MRV (Minimum Remaining Values) + forward checking + least-
       constraining-value ordering + backtracking — the same core CSP
       machinery as before (see each function's comments below).

    5. No subject is permanently "morning" or "afternoon". Every
       subject — including academically-demanding ones — is nudged
       toward a target morning/afternoon ratio that is tracked live as
       lessons are placed (see targetMorningRatio()) and re-evaluated
       per lesson instance with a randomized coin-flip, so five lessons
       of the same subject don't mechanically repeat the same pattern.
       This is the fix for "Maths/English/Science always morning,
       Pre-Technical/CRE/SST always afternoon".

    6. Same-period repetition, teacher clustering, and repeated daily
       subject-pair patterns (e.g. "Pre-Tech → CRE" showing up on
       several different days) are all tracked and penalized, both as
       a live search preference and in the post-generation polish pass.

    7. Controlled randomization + multi-candidate scoring — the solver
       doesn't stop at the first valid schedule it finds. It builds
       several independent valid candidates (each with its own random
       exploration order), polishes each with a bounded local-search
       pass, scores all of them with scoreTimetable(), and keeps the
       best-scoring one. See generateTimetable()'s Stage 3/4.

   Hard constraints (class/teacher/room collisions, double-period
   adjacency, breaks/lunch/activities, weekly lesson counts) are never
   violated by any of the above — every mechanism described here only
   ever influences *which order* candidates are tried in, or accepts an
   already-safe swap. Nothing partial or unverified is ever handed back
   for saving — see generateTimetable()'s final validation stage.
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

/** Where the lunch break starts, used as the morning/afternoon divider
 * throughout this file. Falls back to the first period at/after noon if
 * no period is explicitly typed 'lunch'. */
function computeLunchStart(periods: Period[]): string {
  return periods.find(p => p.period_type === 'lunch')?.start_time
    ?? [...periods].sort((a, b) => a.start_time.localeCompare(b.start_time)).find(p => p.start_time >= '12:00:00')?.start_time
    ?? '12:00:00';
}

type DayPart = 'early' | 'mid' | 'late' | 'afternoon';

/** Classifies every (day, lesson period) slot in the working week into
 * early-morning / mid-morning / late-morning / afternoon, entirely
 * relative to that day's own period grid (not a fixed clock time), so
 * it works the same whether a school's day starts at 7:30 or 8:15.
 * "Early" = the first EARLY_MORNING_PERIOD_COUNT lesson periods before
 * lunch. "Late" = the last LATE_MORNING_PERIOD_COUNT lesson periods
 * before lunch. Everything else before lunch is "mid". Used by the
 * free-period placement rule and by the morning/afternoon balance
 * scoring — NOT by the Grade-9 afternoon-rotation rule, which uses an
 * explicit clock time (see afternoonStartTime in GenerateOptions)
 * because that rule is specifically about a school's stated afternoon
 * session block. */
function classifyDayParts(periods: Period[], workingDays: Day[], lunchStart: string): Map<string, DayPart> {
  const map = new Map<string, DayPart>();
  for (const day of workingDays) {
    const dayPeriods = periodsForDay(periods, day).filter(p => p.period_type === 'lesson').sort((a, b) => a.period_index - b.period_index);
    const preLunch = dayPeriods.filter(p => p.start_time < lunchStart);
    const postLunch = dayPeriods.filter(p => p.start_time >= lunchStart);
    const earlyCount = Math.min(EARLY_MORNING_PERIOD_COUNT, preLunch.length);
    const lateCount = preLunch.length > earlyCount ? Math.min(LATE_MORNING_PERIOD_COUNT, preLunch.length - earlyCount) : 0;
    preLunch.forEach((p, idx) => {
      let part: DayPart;
      if (idx < earlyCount) part = 'early';
      else if (lateCount > 0 && idx >= preLunch.length - lateCount) part = 'late';
      else part = 'mid';
      map.set(`${day}|${p.id}`, part);
    });
    postLunch.forEach(p => map.set(`${day}|${p.id}`, 'afternoon'));
  }
  return map;
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
   constraining-value slot ordering, self-balancing morning/afternoon
   placement, same-period-repetition avoidance, and backtracking with
   randomized restarts feeding a multi-candidate scoring pass. Soft
   preferences are relaxed (never hard constraints) if every strict
   attempt is exhausted. See the file header for details.
═══════════════════════════════════════════════════════════════════════ */

interface Task {
  id: number;
  requirement: Requirement;
  isDouble: boolean;
}

interface CandidateSlot {
  day: Day;
  periodIds: number[]; // 1 for a single lesson, 2 (consecutive) for a double
  periodIndex: number; // the first period's index — used for same-period-repeat tracking
  morning: boolean;    // lunch-relative
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
  /** Subjects that are academically demanding (e.g. Mathematics, English,
   * Integrated Science). These get a *soft, self-correcting* lean toward
   * morning slots — never a permanent lock. As soon as enough of a
   * subject's weekly instances have landed in the morning, the
   * preference flips and later instances are nudged toward the
   * afternoon instead, so the subject still shows up in both. Every
   * other subject gets the same anti-monotony treatment with a neutral
   * (no lean) target, so nothing — demanding or not — ends up
   * permanently confined to one part of the day. */
  demandingSubjectIds?: Set<number>;
  maxLessonsPerDayPerTeacher?: number | null;
  onProgress?: (update: ProgressUpdate) => void;
  gradeName?: (id: number) => string;
  teacherName?: (id: string) => string;
  subjectName?: (id: number) => string;
  /** Grades the afternoon-teacher-rotation rule applies to (e.g. Grade
   * 9). Left unset, the rule is a no-op. */
  rotationGradeIds?: Set<number>;
  /** Subjects (practical/technical/humanities, etc.) the rotation rule
   * applies to, within rotationGradeIds. */
  rotationSubjectIds?: Set<number>;
  /** Optional further restriction to specific teachers within
   * rotationGradeIds/rotationSubjectIds. Omit to apply to every teacher
   * who falls into that grade+subject scope. */
  rotationTeacherIds?: Set<string>;
  /** Clock time (HH:MM:SS) marking the start of "afternoon" for the
   * rotation rule specifically. Defaults to 14:00:00. */
  afternoonStartTime?: string;
  /** Subjects that represent a free/self-study period. Steered away from
   * the first two lesson periods of the day, preferring mid-morning or
   * afternoon first, late-morning second, and first-morning only as a
   * last resort. */
  freePeriodSubjectIds?: Set<number>;
}

export interface ScoreBreakdown {
  /** 0–100 overall quality score. Only meaningful when conflictFree. */
  total: number;
  conflictFree: boolean;
  /** How well subjects avoid being permanently confined to one part of
   * the day (0 = every multi-lesson subject is monotone, 100 = none are). */
  morningAfternoonBalance: number;
  /** How evenly teacher daily loads are spread (caps, gaps, consecutive
   * runs). */
  teacherWorkloadBalance: number;
  /** How well free/self-study periods landed in mid-morning/afternoon
   * rather than the first periods of the day. 100 if none are configured. */
  freePeriodPlacement: number;
  /** How well each subject's weekly lessons avoid repeating the exact
   * same period across different days, and avoid repeating the same
   * daily subject-pair pattern on multiple days. */
  subjectDistribution: number;
  /** Human-readable call-outs for anything scoring notably low. */
  notes: string[];
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
  /** Quality score of the returned timetable — null only when
   * success === false. */
  scoreBreakdown: ScoreBreakdown | null;
}

// A single attempt is bounded by both a step count and a wall-clock
// deadline so a genuinely pathological input can never hang the tab —
// the UI yields every YIELD_EVERY_STEPS steps regardless, so even a
// long-running search keeps the browser responsive.
const YIELD_EVERY_STEPS = 250;
const STEP_BUDGET_PER_ATTEMPT = 150_000;
const TIME_BUDGET_PER_ATTEMPT_MS = 4_000;
const TOTAL_TIME_BUDGET_MS = 28_000;
// Also doubles as "how many independent valid candidates to build and
// score before picking the best one" (item 4/7: controlled
// randomization + multi-candidate scoring).
const STRICT_ATTEMPTS = 5;
const RELAXED_ATTEMPTS = 3;
const OPTIMIZE_ITERATIONS = 320;
// How many of each day's lesson periods (from the start/end of the
// morning) count as "early"/"late" morning for the free-period rule and
// the day-part classification used in scoring.
const EARLY_MORNING_PERIOD_COUNT = 2;
const LATE_MORNING_PERIOD_COUNT = 1;
// How strongly a subject's running morning/afternoon ratio has to drift
// from its target before the search nudges the next instance the other
// way — a dead zone so it doesn't overcorrect on every single lesson.
const RATIO_NEUTRAL_BAND = 0.12;
const DEMANDING_TARGET_MORNING_RATIO = 0.65;
const DEFAULT_TARGET_MORNING_RATIO = 0.5;
// The day-part nudge only applies some of the time — this is the
// "controlled" half of "controlled randomization": each lesson instance
// independently rolls whether it follows the current preference at all,
// so five weekly instances of the same subject don't mechanically all
// land in the same part of the day.
const RATIO_NUDGE_PROBABILITY = 0.7;

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
    onProgress, demandingSubjectIds, maxLessonsPerDayPerTeacher = null, gradeName, teacherName, subjectName,
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
    return { success: false, entries: [], unplaced: [], diagnostics: feasibility.blockers, feasibility, scoreBreakdown: null };
  }

  // ── Stage 2: Lesson instance generation ───────────────────────────
  // Convert each weekly requirement (across EVERY grade — this is one
  // global solve, never per-grade) into individual lesson instances (or
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
  const lunchStart = computeLunchStart(periods);
  const isMorningPeriod = (p: Period) => p.start_time < lunchStart;

  const singleSlots: CandidateSlot[] = [];
  const doubleSlots: CandidateSlot[] = [];
  // Clock-based afternoon marker — used ONLY by the Grade-9-style
  // afternoon-teacher-rotation rule, which is about a school's actual
  // stated afternoon session block, not a relative day-part.
  const rotationAfternoonSlotKeys = new Set<string>();
  for (const day of workingDays) {
    const dayPeriods = periodsForDay(periods, day).filter(p => p.period_type === 'lesson').sort((a, b) => a.period_index - b.period_index);
    dayPeriods.forEach(p => {
      singleSlots.push({ day, periodIds: [p.id], periodIndex: p.period_index, morning: isMorningPeriod(p) });
      if (p.start_time >= afternoonStartTime) rotationAfternoonSlotKeys.add(`${day}|${p.id}`);
    });
    for (let i = 0; i < dayPeriods.length - 1; i++) {
      if (dayPeriods[i + 1].period_index === dayPeriods[i].period_index + 1) {
        doubleSlots.push({
          day, periodIds: [dayPeriods[i].id, dayPeriods[i + 1].id],
          periodIndex: dayPeriods[i].period_index, morning: isMorningPeriod(dayPeriods[i]),
        });
      }
    }
  }
  // Relative (lunch-based, position-based) classification — used by the
  // free-period placement rule and by the general anti-monotony nudge.
  const dayPartOf = classifyDayParts(periods, workingDays, lunchStart);

  const rotationActive = !!(rotationGradeIds && rotationGradeIds.size && rotationSubjectIds && rotationSubjectIds.size);
  const freePeriodActive = !!(freePeriodSubjectIds && freePeriodSubjectIds.size);
  const isRotationRequirement = (r: Requirement) =>
    rotationActive && rotationGradeIds!.has(r.grade_id) && rotationSubjectIds!.has(r.subject_id)
    && (!rotationTeacherIds || rotationTeacherIds.size === 0 || rotationTeacherIds.has(r.teacher_id));
  const slotIsRotationAfternoon = (slot: CandidateSlot) => slot.periodIds.some(pid => rotationAfternoonSlotKeys.has(`${slot.day}|${pid}`));
  const slotDayPart = (slot: CandidateSlot): DayPart => dayPartOf.get(`${slot.day}|${slot.periodIds[0]}`) ?? (slot.morning ? 'mid' : 'afternoon');
  const targetMorningRatio = (subjectId: number) => demandingSubjectIds?.has(subjectId) ? DEMANDING_TARGET_MORNING_RATIO : DEFAULT_TARGET_MORNING_RATIO;

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
      success: false, entries: [], feasibility, scoreBreakdown: null,
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
    // Grade-9-style afternoon-rotation tracking — purely an ordering
    // preference, never a hard filter.
    const teacherAfternoonDayCount = new Map<string, number>(); // `${teacher_id}|${day}` -> afternoon rotation lessons that day
    // No subject is permanently morning/afternoon: running counts per
    // (grade, subject) feed the self-balancing day-part nudge.
    const subjectDayPartCount = new Map<string, { morning: number; afternoon: number }>(); // `${grade}|${subject}`
    // Same-period repetition avoidance, universal to every subject.
    const subjectPeriodUsage = new Map<string, Map<number, number>>(); // `${grade}|${subject}` -> periodIndex -> count

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
      dayPartKey: string;
      dayPartWasMorning: boolean;
      periodUsageKey: string;
      periodUsageIndex: number;
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
      if (isRotationRequirement(task.requirement) && slotIsRotationAfternoon(slot)) {
        rotationDayKey = `${teacher_id}|${slot.day}`;
        prevRotationDayCount = teacherAfternoonDayCount.get(rotationDayKey) || 0;
        teacherAfternoonDayCount.set(rotationDayKey, prevRotationDayCount + 1);
      }

      // No-permanent-day-part tracking (always on, every subject).
      const dayPartKey = `${grade_id}|${subject_id}`;
      const dayPartWasMorning = slot.morning;
      const dpCounts = subjectDayPartCount.get(dayPartKey) ?? { morning: 0, afternoon: 0 };
      if (dayPartWasMorning) dpCounts.morning++; else dpCounts.afternoon++;
      subjectDayPartCount.set(dayPartKey, dpCounts);

      // Same-period-repetition tracking (always on, every subject).
      const periodUsageKey = dayPartKey;
      const periodUsageIndex = slot.periodIndex;
      const puMap = subjectPeriodUsage.get(periodUsageKey) ?? new Map<number, number>();
      puMap.set(periodUsageIndex, (puMap.get(periodUsageIndex) || 0) + 1);
      subjectPeriodUsage.set(periodUsageKey, puMap);

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

      return {
        ok, entries, removals, subjectDayKey, teacherDayKey, prevTeacherDayCount, rotationDayKey, prevRotationDayCount,
        dayPartKey, dayPartWasMorning, periodUsageKey, periodUsageIndex,
      };
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
      const dpCounts = subjectDayPartCount.get(applied.dayPartKey)!;
      if (applied.dayPartWasMorning) dpCounts.morning--; else dpCounts.afternoon--;
      const puMap = subjectPeriodUsage.get(applied.periodUsageKey)!;
      puMap.set(applied.periodUsageIndex, puMap.get(applied.periodUsageIndex)! - 1);
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

    // Least-constraining-value, plus several soft-preference tie-breaks:
    // self-balancing day-part nudge (never a permanent morning/afternoon
    // lock), Grade-9-style afternoon rotation, free-period placement,
    // and same-period-repetition avoidance. All of these only ever
    // change the *order* candidates are tried in.
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

      const { teacher_id, grade_id, subject_id } = task.requirement;

      // Self-balancing day-part preference — rolled once per task
      // instance, not per candidate slot, so some of a subject's weekly
      // instances get nudged and others don't (controlled randomization).
      let wantMorning = false, wantAfternoon = false;
      if (Math.random() < RATIO_NUDGE_PROBABILITY) {
        const dpKey = `${grade_id}|${subject_id}`;
        const counts = subjectDayPartCount.get(dpKey);
        const total = (counts?.morning ?? 0) + (counts?.afternoon ?? 0);
        const currentRatio = total === 0 ? 0.5 : (counts!.morning / total);
        const target = targetMorningRatio(subject_id);
        wantMorning = currentRatio < target - RATIO_NEUTRAL_BAND;
        wantAfternoon = currentRatio > target + RATIO_NEUTRAL_BAND;
      }

      const taskIsRotation = isRotationRequirement(task.requirement);
      const taskIsFreePeriod = freePeriodActive && freePeriodSubjectIds!.has(subject_id);
      const periodUsage = subjectPeriodUsage.get(`${grade_id}|${subject_id}`);

      const withCost = shuffled.map(slot => {
        let costVal = 0;
        for (const keySet of neighborKeySets) {
          for (const pid of slot.periodIds) {
            if (keySet.has(`${slot.day}|${pid}`)) { costVal++; break; }
          }
        }

        let dayPartMismatch = 0;
        if (wantMorning) dayPartMismatch = slot.morning ? 0 : 1;
        else if (wantAfternoon) dayPartMismatch = slot.morning ? 1 : 0;

        let rotationPenalty = 0;
        if (taskIsRotation && slotIsRotationAfternoon(slot)) {
          const key = `${teacher_id}|${slot.day}`;
          rotationPenalty = (teacherAfternoonDayCount.get(key) || 0) > 0 ? 1 : 0;
        }

        let freePeriodPenalty = 0;
        if (taskIsFreePeriod) {
          const part = slotDayPart(slot);
          freePeriodPenalty = part === 'early' ? 2 : part === 'late' ? 1 : 0; // mid & afternoon = 0 (first priority)
        }

        const periodRepeatPenalty = (periodUsage?.get(slot.periodIndex) ?? 0) > 0 ? 1 : 0;

        return { slot, costVal, dayPartMismatch, rotationPenalty, freePeriodPenalty, periodRepeatPenalty };
      });
      withCost.sort((a, b) =>
        (a.costVal - b.costVal)
        || (a.dayPartMismatch - b.dayPartMismatch)
        || (a.rotationPenalty - b.rotationPenalty)
        || (a.freePeriodPenalty - b.freePeriodPenalty)
        || (a.periodRepeatPenalty - b.periodRepeatPenalty)
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

  // ── Stage 3: build several independent candidates ─────────────────
  // Controlled randomization + multi-candidate scoring (items 4/7): the
  // solver doesn't stop at the first valid schedule — it keeps building
  // independently-randomized candidates until the attempt budget or time
  // budget runs out, then scores every one of them (Stage 4) and keeps
  // the best. Soft-preference relaxation only kicks in if not a single
  // strict attempt succeeds.
  const totalDeadline = Date.now() + TOTAL_TIME_BUDGET_MS;
  const strictCandidates: AttemptResult[] = [];
  let worstFallback: AttemptResult | null = null;

  for (let i = 0; i < STRICT_ATTEMPTS && Date.now() < totalDeadline; i++) {
    const res = await attempt(
      { respectSubjectSpread: true, respectDailyCap: !!maxLessonsPerDayPerTeacher },
      Math.min(totalDeadline, Date.now() + TIME_BUDGET_PER_ATTEMPT_MS),
    );
    if (res.solved) strictCandidates.push(res);
    else if (!worstFallback || res.entries.length > worstFallback.entries.length) worstFallback = res;
  }

  let candidates = strictCandidates;
  let relaxed = false;
  if (candidates.length === 0 && Date.now() < totalDeadline) {
    onProgress?.({ phase: 'scheduling', message: 'Retrying with relaxed soft preferences…', placed: worstFallback?.entries.length ?? 0, total: totalPeriods });
    const relaxedCandidates: AttemptResult[] = [];
    for (let i = 0; i < RELAXED_ATTEMPTS && Date.now() < totalDeadline; i++) {
      const res = await attempt(
        { respectSubjectSpread: false, respectDailyCap: false },
        Math.min(totalDeadline, Date.now() + TIME_BUDGET_PER_ATTEMPT_MS),
      );
      if (res.solved) relaxedCandidates.push(res);
      else if (!worstFallback || res.entries.length > worstFallback.entries.length) worstFallback = res;
    }
    if (relaxedCandidates.length > 0) { candidates = relaxedCandidates; relaxed = true; }
  }

  if (candidates.length === 0) {
    onProgress?.({ phase: 'failed', message: 'Unable to find a conflict-free timetable.' });
    const unplaced = buildUnplaced(requirements, worstFallback?.entries ?? []);
    const diagnostics = summarizeShortfall(unplaced, gradeName, teacherName, subjectName);
    return { success: false, entries: [], unplaced, diagnostics, feasibility, scoreBreakdown: null };
  }

  // ── Stage 4: polish + score every candidate, keep the best ─────────
  onProgress?.({ phase: 'checking', message: 'Checking conflicts…', placed: candidates[0].entries.length, total: totalPeriods });
  await tick();

  onProgress?.({ phase: 'optimizing', message: `Optimizing ${candidates.length} candidate timetable${candidates.length > 1 ? 's' : ''}…` });
  const gn = gradeName ?? ((id: number) => `Class #${id}`);
  const tn = teacherName ?? ((id: string) => `Teacher #${id.slice(0, 6)}`);
  const sn = subjectName ?? ((id: number) => `Subject #${id}`);

  let bestEntries: Entry[] | null = null;
  let bestScore: ScoreBreakdown | null = null;
  for (const cand of candidates) {
    const optimized = localOptimize(cand.entries, periods, workingDays, maxLessonsPerDayPerTeacher, {
      rotationGradeIds: rotationActive ? rotationGradeIds : undefined,
      rotationSubjectIds: rotationActive ? rotationSubjectIds : undefined,
      rotationTeacherIds,
      afternoonStartTime,
      freePeriodSubjectIds: freePeriodActive ? freePeriodSubjectIds : undefined,
      demandingSubjectIds,
    });
    const score = scoreTimetable(optimized, requirements, periods, workingDays, {
      demandingSubjectIds, freePeriodSubjectIds, maxLessonsPerDayPerTeacher, gradeName: gn, teacherName: tn, subjectName: sn,
    });
    if (!score.conflictFree) continue; // defensive — should never happen, see final check below
    if (!bestScore || score.total > bestScore.total) { bestScore = score; bestEntries = optimized; }
    await tick();
  }

  if (!bestEntries || !bestScore) {
    // Every candidate somehow failed its own internal consistency check —
    // should be unreachable given the search's own hard-constraint
    // guarantees, but never hand back anything unverified.
    return {
      success: false, entries: [], feasibility, scoreBreakdown: null,
      unplaced: buildUnplaced(requirements, []),
      diagnostics: ['An internal consistency check failed after generation — please try again.'],
    };
  }

  onProgress?.({ phase: 'validating-result', message: 'Validating timetable…' });
  const finalCheck = validateTimetable(bestEntries, requirements, gn, tn, sn);
  await tick();

  if (!finalCheck.isValid) {
    return {
      success: false, entries: [], feasibility, scoreBreakdown: null,
      unplaced: buildUnplaced(requirements, []),
      diagnostics: [
        'An internal consistency check failed after generation — please try again.',
        ...finalCheck.classCollisions, ...finalCheck.teacherCollisions, ...finalCheck.roomCollisions,
      ],
    };
  }

  onProgress?.({ phase: 'done', message: 'Timetable successfully generated.', placed: bestEntries.length, total: totalPeriods });
  return {
    success: true,
    entries: bestEntries,
    unplaced: [],
    diagnostics: relaxed
      ? ['Generated by relaxing one soft preference (same-subject daily spacing or a teacher\'s daily lesson cap) so every required lesson could still be placed. No hard constraint was ever relaxed.']
      : [],
    feasibility,
    scoreBreakdown: bestScore,
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

/** Item 11 from the spec: summarize root causes instead of dumping a
 * repetitive line per lesson, and name the actual bottleneck. Shows the
 * worst-affected assignments first, caps the list, and always ends with
 * concrete next steps. */
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

  // Bottleneck classification: are the shortfalls concentrated on a
  // handful of teachers (teacher availability), a handful of classes
  // (insufficient periods for that class), or spread evenly (probably
  // just an overall shortage of periods)?
  const teacherCounts = new Map<string, number>();
  const gradeCounts = new Map<number, number>();
  unplaced.forEach(u => {
    teacherCounts.set(u.requirement.teacher_id, (teacherCounts.get(u.requirement.teacher_id) || 0) + 1);
    gradeCounts.set(u.requirement.grade_id, (gradeCounts.get(u.requirement.grade_id) || 0) + 1);
  });
  if (unplaced.length > 0) {
    const worstTeacher = [...teacherCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const worstGrade = [...gradeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (worstTeacher && worstTeacher[1] >= Math.ceil(unplaced.length * 0.5)) {
      lines.push(`Likely bottleneck: teacher availability — ${tn(worstTeacher[0])} alone accounts for ${worstTeacher[1]} of the ${unplaced.length} affected assignment(s).`);
    } else if (worstGrade && worstGrade[1] >= Math.ceil(unplaced.length * 0.5)) {
      lines.push(`Likely bottleneck: insufficient periods for ${gn(worstGrade[0])} — it alone accounts for ${worstGrade[1]} of the ${unplaced.length} affected assignment(s).`);
    } else {
      lines.push('Shortfalls are spread across several classes/teachers rather than one bottleneck — the school\'s overall period grid is likely too tight for the total lesson load.');
    }
  }

  lines.push('Recommended actions: add more teaching periods, increase teacher availability, reassign some subjects, or adjust lesson requirements.');
  return lines;
}

/** Bounded local search that runs once a hard-constraint-valid timetable
 * has already been found. Swaps pairs of single-period lessons only when
 * the swap (a) keeps every hard constraint satisfied and (b) strictly
 * reduces a soft-preference cost (same-subject-same-day repeats, a
 * teacher's daily lesson cap, Grade-9-style afternoon-teacher
 * clustering, free-period placement, morning/afternoon monotony,
 * same-period repetition, repeated daily subject-pair patterns, teacher
 * consecutive-run length). Never touches double periods, and any swap
 * that doesn't verifiably improve things is rolled back — this can only
 * make a valid timetable nicer, never invalid. */
interface LocalOptimizeOptions {
  rotationGradeIds?: Set<number>;
  rotationSubjectIds?: Set<number>;
  rotationTeacherIds?: Set<string>;
  afternoonStartTime?: string;
  freePeriodSubjectIds?: Set<number>;
  demandingSubjectIds?: Set<number>;
}

function localOptimize(
  entries: Entry[],
  periods: Period[],
  workingDays: Day[],
  maxLessonsPerDayPerTeacher: number | null,
  opts: LocalOptimizeOptions = {},
): Entry[] {
  const result = entries.map(e => ({ ...e }));
  const singles = result.filter(e => !e.is_double_period);
  if (singles.length < 2) return result;

  const periodById = new Map(periods.map(p => [p.id, p]));
  const lessonPeriodIds = new Set(periods.filter(p => p.period_type === 'lesson').map(p => p.id));
  const classKey = (e: Entry) => `${e.day}|${e.period_id}|${e.grade_id}`;
  const teacherKey = (e: Entry) => `${e.day}|${e.period_id}|${e.teacher_id}`;

  const lunchStart = computeLunchStart(periods);
  const dayPartOf = classifyDayParts(periods, workingDays, lunchStart);
  const isMorning = (e: Entry) => (periodById.get(e.period_id)?.start_time ?? '00:00:00') < lunchStart;

  const { rotationGradeIds, rotationSubjectIds, rotationTeacherIds, afternoonStartTime = '14:00:00', freePeriodSubjectIds, demandingSubjectIds } = opts;
  const rotationActive = !!(rotationGradeIds?.size && rotationSubjectIds?.size);
  const isRotationEntry = (e: Entry) =>
    rotationActive && rotationGradeIds!.has(e.grade_id) && rotationSubjectIds!.has(e.subject_id)
    && (!rotationTeacherIds || rotationTeacherIds.size === 0 || rotationTeacherIds.has(e.teacher_id));
  const isRotationAfternoon = (e: Entry) => (periodById.get(e.period_id)?.start_time ?? '') >= afternoonStartTime;
  const freePeriodActive = !!freePeriodSubjectIds?.size;
  const targetMorningRatio = (subjectId: number) => demandingSubjectIds?.has(subjectId) ? DEMANDING_TARGET_MORNING_RATIO : DEFAULT_TARGET_MORNING_RATIO;

  function cost(): number {
    let c = 0;
    const byClassDay = new Map<string, Map<number, number>>();
    const byTeacherDay = new Map<string, number>();
    for (const e of result) {
      const cdKey = `${e.grade_id}|${e.day}`;
      if (!byClassDay.has(cdKey)) byClassDay.set(cdKey, new Map());
      const subjMap = byClassDay.get(cdKey)!;
      subjMap.set(e.subject_id, (subjMap.get(e.subject_id) || 0) + 1);
      const tdKey = `${e.teacher_id}|${e.day}`;
      byTeacherDay.set(tdKey, (byTeacherDay.get(tdKey) || 0) + 1);
    }
    byClassDay.forEach(subjMap => subjMap.forEach(count => { if (count > 1) c += (count - 1) * 3; }));
    if (maxLessonsPerDayPerTeacher) {
      byTeacherDay.forEach(count => { if (count > maxLessonsPerDayPerTeacher) c += (count - maxLessonsPerDayPerTeacher) * 5; });
    }

    // Grade-9-style afternoon-rotation.
    if (rotationActive) {
      const byTeacherDayCount = new Map<string, number>();
      const byTeacherTotal = new Map<string, number>();
      const byTeacherDays = new Map<string, Set<Day>>();
      for (const e of result) {
        if (!isRotationEntry(e) || !isRotationAfternoon(e)) continue;
        const dayKey = `${e.teacher_id}|${e.day}`;
        byTeacherDayCount.set(dayKey, (byTeacherDayCount.get(dayKey) || 0) + 1);
        byTeacherTotal.set(e.teacher_id, (byTeacherTotal.get(e.teacher_id) || 0) + 1);
        if (!byTeacherDays.has(e.teacher_id)) byTeacherDays.set(e.teacher_id, new Set());
        byTeacherDays.get(e.teacher_id)!.add(e.day);
      }
      byTeacherDayCount.forEach(count => { if (count > 1) c += (count - 1) * 4; });
      byTeacherTotal.forEach((total, teacherId) => {
        const idealDays = Math.min(total, workingDays.length);
        const actualDays = byTeacherDays.get(teacherId)?.size ?? 0;
        if (actualDays < idealDays) c += (idealDays - actualDays) * 3;
      });
    }

    // Free/self-study periods: early morning is heavily penalized;
    // late-morning mildly; mid-morning and afternoon are free.
    if (freePeriodActive) {
      for (const e of result) {
        if (!freePeriodSubjectIds!.has(e.subject_id)) continue;
        const part = dayPartOf.get(`${e.day}|${e.period_id}`);
        if (part === 'early') c += 6;
        else if (part === 'late') c += 2;
      }
    }

    // No subject permanently confined to one part of the day — every
    // subject with >=3 weekly lessons that landed 100% morning or 100%
    // afternoon is penalized; demanding subjects (which are allowed a
    // lean, never a lock) get an extra penalty specifically for being
    // all-morning, since that's the exact pattern this rule exists to
    // break up.
    const byGradeSubject = new Map<string, { morning: number; afternoon: number; subjectId: number }>();
    for (const e of result) {
      const key = `${e.grade_id}|${e.subject_id}`;
      const rec = byGradeSubject.get(key) ?? { morning: 0, afternoon: 0, subjectId: e.subject_id };
      if (isMorning(e)) rec.morning++; else rec.afternoon++;
      byGradeSubject.set(key, rec);
    }
    byGradeSubject.forEach(rec => {
      const total = rec.morning + rec.afternoon;
      if (total < 3) return;
      if (rec.afternoon === 0) {
        c += total * 3;
        if (demandingSubjectIds?.has(rec.subjectId)) c += total * 3;
      } else if (rec.morning === 0) {
        c += total * 3;
      } else {
        // Even with both present, penalize drifting far from this
        // subject's own target ratio.
        const ratio = rec.morning / total;
        const target = targetMorningRatio(rec.subjectId);
        const drift = Math.max(0, Math.abs(ratio - target) - RATIO_NEUTRAL_BAND);
        c += Math.round(drift * total * 2);
      }
    });

    // Same-period repetition: a subject repeatedly landing on the exact
    // same period-of-day across different days.
    const byGradeSubjectPeriod = new Map<string, Map<number, number>>();
    for (const e of result) {
      const key = `${e.grade_id}|${e.subject_id}`;
      const idx = periodById.get(e.period_id)?.period_index ?? -1;
      const m = byGradeSubjectPeriod.get(key) ?? new Map<number, number>();
      m.set(idx, (m.get(idx) || 0) + 1);
      byGradeSubjectPeriod.set(key, m);
    }
    byGradeSubjectPeriod.forEach(m => m.forEach(count => { if (count > 1) c += (count - 1) * 3; }));

    // Repeated daily subject-pair patterns (e.g. "Pre-Tech → CRE"
    // showing up as adjacent lessons on several different days).
    const byGradeDayPairs = new Map<string, Day[]>(); // `${grade}|${subjA}|${subjB}` -> days seen on
    const byGradeDay = new Map<string, Entry[]>();
    for (const e of result) {
      const key = `${e.grade_id}|${e.day}`;
      if (!byGradeDay.has(key)) byGradeDay.set(key, []);
      byGradeDay.get(key)!.push(e);
    }
    byGradeDay.forEach((dayEntries, key) => {
      const [gradeStr, day] = key.split('|');
      const sorted = [...dayEntries].sort((a, b) => (periodById.get(a.period_id)?.period_index ?? 0) - (periodById.get(b.period_id)?.period_index ?? 0));
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i], b = sorted[i + 1];
        const aIdx = periodById.get(a.period_id)?.period_index ?? -999;
        const bIdx = periodById.get(b.period_id)?.period_index ?? -999;
        if (bIdx !== aIdx + 1) continue; // only truly adjacent periods count as a "pattern"
        const pairKey = `${gradeStr}|${a.subject_id}|${b.subject_id}`;
        if (!byGradeDayPairs.has(pairKey)) byGradeDayPairs.set(pairKey, []);
        byGradeDayPairs.get(pairKey)!.push(day as Day);
      }
    });
    byGradeDayPairs.forEach(days => { if (days.length > 1) c += (days.length - 1) * 4; });

    // Teacher consecutive-run length — long unbroken runs for one
    // teacher in a single day are penalized past a reasonable length.
    const byTeacherDayEntries = new Map<string, Entry[]>();
    for (const e of result) {
      const key = `${e.teacher_id}|${e.day}`;
      if (!byTeacherDayEntries.has(key)) byTeacherDayEntries.set(key, []);
      byTeacherDayEntries.get(key)!.push(e);
    }
    byTeacherDayEntries.forEach(dayEntries => {
      const sorted = [...dayEntries].sort((a, b) => (periodById.get(a.period_id)?.period_index ?? 0) - (periodById.get(b.period_id)?.period_index ?? 0));
      let run = 1;
      for (let i = 1; i < sorted.length; i++) {
        const prevIdx = periodById.get(sorted[i - 1].period_id)?.period_index ?? -999;
        const curIdx = periodById.get(sorted[i].period_id)?.period_index ?? -999;
        if (curIdx === prevIdx + 1) {
          run++;
          if (run > 3) c += (run - 3) * 2;
        } else run = 1;
      }
    });

    return c;
  }

  let currentCost = cost();
  if (currentCost === 0) return result;

  const classBusy = new Set(result.map(classKey));
  const teacherBusy = new Set(result.map(teacherKey));

  // Bias random pair selection toward entries the rules above actually
  // care about, so the bounded iteration budget isn't mostly spent on
  // swaps that can never move the needle.
  const bySubjectGradeCount = new Map<string, number>();
  singles.forEach(e => {
    const key = `${e.grade_id}|${e.subject_id}`;
    bySubjectGradeCount.set(key, (bySubjectGradeCount.get(key) || 0) + 1);
  });
  const priorityIndices: number[] = [];
  singles.forEach((e, idx) => {
    const isFree = freePeriodActive && freePeriodSubjectIds!.has(e.subject_id);
    const multiLesson = (bySubjectGradeCount.get(`${e.grade_id}|${e.subject_id}`) || 0) >= 2;
    if (isRotationEntry(e) || isFree || multiLesson) priorityIndices.push(idx);
  });
  const pickIndex = () => (priorityIndices.length > 0 && Math.random() < 0.65)
    ? priorityIndices[Math.floor(Math.random() * priorityIndices.length)]
    : Math.floor(Math.random() * singles.length);

  for (let iter = 0; iter < OPTIMIZE_ITERATIONS && currentCost > 0; iter++) {
    const i = pickIndex();
    const j = Math.floor(Math.random() * singles.length);
    if (i === j) continue;
    const a = singles[i], b = singles[j];
    if (a.day === b.day && a.period_id === b.period_id) continue;
    if (!lessonPeriodIds.has(a.period_id) || !lessonPeriodIds.has(b.period_id)) continue;

    const aOrig = { day: a.day, period_id: a.period_id };
    const bOrig = { day: b.day, period_id: b.period_id };

    classBusy.delete(classKey(a)); classBusy.delete(classKey(b));
    teacherBusy.delete(teacherKey(a)); teacherBusy.delete(teacherKey(b));

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

/* ── Timetable quality scoring ─────────────────────────────────────────
   Turns the same soft-preference ideas used during generation into a
   human-readable 0–100 breakdown, used to (a) pick the best of several
   generated candidates and (b) show a plain-language quality summary in
   the UI after generation. */
export function scoreTimetable(
  entries: Entry[],
  requirements: Requirement[],
  periods: Period[],
  workingDays: Day[],
  opts: {
    demandingSubjectIds?: Set<number>;
    freePeriodSubjectIds?: Set<number>;
    maxLessonsPerDayPerTeacher?: number | null;
    gradeName?: (id: number) => string;
    teacherName?: (id: string) => string;
    subjectName?: (id: number) => string;
  } = {},
): ScoreBreakdown {
  const gn = opts.gradeName ?? ((id: number) => `Class #${id}`);
  const tn = opts.teacherName ?? ((id: string) => `Teacher #${id.slice(0, 6)}`);
  const sn = opts.subjectName ?? ((id: number) => `Subject #${id}`);
  const notes: string[] = [];

  const check = validateTimetable(entries, requirements, gn, tn, sn);
  const conflictFree = check.isValid;
  if (!conflictFree) {
    return { total: 0, conflictFree: false, morningAfternoonBalance: 0, teacherWorkloadBalance: 0, freePeriodPlacement: 0, subjectDistribution: 0, notes: ['Conflicts were detected — this timetable is not usable.'] };
  }

  const periodById = new Map(periods.map(p => [p.id, p]));
  const lunchStart = computeLunchStart(periods);
  const dayPartOf = classifyDayParts(periods, workingDays, lunchStart);
  const isMorning = (e: Entry) => (periodById.get(e.period_id)?.start_time ?? '00:00:00') < lunchStart;

  // ── Morning/afternoon balance ──
  const byGS = new Map<string, { morning: number; afternoon: number; grade: number; subject: number }>();
  entries.forEach(e => {
    const key = `${e.grade_id}|${e.subject_id}`;
    const c = byGS.get(key) ?? { morning: 0, afternoon: 0, grade: e.grade_id, subject: e.subject_id };
    if (isMorning(e)) c.morning++; else c.afternoon++;
    byGS.set(key, c);
  });
  let monotoneGroups = 0, totalGroups = 0;
  byGS.forEach(c => {
    const total = c.morning + c.afternoon;
    if (total < 3) return;
    totalGroups++;
    if (c.morning === 0 || c.afternoon === 0) {
      monotoneGroups++;
      notes.push(`${sn(c.subject)} for ${gn(c.grade)} is scheduled entirely in the ${c.morning === 0 ? 'afternoon' : 'morning'}.`);
    }
  });
  const morningAfternoonBalance = totalGroups === 0 ? 100 : Math.round(100 * (1 - monotoneGroups / totalGroups));

  // ── Subject distribution (same-period repeats + repeated daily pairs) ──
  const byGSPeriod = new Map<string, Map<number, number>>();
  entries.forEach(e => {
    const key = `${e.grade_id}|${e.subject_id}`;
    const idx = periodById.get(e.period_id)?.period_index ?? -1;
    const m = byGSPeriod.get(key) ?? new Map<number, number>();
    m.set(idx, (m.get(idx) || 0) + 1);
    byGSPeriod.set(key, m);
  });
  let periodRepeats = 0, periodTotal = 0;
  byGSPeriod.forEach(m => {
    let total = 0; m.forEach(c => total += c);
    if (total < 2) return;
    periodTotal += total;
    m.forEach(c => { if (c > 1) periodRepeats += (c - 1); });
  });
  const byGradeDay = new Map<string, Entry[]>();
  entries.forEach(e => {
    const key = `${e.grade_id}|${e.day}`;
    if (!byGradeDay.has(key)) byGradeDay.set(key, []);
    byGradeDay.get(key)!.push(e);
  });
  const pairDays = new Map<string, Set<Day>>();
  byGradeDay.forEach((dayEntries, key) => {
    const gradeId = Number(key.split('|')[0]);
    const sorted = [...dayEntries].sort((a, b) => (periodById.get(a.period_id)?.period_index ?? 0) - (periodById.get(b.period_id)?.period_index ?? 0));
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      const aIdx = periodById.get(a.period_id)?.period_index ?? -999;
      const bIdx = periodById.get(b.period_id)?.period_index ?? -999;
      if (bIdx !== aIdx + 1) continue;
      const pairKey = `${gradeId}|${a.subject_id}|${b.subject_id}`;
      if (!pairDays.has(pairKey)) pairDays.set(pairKey, new Set());
      pairDays.get(pairKey)!.add(a.day);
    }
  });
  let repeatedPatternCount = 0;
  pairDays.forEach((days, pairKey) => {
    if (days.size > 1) {
      repeatedPatternCount++;
      const [gradeStr, subjA, subjB] = pairKey.split('|').map(Number);
      if (repeatedPatternCount <= 3) notes.push(`${gn(gradeStr)}: ${sn(subjA)} → ${sn(subjB)} repeats on ${days.size} different days.`);
    }
  });
  const periodRepeatScore = periodTotal === 0 ? 100 : Math.round(100 * (1 - periodRepeats / periodTotal));
  const patternScore = pairDays.size === 0 ? 100 : Math.round(100 * (1 - repeatedPatternCount / pairDays.size));
  const subjectDistribution = Math.round((periodRepeatScore + patternScore) / 2);

  // ── Teacher workload balance (daily cap + consecutive runs) ──
  const byTeacherDay = new Map<string, Entry[]>();
  entries.forEach(e => {
    const key = `${e.teacher_id}|${e.day}`;
    if (!byTeacherDay.has(key)) byTeacherDay.set(key, []);
    byTeacherDay.get(key)!.push(e);
  });
  let capViolations = 0, longRunDays = 0;
  const cap = opts.maxLessonsPerDayPerTeacher ?? null;
  byTeacherDay.forEach(dayEntries => {
    if (cap && dayEntries.length > cap) capViolations++;
    const sorted = [...dayEntries].sort((a, b) => (periodById.get(a.period_id)?.period_index ?? 0) - (periodById.get(b.period_id)?.period_index ?? 0));
    let run = 1, maxRun = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prevIdx = periodById.get(sorted[i - 1].period_id)?.period_index ?? -999;
      const curIdx = periodById.get(sorted[i].period_id)?.period_index ?? -999;
      run = curIdx === prevIdx + 1 ? run + 1 : 1;
      maxRun = Math.max(maxRun, run);
    }
    if (maxRun > 3) longRunDays++;
  });
  const teacherDayPairs = byTeacherDay.size || 1;
  const teacherWorkloadBalance = Math.max(0, Math.round(100 * (1 - (capViolations + longRunDays) / (2 * teacherDayPairs))));
  if (capViolations > 0) notes.push(`${capViolations} teacher-day(s) exceed the configured daily lesson cap.`);
  if (longRunDays > 0) notes.push(`${longRunDays} teacher-day(s) have a run of more than 3 consecutive lessons with no gap.`);

  // ── Free-period placement ──
  let freeScoreSum = 0, freeCount = 0;
  if (opts.freePeriodSubjectIds?.size) {
    entries.forEach(e => {
      if (!opts.freePeriodSubjectIds!.has(e.subject_id)) return;
      freeCount++;
      const part = dayPartOf.get(`${e.day}|${e.period_id}`);
      freeScoreSum += part === 'early' ? 0 : part === 'late' ? 60 : 100; // mid & afternoon = 100
    });
  }
  const freePeriodPlacement = freeCount === 0 ? 100 : Math.round(freeScoreSum / freeCount);
  if (freeCount > 0 && freePeriodPlacement < 70) notes.push('Several free/self-study periods are still landing in the first lesson periods of the day.');

  const total = Math.round(
    0.30 * morningAfternoonBalance +
    0.25 * subjectDistribution +
    0.25 * teacherWorkloadBalance +
    0.20 * freePeriodPlacement,
  );

  return { total, conflictFree, morningAfternoonBalance, teacherWorkloadBalance, freePeriodPlacement, subjectDistribution, notes };
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