import autoTable from 'jspdf-autotable';
import {
  createPdfDoc, drawPdfHeader, finalizePdf, PDF_TABLE_THEME, PDF_CONTENT_X,
} from './pdfKit';
import { Day, DAY_LABELS, Period, Entry, periodsForDay } from './timetableGenerator';

interface GridMeta {
  schoolName: string;
  academicYear: number;
  term: number;
  workingDays: Day[];
  allPeriods: Period[];
}

/** Draws one days-vertical/periods-horizontal grid onto the current page
 * of `doc`, starting at `startY`. `cellFor(day, period)` supplies the
 * label to show in each lesson cell (or '' for a free slot).
 *
 * Non-lesson periods (break/lunch/games/assembly/activity) that read
 * identically for every working day are merged into a single cell
 * spanning the whole week, instead of repeating the same word on every
 * row — a day-specific override (e.g. Assembly only on Monday and
 * Friday) naturally breaks that run and is shown on its own days only,
 * since the merge only happens where the content is genuinely identical. */
function drawGrid(
  doc: any, startY: number, meta: GridMeta,
  cellFor: (day: Day, period: Period) => string,
) {
  // Union of every period_index that appears on any working day (a
  // day-specific override can introduce a period_index the default grid
  // doesn't have, though normally they match).
  const allIndexes = [...new Set(meta.workingDays.flatMap(d => periodsForDay(meta.allPeriods, d).map(p => p.period_index)))].sort((a, b) => a - b);
  const templatePeriods = allIndexes.map(idx => {
    // Prefer the default (day-independent) period for the header label —
    // falls back to whichever day actually has it if there's no default.
    return periodsForDay(meta.allPeriods, meta.workingDays[0]).find(p => p.period_index === idx)
      || meta.workingDays.map(d => periodsForDay(meta.allPeriods, d).find(p => p.period_index === idx)).find(Boolean)!;
  });

  const head = [['Day', ...templatePeriods.map(p => `${p.label}\n${p.start_time.slice(0, 5)}-${p.end_time.slice(0, 5)}`)]];

  // Matrix of raw cell content per [day][periodColumn], plus whether that
  // period is a lesson slot on that specific day (mixed lesson/non-lesson
  // per column is possible with day overrides, e.g. Assembly on Mon/Fri
  // but a real lesson Tue-Thu).
  const matrix = meta.workingDays.map(day => {
    const dayPeriods = periodsForDay(meta.allPeriods, day);
    return templatePeriods.map(tp => {
      const p = dayPeriods.find(dp => dp.period_index === tp.period_index) || tp;
      const isLesson = p.period_type === 'lesson';
      return { text: isLesson ? (cellFor(day, p) || '') : p.period_type.toUpperCase(), isLesson };
    });
  });

  // For each period column, merge vertical runs of identical non-lesson
  // text across consecutive working days into one spanning cell.
  const rowSpanAt = new Map<string, number>(); // `${dayIdx}|${colIdx}` -> span length
  const skip = new Set<string>();              // cells covered by a previous row's span
  for (let col = 0; col < templatePeriods.length; col++) {
    let row = 0;
    while (row < matrix.length) {
      const cell = matrix[row][col];
      if (cell.isLesson) { row++; continue; }
      let runEnd = row;
      while (runEnd + 1 < matrix.length && !matrix[runEnd + 1][col].isLesson && matrix[runEnd + 1][col].text === cell.text) {
        runEnd++;
      }
      const span = runEnd - row + 1;
      if (span > 1) {
        rowSpanAt.set(`${row}|${col}`, span);
        for (let r = row + 1; r <= runEnd; r++) skip.add(`${r}|${col}`);
      }
      row = runEnd + 1;
    }
  }

  const body = meta.workingDays.map((day, rowIdx) => {
    const cells: any[] = [DAY_LABELS[day]];
    templatePeriods.forEach((tp, col) => {
      if (skip.has(`${rowIdx}|${col}`)) return; // covered by a rowSpan above — omit entirely
      const span = rowSpanAt.get(`${rowIdx}|${col}`);
      const text = matrix[rowIdx][col].text;
      cells.push(span ? { content: text, rowSpan: span, styles: { valign: 'middle' } } : text);
    });
    return cells;
  });

  // Even column widths that fill the full usable page width, rather than
  // autoTable's default content-fit sizing (which crams a 13+ period grid
  // into unreadably narrow, uneven columns).
  const pageWidth = doc.internal.pageSize.width;
  const usableWidth = pageWidth - PDF_CONTENT_X * 2;
  const dayColWidth = 24;
  const periodColWidth = (usableWidth - dayColWidth) / templatePeriods.length;
  const columnStyles: Record<number, any> = { 0: { fontStyle: 'bold', halign: 'left', cellWidth: dayColWidth } };
  templatePeriods.forEach((_, i) => { columnStyles[i + 1] = { cellWidth: periodColWidth }; });

  autoTable(doc, {
    ...PDF_TABLE_THEME,
    startY,
    head,
    body,
    styles: { ...PDF_TABLE_THEME.styles, fontSize: 7.5, halign: 'center', valign: 'middle', cellPadding: 1.8 },
    headStyles: { ...PDF_TABLE_THEME.headStyles, halign: 'center', fontSize: 6.5 },
    columnStyles,
    tableWidth: usableWidth,
  });
}

