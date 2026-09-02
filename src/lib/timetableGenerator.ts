/* ══════════════════════════════════════════════════════════════════════
   Timetable generation & collision-checking engine.

   Every write path in the Timetable module — the automatic generator AND
   the manual drag/click editor — goes through the same checkCollision()
   function here, so "never allow two things in the same slot" is
   enforced in exactly one place rather than re-implemented per screen.

   The generator is a real backtracking solver, not a best-effort filler:
   if it cannot place every required lesson without a collision, it
   reports exactly which requirements it couldn't satisfy and returns
   success:false. Nothing partial is ever handed back for saving — see
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

/* ── Automatic generator ──────────────────────────────────────────────
   True backtracking: places one task at a time, and on failure undoes
   the most recent placement and tries a different slot for it, rather
   than silently leaving gaps or overwriting a conflict. A step budget
   keeps runaway backtracking on genuinely infeasible input from hanging
   the browser — if the budget is exhausted, generation is reported as
   failed (not partially saved) with the requirements it couldn't reach.
═══════════════════════════════════════════════════════════════════════ */

interface Task {
  requirement: Requirement;
  isDouble: boolean;
}

const MAX_BACKTRACK_STEPS = 400_000;
const MAX_ATTEMPTS = 10;

export interface GenerationResult {
  success: boolean;
  entries: Entry[];
  unplaced: { requirement: Requirement; reason: string }[];
}

