/* Run with:  npm run test:kjj   (uses tsx, already a devDependency) */
import assert from 'node:assert/strict';
import {
  getKjjLevel, getKjjPoints, computeKjjTotals, rankByKjjTotal, competitionRanks,
  resolveSubjectSet, formatKjjTotal, formatKjjCoverage, subjectMarkAcrossExams,
  getExpectedSubjectCount, KJJ_RUBRIC, buildKjjRanking, countRanked,
} from './kjj';
import { buildClassKjjRankings, positionText, toMark } from './kjjRankings';

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${(e as Error).message}`); process.exitCode = 1; }
};

const S9 = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
// A mark (percentage) that earns exactly p points
const MARK_FOR: Record<number, number> = { 8: 95, 7: 80, 6: 65, 5: 50, 4: 35, 3: 25, 2: 15, 1: 5 };
const marksFromPoints = (pts: number[], ids = S9) =>
  Object.fromEntries(ids.map((id, i) => [id, MARK_FOR[pts[i]]]));

console.log('Rubric boundaries');
test('every boundary maps to the right code and points', () => {
  const cases: [number, string, number][] = [
    [100, 'EE1', 8], [90, 'EE1', 8], [89, 'EE2', 7], [75, 'EE2', 7], [74, 'ME1', 6], [58, 'ME1', 6],
    [57, 'ME2', 5], [41, 'ME2', 5], [40, 'AE1', 4], [31, 'AE1', 4], [30, 'AE2', 3], [21, 'AE2', 3],
    [20, 'BE1', 2], [11, 'BE1', 2], [10, 'BE2', 1], [0, 'BE2', 1],
  ];
  for (const [m, code, pts] of cases) {
    assert.equal(getKjjLevel(m).code, code, `${m}% code`);
    assert.equal(getKjjPoints(m), pts, `${m}% points`);
  }
  assert.equal(KJJ_RUBRIC.length, 8);
});
test('decimals are rounded to the nearest whole percent first', () => {
  assert.equal(getKjjPoints(89.6), 8); // rounds to 90
  assert.equal(getKjjPoints(89.4), 7); // rounds to 89
});

console.log('Totals (never divided by subject count)');
test('nine subjects with 8 points each = 72/72', () => {
  const t = computeKjjTotals(marksFromPoints([8, 8, 8, 8, 8, 8, 8, 8, 8]), S9);
  assert.equal(t.total, 72); assert.equal(t.max, 72); assert.equal(formatKjjTotal(t), '72/72');
});
test('nine subjects with 1 point each = 9/72', () => {
  const t = computeKjjTotals(marksFromPoints([1, 1, 1, 1, 1, 1, 1, 1, 1]), S9);
  assert.equal(t.total, 9); assert.equal(formatKjjTotal(t), '9/72');
});
test('8,7,6,5,4,3,2,1,8 = 44/72', () => {
  const t = computeKjjTotals(marksFromPoints([8, 7, 6, 5, 4, 3, 2, 1, 8]), S9);
  assert.equal(t.total, 44); assert.equal(formatKjjTotal(t), '44/72');
});
test('a different subject count uses n × 8 as the maximum (6 → /48)', () => {
  const ids = S9.slice(0, 6);
  const t = computeKjjTotals(marksFromPoints([7, 7, 7, 7, 7, 6], ids), ids);
  assert.equal(t.total, 41); assert.equal(t.max, 48); assert.equal(formatKjjTotal(t), '41/48');
});

console.log('Missing marks vs genuine zero');
test('a genuine 0 scores 1 point and is NOT missing', () => {
  const m = marksFromPoints([8, 8, 8, 8, 8, 8, 8, 8, 8]); m['9'] = 0;
  const t = computeKjjTotals(m, S9);
  assert.equal(t.total, 8 * 8 + 1); assert.equal(t.assessed, 9); assert.equal(t.complete, true);
});
test('null / undefined / NaN marks are excluded from the total', () => {
  const m: Record<string, number | null | undefined> = marksFromPoints([8, 8, 8, 8, 8, 8, 8, 8, 8]);
  m['7'] = null; m['8'] = undefined; delete m['9'];
  const t = computeKjjTotals(m, S9);
  assert.equal(t.total, 48); assert.equal(t.assessed, 6); assert.equal(t.missing, 3);
  assert.equal(t.complete, false); assert.equal(t.maxAssessed, 48);
  assert.equal(formatKjjTotal(t), '48/48'); assert.equal(formatKjjCoverage(t), '6 of 9 subjects assessed');
  assert.equal(computeKjjTotals({ '1': NaN }, ['1']).assessed, 0);
});
test('no marks at all = DNS', () => {
  const t = computeKjjTotals({}, S9); assert.equal(t.dns, true); assert.equal(formatKjjTotal(t), '—');
});

console.log('Ranking');
const mk = (name: string, pts: number[]) => ({ name, kjj: computeKjjTotals(marksFromPoints(pts), S9) });
test('ranks by TOTAL points, highest first', () => {
  const r = rankByKjjTotal([
    mk('low', [1, 1, 1, 1, 1, 1, 1, 1, 1]), mk('high', [8, 8, 8, 8, 8, 8, 8, 8, 8]), mk('mid', [8, 7, 6, 5, 4, 3, 2, 1, 8]),
  ]);
  assert.deepEqual(r.map(x => [x.name, x.rank]), [['high', 1], ['mid', 2], ['low', 3]]);
});
test('competition ranking: ties share a rank and the next rank skips (1,2,2,4)', () => {
  const r = rankByKjjTotal([
    mk('a', [8, 8, 8, 8, 8, 8, 8, 8, 8]), mk('b', [7, 7, 7, 7, 7, 7, 7, 7, 7]),
    mk('c', [7, 7, 7, 7, 7, 7, 7, 7, 7]), mk('d', [6, 6, 6, 6, 6, 6, 6, 6, 6]),
  ]);
  assert.deepEqual(r.map(x => x.rank), [1, 2, 2, 4]);
  assert.deepEqual(competitionRanks([10, 10, 10, 7, 7, 3]), [1, 1, 1, 4, 4, 6]);
});
test('equal totals tie even when raw marks differ (no silent mark tie-breaker)', () => {
  const a = { name: 'a', kjj: computeKjjTotals(Object.fromEntries(S9.map(id => [id, 90])), S9) };  // 72
  const b = { name: 'b', kjj: computeKjjTotals(Object.fromEntries(S9.map(id => [id, 100])), S9) }; // 72
  assert.deepEqual(rankByKjjTotal([a, b]).map(x => x.rank), [1, 1]);
});
test('mean points are not used: total decides, not average of points', () => {
  // 9 subjects × 7 pts = 63 beats 8 subjects × 8 pts + 1 missing = 64? (64 > 63 but incomplete → unranked)
  const full = mk('full', [7, 7, 7, 7, 7, 7, 7, 7, 7]);
  const partialM = marksFromPoints([8, 8, 8, 8, 8, 8, 8, 8, 8]); delete partialM['9'];
  const partial = { name: 'partial', kjj: computeKjjTotals(partialM, S9) };
  const r = rankByKjjTotal([partial, full]);
  assert.equal(r[0].name, 'full'); assert.equal(r[0].rank, 1);
  assert.equal(r[1].name, 'partial'); assert.equal(r[1].rank, null); assert.equal(r[1].rankStatus, 'incomplete');
});
test('incomplete learners are listed after ranked ones, unranked; DNS last', () => {
  const dns = { name: 'dns', kjj: computeKjjTotals({}, S9) };
  const pm = marksFromPoints([8, 8, 8, 8, 8, 8, 8, 8, 8]); delete pm['1'];
  const inc = { name: 'inc', kjj: computeKjjTotals(pm, S9) };
  const r = rankByKjjTotal([dns, inc, mk('ok', [1, 1, 1, 1, 1, 1, 1, 1, 1])]);
  assert.deepEqual(r.map(x => [x.name, x.rank, x.rankStatus]),
    [['ok', 1, 'ranked'], ['inc', null, 'incomplete'], ['dns', null, 'dns']]);
});
test('tied ranks are unaffected by incomplete learners', () => {
  const pm = marksFromPoints([8, 8, 8, 8, 8, 8, 8, 8, 8]); delete pm['1'];
  const r = rankByKjjTotal([mk('x', [5, 5, 5, 5, 5, 5, 5, 5, 5]), { name: 'inc', kjj: computeKjjTotals(pm, S9) }, mk('y', [5, 5, 5, 5, 5, 5, 5, 5, 5])]);
  assert.deepEqual(r.filter(x => x.rank !== null).map(x => x.rank), [1, 1]);
});

console.log('Subject configuration & multi-exam');
test('subject set honours the configured grade band, not a forced 9', () => {
  assert.equal(getExpectedSubjectCount('Grade 7'), 9);
  assert.equal(getExpectedSubjectCount('Grade 5'), 6);
  assert.equal(getExpectedSubjectCount('Grade 2'), 0);
  const g5 = resolveSubjectSet(['1', '2', '3', '4', '5', '6'], 'Grade 5');
  assert.equal(g5.maxPoints, 48); assert.equal(g5.note, null);
  const g2 = resolveSubjectSet(['1', '2', '3', '4', '5', '6', '7'], 'Grade 2');
  assert.equal(g2.maxPoints, 56); assert.equal(g2.note, null); // no band configured → use the subjects that have marks
  const g7 = resolveSubjectSet(S9, 'Grade 7');
  assert.equal(g7.maxPoints, 72); assert.equal(g7.note, null);
});
test('mismatch between data and configuration is reported, never silently forced', () => {
  assert.match(resolveSubjectSet(['1', '2', '3'], 'Grade 8').note ?? '', /Only 3 of the 9/);
  assert.match(resolveSubjectSet([...S9, '10', '11'], 'Grade 8').note ?? '', /11 subjects have marks/);
});
test('multi-exam subject mark = sum ÷ exams selected (missing exam counts 0)', () => {
  assert.equal(subjectMarkAcrossExams([60], 3), 20);
  assert.equal(subjectMarkAcrossExams([60, 80, 70], 3), 70);
  assert.equal(subjectMarkAcrossExams([], 3), null);
  assert.equal(subjectMarkAcrossExams([0], 1), 0); // genuine zero stays a mark
});

console.log('buildKjjRanking (shared entry point)');
test('builds totals + ranks from raw marks and counts ranked learners', () => {
  const r = buildKjjRanking([
    { item: 'A', marks: marksFromPoints([8, 7, 6, 5, 4, 3, 2, 1, 8]) },
    { item: 'B', marks: marksFromPoints([8, 8, 8, 8, 8, 8, 8, 8, 8]) },
    { item: 'C', marks: { '1': 95 } },
    { item: 'D', marks: {} },
  ], S9);
  assert.deepEqual(r.map(x => [x.item, x.kjj.total, x.rank]), [['B', 72, 1], ['A', 44, 2], ['C', 8, null], ['D', 0, null]]);
  assert.equal(countRanked(r), 2);
});

console.log('Results-table ranking (Reports page: class rankings, report cards, exports)');
{
  const G7 = { grade_id: 7, grades: { grade_name: 'Grade 7' } };
  const G8 = { grade_id: 8, grades: { grade_name: 'Grade 8' } };
  const studentsRaw = [
    { id: 1, name: 'Amina',  admission_number: 'A1', ...G7 },
    { id: 2, name: 'Brian',  admission_number: 'A2', ...G7 },
    { id: 3, name: 'Chebet', admission_number: 'A3', ...G7 },
    { id: 4, name: 'Dennis', admission_number: 'A4', ...G7 },
    { id: 5, name: 'Esther', admission_number: 'A5', ...G7 },
    { id: 6, name: 'Faith',  admission_number: 'B1', ...G8 },
    { id: 7, name: 'Gideon', admission_number: 'B2', ...G8 },
  ];
  const fromPoints = (studentId: number, pts: number[]) =>
    pts.map((p, i) => ({ student_id: studentId, subject_id: i + 1, marks: MARK_FOR[p] }));
  const results: any[] = [
    ...fromPoints(1, [8, 8, 8, 8, 8, 8, 8, 8, 8]),                 // 72/72
    ...fromPoints(2, [8, 7, 6, 5, 4, 3, 2, 1, 8]),                 // 44/72
    // Chebet earns the same 44 points from DIFFERENT raw marks (must tie with Brian)
    ...[90, 75, 58, 41, 31, 21, 11, 0, 100].map((m, i) => ({ student_id: 3, subject_id: i + 1, marks: m })),
    // Dennis: subject 8 is null and subject 9 is absent → incomplete (7 of 9)
    ...fromPoints(4, [8, 8, 8, 8, 8, 8, 8]), { student_id: 4, subject_id: 8, marks: null },
    // Esther: genuine zero in subject 9 earns 1 point and is NOT missing
    ...fromPoints(5, [8, 8, 8, 8, 8, 8, 8, 8]), { student_id: 5, subject_id: 9, marks: 0 },
    // Grade 8 is ranked on its own (6-subject) set, separately from Grade 7
    ...[95, 80, 65, 50, 35, 25].map((m, i) => ({ student_id: 6, subject_id: i + 1, marks: m })), // 33/48
    ...[95, 95, 95, 95, 95, 95].map((m, i) => ({ student_id: 7, subject_id: i + 1, marks: m })), // 48/48
  ];
  const { rows, notes } = buildClassKjjRankings(results, studentsRaw);
  const by = (id: number) => rows.find(r => r.student_id === id)!;

  test('Grade 7 totals and ranks use total KJJ points (72, 65, 44, 44)', () => {
    assert.equal(formatKjjTotal(by(1).kjj), '72/72'); assert.equal(by(1).rank, 1);
    assert.equal(formatKjjTotal(by(5).kjj), '65/72'); assert.equal(by(5).rank, 2);
    assert.equal(formatKjjTotal(by(2).kjj), '44/72'); assert.equal(by(2).rank, 3);
    assert.equal(formatKjjTotal(by(3).kjj), '44/72'); assert.equal(by(3).rank, 3); // tie, no mark tie-break
    assert.equal(by(1).rankedInGrade, 4);
  });
  test('a genuine zero scores 1 point and the learner stays ranked', () => {
    assert.equal(by(5).kjj.assessed, 9); assert.equal(by(5).kjj.complete, true); assert.equal(by(5).kjj.total, 8 * 8 + 1);
  });
  test('null / missing marks are excluded, shown as partial coverage and NOT ranked', () => {
    const d = by(4);
    assert.equal(d.rank, null); assert.equal(d.rankStatus, 'incomplete');
    assert.equal(d.kjj.total, 56); assert.equal(d.kjj.assessed, 7);
    assert.equal(formatKjjTotal(d.kjj), '56/56'); assert.equal(formatKjjCoverage(d.kjj), '7 of 9 subjects assessed');
    assert.equal(positionText(d), 'Not ranked (incomplete)');
  });
  test('each grade is ranked on its own subject set (Grade 8: 48/48 then 33/48)', () => {
    assert.equal(formatKjjTotal(by(7).kjj), '48/48'); assert.equal(by(7).rank, 1);
    assert.equal(formatKjjTotal(by(6).kjj), '33/48'); assert.equal(by(6).rank, 2);
    assert.equal(by(7).rankedInGrade, 2);
    assert.ok(notes.some(n => /Grade 8/.test(n) && /Only 6 of the 9/.test(n)));
    assert.ok(!notes.some(n => /Grade 7/.test(n)));
  });
  test('position text for report cards', () => {
    assert.equal(positionText(by(1)), '1 of 4'); assert.equal(positionText(by(3)), '3 of 4'); assert.equal(positionText(undefined), '—');
  });
  test('toMark: null / "" are missing; 0 and "0" are genuine marks', () => {
    assert.equal(toMark(null), null); assert.equal(toMark(undefined), null); assert.equal(toMark(''), null);
    assert.equal(toMark(0), 0); assert.equal(toMark('0'), 0); assert.equal(toMark('abc'), null);
  });
  test('screen, PDF and Excel all read the same row objects (same totals everywhere)', () => {
    const screen = rows.map(r => [r.student_id, r.rank, formatKjjTotal(r.kjj)]);
    const exported = rows.map(r => [r.student_id, r.rank, `${r.kjj.total}/${r.kjj.complete ? r.kjj.max : r.kjj.maxAssessed}`]);
    assert.deepEqual(screen, exported);
  });
}

console.log(`\n${passed} tests passed${process.exitCode ? ' — FAILURES ABOVE' : ''}`);