export function exportClassTimetablePdf(
  gradeName: string, entries: Entry[], meta: GridMeta,
  subjectCode: (id: number) => string, teacherInitials: (id: string) => string,
) {
  const doc = createPdfDoc('l');
  const startY = drawPdfHeader(doc, {
    schoolName: meta.schoolName,
    title: `${gradeName} Timetable`,
    subtitle: `Academic Year ${meta.academicYear} · Term ${meta.term}`,
    meta: [`Generated: ${new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}`],
  });
  drawGrid(doc, startY, meta, (day, period) => {
    const e = entries.find(x => x.day === day && x.period_id === period.id);
    if (!e) return '';
    return `${subjectCode(e.subject_id)}\n${teacherInitials(e.teacher_id)}`;
  });
  finalizePdf(doc);
  doc.save(`Timetable_${gradeName.replace(/\s+/g, '_')}.pdf`);
}

export function exportTeacherTimetablePdf(
  teacherName: string, entries: Entry[], meta: GridMeta,
  subjectCode: (id: number) => string, gradeShort: (id: number) => string,
) {
  const doc = createPdfDoc('l');
  const startY = drawPdfHeader(doc, {
    schoolName: meta.schoolName,
    title: `Teacher Timetable — ${teacherName}`,
    subtitle: `Academic Year ${meta.academicYear} · Term ${meta.term}`,
    meta: [`Generated: ${new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}`],
  });
  drawGrid(doc, startY, meta, (day, period) => {
    const e = entries.find(x => x.day === day && x.period_id === period.id);
    if (!e) return 'FREE';
    return `${gradeShort(e.grade_id)}\n${subjectCode(e.subject_id)}`;
  });
  finalizePdf(doc);
  doc.save(`Teacher_Timetable_${teacherName.replace(/\s+/g, '_')}.pdf`);
}

/** One page per class, all drawn from the same master entry set — so this
 * can never disagree with the individual class/teacher exports. */
export function exportMasterTimetablePdf(
  grades: { id: number; grade_name: string }[],
  entries: Entry[], meta: GridMeta,
  subjectCode: (id: number) => string, teacherInitials: (id: string) => string,
) {
  const doc = createPdfDoc('l');
  grades.forEach((g, i) => {
    if (i > 0) doc.addPage('l');
    const startY = drawPdfHeader(doc, {
      schoolName: meta.schoolName,
      title: `Master Timetable — ${g.grade_name}`,
      subtitle: `Academic Year ${meta.academicYear} · Term ${meta.term}`,
      meta: i === 0 ? [`Generated: ${new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}`] : undefined,
    });
    const gradeEntries = entries.filter(e => e.grade_id === g.id);
    drawGrid(doc, startY, meta, (day, period) => {
      const e = gradeEntries.find(x => x.day === day && x.period_id === period.id);
      if (!e) return '';
      return `${subjectCode(e.subject_id)}\n${teacherInitials(e.teacher_id)}`;
    });
  });
  finalizePdf(doc);
  doc.save(`Master_Timetable_${meta.academicYear}_T${meta.term}.pdf`);
}