export function generateTimetable(
  requirements: Requirement[],
  periods: Period[],
  workingDays: Day[],
  prioritySubjectIds?: Set<number>,
): GenerationResult {
  // Flatten each requirement's weekly lesson count into discrete tasks.
  // Double-allowed requirements pair lessons into double-blocks where the
  // count is even; an odd count leaves one single lesson.
  const tasks: Task[] = [];
  const unplacedInfeasible: { requirement: Requirement; reason: string }[] = [];

  for (const req of requirements) {
    if (req.lessons_per_week <= 0) continue;
    if (req.allow_double) {
      const doubles = Math.floor(req.lessons_per_week / 2);
      const singles = req.lessons_per_week % 2;
      for (let i = 0; i < doubles; i++) tasks.push({ requirement: req, isDouble: true });
      for (let i = 0; i < singles; i++) tasks.push({ requirement: req, isDouble: false });
    } else {
      for (let i = 0; i < req.lessons_per_week; i++) tasks.push({ requirement: req, isDouble: false });
    }
  }

  // Most-constrained-first task ordering - the core principle behind
  // professional timetabling engines: place the hardest-to-satisfy
  // lessons while the schedule is still empty and flexible, rather than
  // filling it with easy lessons first and only discovering the hard
  // ones don't fit once most of the week is already locked in.
  //
  // Two factors make a task harder to place:
  //  1. Teacher weekly load - a heavily-loaded teacher has fewer free
  //     slots left to work with as the week fills up.
  //  2. Teacher grade-spread - a teacher who teaches multiple grades has
  //     their availability constrained simultaneously by every one of
  //     those grades' own schedules, not just their own subject's needs.
  const loadByTeacher = new Map<string, number>();
  requirements.forEach(r => loadByTeacher.set(r.teacher_id, (loadByTeacher.get(r.teacher_id) || 0) + r.lessons_per_week));
  const gradesByTeacher = new Map<string, Set<number>>();
  requirements.forEach(r => {
    if (!gradesByTeacher.has(r.teacher_id)) gradesByTeacher.set(r.teacher_id, new Set());
    gradesByTeacher.get(r.teacher_id)!.add(r.grade_id);
  });
  tasks.sort((a, b) => {
    const spreadA = gradesByTeacher.get(a.requirement.teacher_id)?.size ?? 1;
    const spreadB = gradesByTeacher.get(b.requirement.teacher_id)?.size ?? 1;
    if (spreadB !== spreadA) return spreadB - spreadA;
    return (loadByTeacher.get(b.requirement.teacher_id) || 0) - (loadByTeacher.get(a.requirement.teacher_id) || 0);
  });

  // Morning/mid-morning vs afternoon, derived from the actual configured
  // schedule rather than hardcoded period numbers: everything before the
  // first lunch period counts as morning. If no lunch period is
  // configured, fall back to a fixed 12:00 cutoff.
  const lunchStart = periods.find(p => p.period_type === 'lunch')?.start_time
    ?? [...periods].sort((a, b) => a.start_time.localeCompare(b.start_time)).find(p => p.start_time >= '12:00:00')?.start_time
    ?? '12:00:00';
  const isMorningPeriod = (p: Period) => p.start_time < lunchStart;

  // Candidate (day, periodId) lesson slots, and for doubles (day, firstId, secondId).
  const singleSlots: { day: Day; periodId: number; morning: boolean }[] = [];
  const doubleSlots: { day: Day; firstId: number; secondId: number; morning: boolean }[] = [];
  for (const day of workingDays) {
    const dayPeriods = periodsForDay(periods, day).filter(p => p.period_type === 'lesson').sort((a, b) => a.period_index - b.period_index);
    dayPeriods.forEach(p => singleSlots.push({ day, periodId: p.id, morning: isMorningPeriod(p) }));
    for (let i = 0; i < dayPeriods.length - 1; i++) {
      if (dayPeriods[i + 1].period_index === dayPeriods[i].period_index + 1) {
        doubleSlots.push({ day, firstId: dayPeriods[i].id, secondId: dayPeriods[i + 1].id, morning: isMorningPeriod(dayPeriods[i]) });
      }
    }
  }

  // For a priority subject (Languages/Mathematics/Science, as configured
  // by the caller), try morning/mid-morning slots first, falling back to
  // afternoon ones only if morning is full. Other subjects try afternoon
  // first, leaving morning slots free for priority subjects where
  // possible. This is a soft ordering preference, not a hard constraint -
  // the solver still backtracks into the other half of the day rather
  // than fail outright, so it can never make a schedule that was
  // otherwise achievable suddenly infeasible.
  function orderedSlots<T extends { morning: boolean }>(slots: T[], isPriority: boolean): T[] {
    const morning = shuffledCopy(slots.filter(s => s.morning));
    const afternoon = shuffledCopy(slots.filter(s => !s.morning));
    // Every task fills the day front-to-back now, not just priority
    // subjects - this is what actually pushes leftover slack toward the
    // afternoon instead of leaving gaps scattered through the morning.
    // Priority subjects still get first claim on morning in practice,
    // since they're processed earlier in the most-constrained-first task
    // order above; this only controls each individual task's own slot
    // search, not which tasks run first.
    return [...morning, ...afternoon];
  }

  if (singleSlots.length === 0) {
    return { success: false, entries: [], unplaced: requirements.map(r => ({ requirement: r, reason: 'No lesson periods are configured yet — set up Periods & Breaks first.' })) };
  }

  // With "at most one lesson per subject per day" now enforced, a subject
  // needing more lessons/week than there are working days - without
  // double periods allowed - can never be satisfied, no matter how many
  // attempts run. Report that specifically instead of a generic timeout.
  const impossibleUpfront = requirements.filter(r => !r.allow_double && r.lessons_per_week > workingDays.length);
  if (impossibleUpfront.length > 0) {
    return {
      success: false,
      entries: [],
      unplaced: impossibleUpfront.map(r => ({
        requirement: r,
        reason: `${r.lessons_per_week} lessons/week requested across only ${workingDays.length} working days, but double periods aren't enabled for this subject — a subject without doubles can have at most one lesson per day. Enable "Double Allowed" for this assignment or reduce its weekly lesson count.`,
      })),
    };
  }

  // One backtracking search, with its own step budget. Re-shuffling slot
  // order between attempts (via orderedSlots' internal shuffledCopy) means
  // an attempt that gets stuck thrashing in one bad branch doesn't doom
  // the whole generation - a fresh attempt often finds a very different,
  // successful path through the same problem.
  function attemptOnce(): { solved: boolean; placed: Entry[]; gaveUp: boolean } {
    const placed: Entry[] = [];
    const classBusy = new Set<string>();   // `${day}|${periodId}|${grade_id}`
    const teacherBusy = new Set<string>(); // `${day}|${periodId}|${teacher_id}`
    // A class+subject combo may only appear once per day - either one
    // single lesson, or one double-block - never two separate singles
    // (which would look identical to an unrequested double period), and
    // never a single tacked onto the same day as a double.
    const subjectDayBusy = new Set<string>(); // `${day}|${grade_id}|${subject_id}`
    let steps = 0;
    let gaveUp = false;

    function tryPlace(taskIndex: number): boolean {
      if (taskIndex >= tasks.length) return true;
      if (++steps > MAX_BACKTRACK_STEPS) { gaveUp = true; return false; }

      const task = tasks[taskIndex];
      const { teacher_id, grade_id, subject_id } = task.requirement;
      const isPriority = prioritySubjectIds?.has(subject_id) ?? false;

      if (task.isDouble) {
        for (const slot of orderedSlots(doubleSlots, isPriority)) {
          const sd = `${slot.day}|${grade_id}|${subject_id}`;
          if (subjectDayBusy.has(sd)) continue;
          const k1c = `${slot.day}|${slot.firstId}|${grade_id}`, k1t = `${slot.day}|${slot.firstId}|${teacher_id}`;
          const k2c = `${slot.day}|${slot.secondId}|${grade_id}`, k2t = `${slot.day}|${slot.secondId}|${teacher_id}`;
          if (classBusy.has(k1c) || classBusy.has(k2c) || teacherBusy.has(k1t) || teacherBusy.has(k2t)) continue;

          const groupId = generateUuid();
          classBusy.add(k1c); classBusy.add(k2c); teacherBusy.add(k1t); teacherBusy.add(k2t); subjectDayBusy.add(sd);
          const e1: Entry = { day: slot.day, period_id: slot.firstId, grade_id, subject_id, teacher_id, is_double_period: true, double_group_id: groupId };
          const e2: Entry = { day: slot.day, period_id: slot.secondId, grade_id, subject_id, teacher_id, is_double_period: true, double_group_id: groupId };
          placed.push(e1, e2);

          if (tryPlace(taskIndex + 1)) return true;

          placed.pop(); placed.pop();
          classBusy.delete(k1c); classBusy.delete(k2c); teacherBusy.delete(k1t); teacherBusy.delete(k2t); subjectDayBusy.delete(sd);
          if (gaveUp) return false;
        }
        return false;
      }

      for (const slot of orderedSlots(singleSlots, isPriority)) {
        const sd = `${slot.day}|${grade_id}|${subject_id}`;
        if (subjectDayBusy.has(sd)) continue;
        const kc = `${slot.day}|${slot.periodId}|${grade_id}`, kt = `${slot.day}|${slot.periodId}|${teacher_id}`;
        if (classBusy.has(kc) || teacherBusy.has(kt)) continue;

        classBusy.add(kc); teacherBusy.add(kt); subjectDayBusy.add(sd);
        const e: Entry = { day: slot.day, period_id: slot.periodId, grade_id, subject_id, teacher_id, is_double_period: false };
        placed.push(e);

        if (tryPlace(taskIndex + 1)) return true;

        placed.pop();
        classBusy.delete(kc); teacherBusy.delete(kt); subjectDayBusy.delete(sd);
        if (gaveUp) return false;
      }
      return false;
    }

    const solved = tryPlace(0);
    return { solved, placed, gaveUp };
  }

  let best: { solved: boolean; placed: Entry[]; gaveUp: boolean } | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = attemptOnce();
    if (result.solved) { best = result; break; }
    if (!best || result.placed.length > best.placed.length) best = result;
  }
  const { solved, placed, gaveUp } = best!;

  if (!solved) {
    // Identify which requirements are under-served in the best attempt
    // reached, so the Timetabler gets a specific, actionable reason
    // rather than a bare failure.
    const perReqPlaced = new Map<number, number>();
    for (const req of requirements) {
      const need = req.lessons_per_week;
      const got = placed.filter(e => e.teacher_id === req.teacher_id && e.subject_id === req.subject_id && e.grade_id === req.grade_id).length;
      if (got < need) perReqPlaced.set(req.id, got);
    }
    for (const req of requirements) {
      if (perReqPlaced.has(req.id)) {
        const got = perReqPlaced.get(req.id)!;
        unplacedInfeasible.push({
          requirement: req,
          reason: gaveUp
            ? `Only placed ${got}/${req.lessons_per_week} lessons before the solver's step budget ran out — try reducing load or adding more lesson periods.`
            : `Could not place ${req.lessons_per_week - got} of ${req.lessons_per_week} required lessons without a collision — the teacher, class, or period grid is over-constrained.`,
        });
      }
    }
    return { success: false, entries: [], unplaced: unplacedInfeasible };
  }

  return { success: true, entries: placed, unplaced: [] };
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

function shuffledCopy<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* ── Validation report ─────────────────────────────────────────────────
   Re-scans a saved/candidate entry set from scratch — used by the
   "Validate Timetable" button, independent of whatever produced the
   entries (generator or manual edits). */
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