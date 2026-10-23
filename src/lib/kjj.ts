/* ══════════════════════════════════════════════════════════════════════════
   KJJ POINTS — the single source of truth for rubric levels, points,
   totals and ranking. Every page, PDF and Excel export MUST use this file.

   RUBRIC
     90–100% EE1 = 8     75–89% EE2 = 7     58–74% ME1 = 6     41–57% ME2 = 5
     31–40%  AE1 = 4     21–30% AE2 = 3     11–20% BE1 = 2      0–10% BE2 = 1

   RANKING RULES
   1. Each valid subject mark → KJJ points via the rubric.
   2. TOTAL KJJ POINTS = sum of those points. NEVER divided by the number of
      subjects. Rank = highest total first. Raw marks / average % are not used
      to rank and are not used as a silent tie-breaker.
   3. Maximum possible = (subjects included) × 8. Nine subjects → 9…72.
      The subject count comes from the configured grade band (or, when no
      band is configured, from the subjects that actually have marks) — it is
      never forced to 9.
   4. A missing mark (null / undefined / not a number) is EXCLUDED from the
      total. A genuine 0 is a real mark and earns 1 point.
   5. COVERAGE POLICY (consistent everywhere): only learners assessed in ALL
      subjects included in the ranking are ranked against each other.
      Learners with missing marks are listed with their partial total, the
      number of subjects assessed and the maximum for those subjects, but are
      NOT given a rank (they would otherwise be compared unfairly).
      Learners with no marks at all are "DNS" (did not sit).
   6. Ties use competition ranking: 1, 2, 2, 4.
   ══════════════════════════════════════════════════════════════════════════ */

export const KJJ_MAX_POINTS_PER_SUBJECT = 8;

export interface KjjLevel {
  code: 'EE1' | 'EE2' | 'ME1' | 'ME2' | 'AE1' | 'AE2' | 'BE1' | 'BE2';
  label: string;
  min: number;
  max: number;
  points: number;
}

export const KJJ_RUBRIC: readonly KjjLevel[] = [
  { min: 90, max: 100, code: 'EE1', label: 'Exceeding Expectations 1',   points: 8 },
  { min: 75, max: 89,  code: 'EE2', label: 'Exceeding Expectations 2',   points: 7 },
  { min: 58, max: 74,  code: 'ME1', label: 'Meeting Expectations 1',     points: 6 },
  { min: 41, max: 57,  code: 'ME2', label: 'Meeting Expectations 2',     points: 5 },
  { min: 31, max: 40,  code: 'AE1', label: 'Approaching Expectations 1', points: 4 },
  { min: 21, max: 30,  code: 'AE2', label: 'Approaching Expectations 2', points: 3 },
  { min: 11, max: 20,  code: 'BE1', label: 'Below Expectations 1',       points: 2 },
  { min: 0,  max: 10,  code: 'BE2', label: 'Below Expectations 2',       points: 1 },
];

