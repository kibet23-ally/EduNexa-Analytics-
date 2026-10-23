/* Results-table ranking used by the Reports page (class rankings, report-card
   position, bulk report cards, PDF and Excel). Pure functions — no React —
   built entirely on the shared KJJ logic in ./kjj. */
import {
  getKjjLevel, isValidMark, resolveSubjectSet, buildKjjRanking, countRanked,
  KJJ_MAX_POINTS_PER_SUBJECT, type KjjTotals, type KjjRankStatus,
} from "./kjj";

const cbcGrade = (s: number) => getKjjLevel(s).code;

export interface RankingRow {
  student_id: number;
  student_name: string;
  admission_number: string;
  class_name: string;
  kjj: KjjTotals;            // TOTAL KJJ points (the ranking basis)
  rank: number | null;       // competition rank; null = not ranked (incomplete / DNS)
  rankStatus: KjjRankStatus;
  rankedInGrade: number;     // number of ranked learners in this learner's grade
  average: number;           // mean subject % — reference only, never used to rank
  grade: string;             // level of that average — reference only
}

/* A results.marks value is a real mark only if it is a finite number;
   null / "" are MISSING (Number(null) would wrongly become a genuine 0). */
export const toMark = (v: any): number | null =>
  v === null || v === undefined || v === "" ? null : (isValidMark(Number(v)) ? Number(v) : null);

/* ───────────────────────────────────────────────────────────
   buildClassKjjRankings — the single ranking routine for this page
   (on-screen table, PDF, Excel, report-card position, bulk cards).
   Learners are ranked WITHIN THEIR OWN GRADE by TOTAL KJJ points.
   Rules live in ../lib/kjj: only learners assessed in all included subjects
   are ranked; missing marks are excluded from the total (a genuine 0 = 1
   point); ties use competition ranking; nothing is divided by the number of
   subjects. If a subject has several rows for one learner in the same
   term/year, the mean of those rows is that subject's mark.
─────────────────────────────────────────────────────────── */
export function buildClassKjjRankings(results: any[], studentsRaw: any[]): { rows: RankingRow[]; notes: string[] } {
  const stById = new Map<number, any>();
  studentsRaw.forEach(st => stById.set(st.id, st));
  const byGrade = new Map<string, any[]>();
  results.forEach(r => {
    const gid = String(stById.get(r.student_id)?.grade_id ?? "none");
    if (!byGrade.has(gid)) byGrade.set(gid, []);
    byGrade.get(gid)!.push(r);
  });
  const rows: RankingRow[] = [];
  const notes: string[] = [];
  byGrade.forEach(rs => {
    const gradeName: string = stById.get(rs[0].student_id)?.grades?.grade_name ?? "";
    const valid = rs.filter(r => toMark(r.marks) !== null);
    const set = resolveSubjectSet(valid.map(r => r.subject_id), gradeName);
    if (set.note) notes.push(`${gradeName || "Grade"}: ${set.note}`);
    const scores = new Map<string, number[]>();
    valid.forEach(r => {
      const k = `${r.student_id}|${r.subject_id}`;
      if (!scores.has(k)) scores.set(k, []);
      scores.get(k)!.push(toMark(r.marks) as number);
    });
    const ids = [...new Set(rs.map(r => r.student_id as number))];
    const entries = ids.map(id => {
      const marks: Record<string, number | null> = {};
      set.subjectIds.forEach(sid => {
        const arr = scores.get(`${id}|${sid}`);
        marks[sid] = arr?.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      });
      return { item: id, marks };
    });
    const ranked = buildKjjRanking(entries, set.subjectIds);
    const rankedCount = countRanked(ranked);
    ranked.forEach(r => {
      const vals = set.subjectIds.map(sid => r.marks[sid]).filter(isValidMark);
      const average = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
      const st = stById.get(r.item);
      rows.push({
        student_id: r.item, student_name: st?.name ?? "—", admission_number: st?.admission_number ?? "—",
        class_name: gradeName, kjj: r.kjj, rank: r.rank, rankStatus: r.rankStatus,
        rankedInGrade: rankedCount, average, grade: cbcGrade(average),
      });
    });
  });
  return { rows, notes };
}

export const RANKING_POLICY_LINES = [
  `Ranking = TOTAL KJJ points (EE1=8 … BE2=1, maximum ${KJJ_MAX_POINTS_PER_SUBJECT} per subject), highest first; not divided by the number of subjects. Equal totals share a rank (1, 2, 2, 4).`,
  "Learners with missing subject marks show their partial total and are not ranked; DNS = did not sit. Average (%) is for reference only.",
];

/* Position text used on every report card */
export const positionText = (r?: RankingRow) =>
  !r ? "—" : r.rank !== null ? `${r.rank} of ${r.rankedInGrade}` : r.rankStatus === "dns" ? "DNS" : "Not ranked (incomplete)";
