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
 * label to show in each cell (or '' for an empty lesson slot). */
function drawGrid(
  doc: any, startY: number, meta: GridMeta,
  cellFor: (day: Day, period: Period) => string,
) {
  // Use the widest day's period set as the column template — schools with
  // per-day overrides still get one consistent header row, with any
  // periods absent on a given day left blank rather than misaligned.
  const templatePeriods = periodsForDay(meta.allPeriods, meta.workingDays[0])
    .sort((a, b) => a.period_index - b.period_index);

  const head = [['Day', ...templatePeriods.map(p => `${p.label}\n${p.start_time.slice(0, 5)}-${p.end_time.slice(0, 5)}`)]];
  const body = meta.workingDays.map(day => {
    const dayPeriods = periodsForDay(meta.allPeriods, day).sort((a, b) => a.period_index - b.period_index);
    return [
      DAY_LABELS[day],
      ...templatePeriods.map(tp => {
        const p = dayPeriods.find(dp => dp.period_index === tp.period_index) || tp;
        if (p.period_type !== 'lesson') return p.period_type.toUpperCase();
        return cellFor(day, p) || '';
      }),
    ];
  });

  autoTable(doc, {
    ...PDF_TABLE_THEME,
    startY,
    head,
    body,
    styles: { ...PDF_TABLE_THEME.styles, fontSize: 7, halign: 'center', valign: 'middle' },
    headStyles: { ...PDF_TABLE_THEME.headStyles, halign: 'center', fontSize: 6.5 },
    columnStyles: { 0: { fontStyle: 'bold', halign: 'left' } },
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