/** A mark is valid only if it is a finite number. 0 IS valid. */
export function isValidMark(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Percentage → rubric level. The percentage is rounded to the nearest whole
 * number first (the rubric bands are whole-number ranges, so e.g. 89.6 would
 * otherwise fall between EE2 and EE1) and clamped to 0–100.
 */
export function getKjjLevel(score: number): KjjLevel {
  const s = Math.min(100, Math.max(0, Math.round(Number(score) || 0)));
  return KJJ_RUBRIC.find(r => s >= r.min && s <= r.max) ?? KJJ_RUBRIC[KJJ_RUBRIC.length - 1];
}

export const getKjjPoints = (score: number): number => getKjjLevel(score).points;

/* ─── Configured subject count per grade band (CBC Kenya) ─────────────────
 * Grades 4–6 (Upper Primary): 6 subjects · Grades 7–9 (Junior Secondary): 9.
 * 0 = no configured band → use the subjects that actually have marks.      */
export function getExpectedSubjectCount(gradeName: string): number {
  const gradeNum = parseInt((gradeName || '').match(/\d+/)?.[0] || '0', 10);
  if (gradeNum >= 4 && gradeNum <= 6) return 6;
  if (gradeNum >= 7 && gradeNum <= 9) return 9;
  return 0;
}

/* ─── Which subjects are included in a ranking ───────────────────────────── */
export interface KjjSubjectSet {
  subjectIds: string[];        // subjects included (each worth up to 8 points)
  configuredCount: number;     // configured grade-band count, 0 if none
  maxPoints: number;           // subjectIds.length × 8
  note: string | null;         // set when the data disagrees with the configuration
}

/**
 * @param subjectIdsWithMarks ids of subjects that have ≥1 valid mark in the
 *        group being ranked (already limited to the right grade/exam).
 * @param gradeName used to look up the configured subject count.
 */
export function resolveSubjectSet(subjectIdsWithMarks: Iterable<string | number>, gradeName = ''): KjjSubjectSet {
  const subjectIds = [...new Set([...subjectIdsWithMarks].map(String))];
  const configuredCount = getExpectedSubjectCount(gradeName);
  let note: string | null = null;
  if (configuredCount > 0 && subjectIds.length > 0 && subjectIds.length !== configuredCount) {
    note = subjectIds.length < configuredCount
      ? `Only ${subjectIds.length} of the ${configuredCount} configured subjects have marks so far; totals are out of ${subjectIds.length * KJJ_MAX_POINTS_PER_SUBJECT}.`
      : `${subjectIds.length} subjects have marks but ${gradeName || 'this grade'} is configured for ${configuredCount}; all ${subjectIds.length} are included and totals are out of ${subjectIds.length * KJJ_MAX_POINTS_PER_SUBJECT}.`;
  }
  return { subjectIds, configuredCount, maxPoints: subjectIds.length * KJJ_MAX_POINTS_PER_SUBJECT, note };
}

/* ─── Per-learner totals ─────────────────────────────────────────────────── */
export interface KjjTotals {
  total: number;          // TOTAL KJJ points (never a mean)
  assessed: number;       // subjects with a valid mark
  included: number;       // subjects included in the ranking
  max: number;            // included × 8
  maxAssessed: number;    // assessed × 8
  complete: boolean;      // assessed === included (and included > 0)
  dns: boolean;           // no valid marks at all
  missing: number;        // included − assessed
}

/** marksBySubject: subjectId → percentage (null/undefined = not entered). */
export function computeKjjTotals(
  marksBySubject: Record<string, number | null | undefined>,
  subjectIds: readonly string[],
): KjjTotals {
  let total = 0;
  let assessed = 0;
  for (const sid of subjectIds) {
    const v = marksBySubject[sid];
    if (isValidMark(v)) { total += getKjjPoints(v); assessed++; }
  }
  const included = subjectIds.length;
  return {
    total, assessed, included,
    max: included * KJJ_MAX_POINTS_PER_SUBJECT,
    maxAssessed: assessed * KJJ_MAX_POINTS_PER_SUBJECT,
    complete: included > 0 && assessed === included,
    dns: assessed === 0,
    missing: included - assessed,
  };
}

/**
 * One subject's mark across several selected exams: the sum of the recorded
 * scores divided by the number of exams selected (an exam without a mark
 * counts as zero for that subject). null when there is no recorded score.
 * With a single exam this is just that exam's score.
 */
export function subjectMarkAcrossExams(scores: readonly unknown[], examCount: number): number | null {
  const valid = scores.filter(isValidMark);
  if (!valid.length || examCount <= 0) return null;
  return valid.reduce((a, b) => a + b, 0) / examCount;
}

/* ─── Ranking ────────────────────────────────────────────────────────────── */
export type KjjRankStatus = 'ranked' | 'incomplete' | 'dns';

/** Competition ranking (1, 2, 2, 4) for values ALREADY sorted high → low. */
export function competitionRanks(sortedDesc: readonly number[]): number[] {
  const out: number[] = [];
  sortedDesc.forEach((v, i) => out.push(i > 0 && v === sortedDesc[i - 1] ? out[i - 1] : i + 1));
  return out;
}

/**
 * Sorts and ranks. Order: ranked learners (total ↓), then incomplete
 * learners (total ↓, no rank), then DNS. Ties keep input order.
 */
export function rankByKjjTotal<T extends { kjj: KjjTotals }>(rows: readonly T[]):
  (T & { rank: number | null; rankStatus: KjjRankStatus })[] {
  const status = (r: T): KjjRankStatus => r.kjj.dns ? 'dns' : r.kjj.complete ? 'ranked' : 'incomplete';
  const order = { ranked: 0, incomplete: 1, dns: 2 } as const;
  const sorted = [...rows].sort((a, b) =>
    order[status(a)] - order[status(b)] || b.kjj.total - a.kjj.total);
  const rankedTotals = sorted.filter(r => status(r) === 'ranked').map(r => r.kjj.total);
  const ranks = competitionRanks(rankedTotals);
  let ri = 0;
  return sorted.map(r => {
    const st = status(r);
    return { ...r, rankStatus: st, rank: st === 'ranked' ? ranks[ri++] : null };
  });
}

/**
 * The one entry point every page uses: marks → totals → ranked rows.
 * `entries[].marks` maps subjectId → percentage (null/undefined = not entered).
 */
export function buildKjjRanking<T>(
  entries: readonly { item: T; marks: Record<string, number | null | undefined> }[],
  subjectIds: readonly string[],
) {
  return rankByKjjTotal(entries.map(e => ({ ...e, kjj: computeKjjTotals(e.marks, subjectIds) })));
}

/** Number of learners holding a rank (the "of N" shown beside a position). */
export const countRanked = (rows: readonly { rank: number | null }[]) => rows.filter(r => r.rank !== null).length;

/* ─── Display helpers (keep every screen / PDF / Excel identical) ────────── */
/** "58/72" for complete learners; "44/56" (points / max of subjects assessed) otherwise. */
export function formatKjjTotal(k: KjjTotals): string {
  if (k.dns) return '—';
  return `${k.total}/${k.complete ? k.max : k.maxAssessed}`;
}

/** "7 of 9 subjects assessed" for incomplete learners, '' otherwise. */
export function formatKjjCoverage(k: KjjTotals): string {
  if (k.dns || k.complete) return '';
  return `${k.assessed} of ${k.included} subjects assessed`;
}

/** Rank cell text: "1", "—" (incomplete) or "DNS". */
export function formatKjjRank(rank: number | null, status: KjjRankStatus): string {
  return status === 'dns' ? 'DNS' : rank === null ? '—' : String(rank);
}
