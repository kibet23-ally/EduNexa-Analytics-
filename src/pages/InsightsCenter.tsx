import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../useAuth';

/* ─── CBC Kenya Grading Rubric (8 levels) ───────────────────────────────────── */
const RUBRIC = [
  { min: 90, max: 100, code: 'EE1', label: 'Exceeding Expectations 1', pts: 8, color: '#15803d', bg: '#dcfce7', text: '#14532d' },
  { min: 75, max: 89,  code: 'EE2', label: 'Exceeding Expectations 2', pts: 7, color: '#16a34a', bg: '#d1fae5', text: '#065f46' },
  { min: 58, max: 74,  code: 'ME1', label: 'Meeting Expectations 1',   pts: 6, color: '#2563eb', bg: '#dbeafe', text: '#1e40af' },
  { min: 41, max: 57,  code: 'ME2', label: 'Meeting Expectations 2',   pts: 5, color: '#0ea5e9', bg: '#e0f2fe', text: '#075985' },
  { min: 31, max: 40,  code: 'AE1', label: 'Approaching Expectations 1', pts: 4, color: '#d97706', bg: '#fef3c7', text: '#92400e' },
  { min: 21, max: 30,  code: 'AE2', label: 'Approaching Expectations 2', pts: 3, color: '#f59e0b', bg: '#fffbeb', text: '#78350f' },
  { min: 11, max: 20,  code: 'BE1', label: 'Below Expectations 1',     pts: 2, color: '#dc2626', bg: '#fee2e2', text: '#991b1b' },
  { min: 0,  max: 10,  code: 'BE2', label: 'Below Expectations 2',     pts: 1, color: '#991b1b', bg: '#fecaca', text: '#7f1d1d' },
];
const getRubric = (score: number) => RUBRIC.find(r => score >= r.min && score <= r.max) || RUBRIC[RUBRIC.length - 1];
const getRemarks = (avg: number) => {
  if (avg >= 90) return { teacher: 'Excellent performance. Congratulations! Keep It Up!', principal: 'Outstanding work! You are an example to your peers. Keep excelling!' };
  if (avg >= 75) return { teacher: 'Very good performance. Congratulations! Meeting expectation.', principal: 'Excellent work! Congratulations. Keep It Up!' };
  if (avg >= 58) return { teacher: 'Good performance. Keep working hard to improve further.', principal: 'Good work. Continue putting in the effort to reach higher levels.' };
  if (avg >= 41) return { teacher: 'Fair performance. More effort is needed in several areas.', principal: 'Satisfactory progress. Encourage the learner to work harder.' };
  if (avg >= 31) return { teacher: 'Below average. Learner needs to put in extra effort.', principal: 'More effort needed. Please support the learner at home.' };
  return { teacher: 'Needs urgent improvement. Remedial support is recommended.', principal: 'Urgent attention required. Please meet the class teacher.' };
};

/* ─── Types ──────────────────────────────────────────────────────────────────── */
interface School { id: any; name: string; logo_url?: string; motto?: string; address?: string; phone?: string; email?: string; website?: string; }
interface Grade { id: string; grade_name: string; school_id: any; }
interface Subject { id: string; subject_name: string; subject_code: string; school_id: any; }
interface Exam { id: string; exam_name: string; term: string; year: number; school_id: any; grade_id?: string; is_school_wide: boolean; }
interface Student { id: string; name: string; admission_number: string; gender: string; grade_id: string; school_id: any; }
interface Mark { id: string; student_id: string; subject_id: string; exam_id: string; score: number; school_id: any; teacher_remark?: string; grade_id: string; teacher_id?: string; }
interface AttendanceRecord { id: string; school_id: any; student_id: string; grade_id: string; date: string; status: string; }

/* ─── Logo fetcher ───────────────────────────────────────────────────────────── */
async function fetchLogo(url: string): Promise<{ data: string; fmt: 'PNG' | 'JPEG' } | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const fmt: 'PNG' | 'JPEG' = blob.type.includes('png') ? 'PNG' : 'JPEG';
    const data: string = await new Promise((resolve, reject) => {
      const fr = new FileReader(); fr.onload = () => resolve(fr.result as string); fr.onerror = reject; fr.readAsDataURL(blob);
    });
    return { data, fmt };
  } catch { return null; }
}

/* ─── Shared PDF letterhead ─────────────────────────────────────────────────── */
function drawPDFHeader(
  doc: jsPDF,
  school: School | undefined,
  logo: { data: string; fmt: 'PNG' | 'JPEG' } | null,
  title: string,
  landscape = false,
) {
  const W = doc.internal.pageSize.width;
  const M = 14;

  // Navy header
  doc.setFillColor(0, 32, 96);
  doc.rect(0, 0, W, 30, 'F');

  // Gold stripe
  doc.setFillColor(234, 179, 8);
  doc.rect(0, 30, W, 2, 'F');

  // Logo — left
  if (logo) {
    try { doc.addImage(logo.data, logo.fmt, M, 4, 22, 22); } catch { /* noop */ }
  } else {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(M, 4, 22, 22, 2, 2, 'F');
    doc.setTextColor(0, 32, 96); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text((school?.name || 'S')[0].toUpperCase(), M + 11, 18, { align: 'center' });
  }

  // Photo placeholder — right (portrait only)
  if (!landscape) {
    doc.setFillColor(200, 210, 220);
    doc.rect(W - M - 22, 4, 22, 22, 'F');
    doc.setDrawColor(150, 165, 200); doc.setLineWidth(0.3);
    doc.rect(W - M - 22, 4, 22, 22, 'S');
    doc.setTextColor(100, 120, 150); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
    doc.text('PHOTO', W - M - 11, 16, { align: 'center' });
  }

  // School name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15); doc.setFont('helvetica', 'bold');
  doc.text((school?.name || 'SCHOOL').toUpperCase(), W / 2, 11, { align: 'center' });

  // Contacts
  const contacts = [school?.address, school?.phone, school?.email].filter(Boolean).join('   |   ');
  if (contacts) {
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 200, 230);
    doc.text(contacts, W / 2, 17, { align: 'center' });
  }

  // Motto
  if (school?.motto) {
    doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(253, 224, 71);
    doc.text(`"${school.motto}"`, W / 2, 23, { align: 'center' });
  }

  // Title band
  doc.setFillColor(255, 255, 255); doc.setDrawColor(0, 32, 96); doc.setLineWidth(0.5);
  doc.rect(M, 35, W - M * 2, 8, 'FD');
  doc.setTextColor(0, 32, 96); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), W / 2, 40.5, { align: 'center' });
}

function drawPDFFooter(doc: jsPDF, school: School | undefined) {
  const W = doc.internal.pageSize.width;
  const H = doc.internal.pageSize.height;
  doc.setDrawColor(0, 32, 96); doc.setLineWidth(0.3);
  doc.line(14, H - 9, W - 14, H - 9);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(100, 116, 139);
  doc.text(`${school?.name || ''} • Generated by EduNexa Analytics`, 14, H - 5);
  doc.text(new Date().toLocaleDateString('en-KE', { dateStyle: 'full' }), W - 14, H - 5, { align: 'right' });
}

/* ─── PDF: Report Card ───────────────────────────────────────────────────────── */
async function generateReportCard(params: {
  school: School | undefined;
  logo: { data: string; fmt: 'PNG' | 'JPEG' } | null;
  student: Student & { rank?: number; totalStudents?: number };
  grade: Grade | undefined;
  exam: Exam | undefined;
  year: string; term: string;
  subjectMarks: { subject_name: string; subject_code: string; score: number; teacher_remark?: string }[];
  att: { total: number; present: number; absent: number; late: number; rate: number };
}) {
  const { school, logo, student, grade, exam, year, term, subjectMarks, att } = params;
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = doc.internal.pageSize.width;
  const M = 14;

  drawPDFHeader(doc, school, logo, 'LEARNER ASSESSMENT REPORT CARD');

  // ── Student Details ──
  doc.setFillColor(240, 245, 255);
  doc.rect(M, 46, W - M * 2, 20, 'F');
  doc.setDrawColor(180, 195, 220); doc.setLineWidth(0.2);
  doc.rect(M, 46, W - M * 2, 20, 'S');

  // Section heading
  doc.setFillColor(0, 32, 96);
  doc.rect(M, 46, W - M * 2, 5, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
  doc.text("LEARNER'S OFFICIAL DETAILS", M + 2, 49.5);

  doc.setFontSize(7.5); doc.setTextColor(0, 0, 0);
  const c1 = M + 2, c2 = M + 62, c3 = M + 118;
  const r1 = 56, r2 = 61;

  const lbl = (t: string, x: number, y: number) => { doc.setFont('helvetica', 'bold'); doc.text(t, x, y); };
  const val = (t: string, x: number, y: number) => { doc.setFont('helvetica', 'normal'); doc.text(t, x, y); };

  lbl('NAME:', c1, r1); val(student.name.toUpperCase(), c1 + 13, r1);
  lbl('ADM NO:', c2, r1); val(student.admission_number, c2 + 16, r1);
  lbl('GRADE:', c3, r1); val(grade?.grade_name?.toUpperCase() || '-', c3 + 13, r1);

  lbl('STREAM:', c1, r2); val(grade?.grade_name || '-', c1 + 15, r2);
  lbl('TERM:', c2, r2); val(term || exam?.term || 'All Terms', c2 + 11, r2);
  lbl('YEAR:', c3, r2); val(year, c3 + 10, r2);

  lbl('GENDER:', c1, 66); val(student.gender?.toUpperCase() || '-', c1 + 15, 66);
  lbl('EXAM:', c2, 66); val(exam?.exam_name || 'All Exams', c2 + 11, 66);

  // ── Marks Table ──
  if (subjectMarks.length === 0) {
    doc.setTextColor(120, 130, 150); doc.setFontSize(9); doc.setFont('helvetica', 'italic');
    doc.text('No marks recorded for this student with current filters.', W / 2, 90, { align: 'center' });
  } else {
    autoTable(doc, {
      startY: 70,
      head: [['SUBJECT', 'MID', 'AVG', 'PL', 'PTS', 'PERFORMANCE LEVEL', 'TEACHER']],
      body: subjectMarks.map(m => {
        const r = getRubric(m.score);
        return [m.subject_name, m.score, m.score, r.code, r.pts, r.label, m.teacher_remark || '—'];
      }),
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, lineColor: [180, 195, 220], lineWidth: 0.2 },
      headStyles: { fillColor: [0, 32, 96], textColor: [253, 224, 71], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
      alternateRowStyles: { fillColor: [247, 250, 255] },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 11, halign: 'center' },
        2: { cellWidth: 11, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: 9,  halign: 'center' },
        5: { cellWidth: 53 },
        6: { cellWidth: 30 },
      },
    });

    const fy = (doc as any).lastAutoTable.finalY;
    const totalScore = subjectMarks.reduce((a, b) => a + b.score, 0);
    const avg = totalScore / subjectMarks.length;
    const avgR = getRubric(avg);
    const remarks = getRemarks(avg);

    // Overall summary row
    doc.setFillColor(230, 235, 245);
    doc.rect(M, fy + 0.5, W - M * 2, 7, 'F');
    doc.setDrawColor(180, 195, 220); doc.setLineWidth(0.2);
    doc.rect(M, fy + 0.5, W - M * 2, 7, 'S');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0, 32, 96);
    doc.text(`OVERALL AVG: ${avg.toFixed(0)}%`, M + 4, fy + 5.5);
    doc.text(`P.LEVEL: ${avgR.code}`, M + 70, fy + 5.5);
    doc.text(`RANK: ${student.rank || '-'} / ${student.totalStudents || '-'}`, M + 130, fy + 5.5);

    // Performance chart
    const chartStartY = fy + 11;
    const chartH = 30;
    const chartW = W - M * 2;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0, 32, 96);
    doc.text('Subject Performance Overview (%)', W / 2, chartStartY + 3, { align: 'center' });

    doc.setDrawColor(180, 195, 220); doc.setLineWidth(0.2);
    doc.rect(M, chartStartY + 5, chartW, chartH, 'S');

    // Y-axis gridlines
    doc.setFontSize(5.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 130, 150);
    [0, 20, 40, 60, 80, 100].forEach(v => {
      const y = chartStartY + 5 + chartH - (v / 100 * chartH);
      doc.text(String(v), M - 1, y + 1, { align: 'right' });
      doc.setDrawColor(215, 220, 230); doc.setLineWidth(0.1);
      doc.line(M, y, M + chartW, y);
    });

    if (subjectMarks.length > 0) {
      const spacing = chartW / (subjectMarks.length + 1);
      const pts = subjectMarks.map((m, i) => ({
        x: M + spacing * (i + 1),
        y: chartStartY + 5 + chartH - (Math.min(m.score, 100) / 100 * chartH),
        score: m.score,
        name: m.subject_name.length > 10 ? m.subject_name.substring(0, 10) : m.subject_name,
      }));

      doc.setDrawColor(0, 82, 204); doc.setLineWidth(0.7);
      for (let i = 0; i < pts.length - 1; i++) doc.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);

      pts.forEach(p => {
        doc.setFillColor(0, 82, 204); doc.circle(p.x, p.y, 1.3, 'F');
        doc.setFontSize(5); doc.setTextColor(0, 0, 0);
        doc.text(p.name, p.x, chartStartY + 5 + chartH + 4.5, { align: 'center' });
      });
    }

    // Attendance bar
    const attY = chartStartY + chartH + 13;
    doc.setFillColor(232, 240, 255);
    doc.rect(M, attY, W - M * 2, 7, 'F');
    doc.setDrawColor(0, 82, 204); doc.setLineWidth(0.2);
    doc.rect(M, attY, W - M * 2, 7, 'S');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(0, 32, 96);
    doc.text(
      `ATTENDANCE:   Sessions: ${att.total}   Present: ${att.present}   Absent: ${att.absent}   Late: ${att.late}   Rate: ${att.rate}%`,
      W / 2, attY + 5, { align: 'center' },
    );

    // Remarks
    const remY = attY + 10;
    const halfW = (W - M * 2 - 3) / 2;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(180, 195, 220); doc.setLineWidth(0.3);
    doc.rect(M, remY, halfW, 28, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0);
    doc.text("Class Teacher's Comment", M + 3, remY + 6);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(50, 60, 80);
    doc.text(remarks.teacher, M + 3, remY + 12, { maxWidth: halfW - 5 });
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
    doc.line(M + 3, remY + 22, M + halfW - 4, remY + 22);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(0, 0, 0);
    doc.text('Name: ____________________', M + 3, remY + 27);

    doc.setFillColor(255, 255, 255);
    doc.rect(M + halfW + 3, remY, halfW, 28, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0);
    doc.text("Principal's Comment", M + halfW + 6, remY + 6);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(50, 60, 80);
    doc.text(remarks.principal, M + halfW + 6, remY + 12, { maxWidth: halfW - 5 });
    doc.line(M + halfW + 6, remY + 22, M + W - M - 4, remY + 22);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(0, 0, 0);
    doc.text('Name: ____________________', M + halfW + 6, remY + 27);

    // Term / fee grid
    const feeY = remY + 31;
    doc.setDrawColor(180, 195, 220); doc.setLineWidth(0.2);
    doc.rect(M, feeY, W - M * 2, 16, 'S');
    doc.line(W / 2, feeY, W / 2, feeY + 16);
    doc.line(M, feeY + 8, W - M, feeY + 8);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(0, 0, 0);
    doc.text('Term Closed On:', M + 3, feeY + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }), M + 34, feeY + 5.5);
    doc.setFont('helvetica', 'bold'); doc.text('Next Term Begins On:', W / 2 + 3, feeY + 5.5);
    doc.setFont('helvetica', 'normal'); doc.text('—', W / 2 + 45, feeY + 5.5);

    doc.setFont('helvetica', 'bold'); doc.text('Fee Balance: Ksh. 0.00', M + 3, feeY + 13);
    doc.setFont('helvetica', 'bold'); doc.text('Next Term Fee Payable: Ksh. 0.00', W / 2 + 3, feeY + 13);

    const totY = feeY + 16;
    doc.setFillColor(235, 240, 250);
    doc.rect(M, totY, W - M * 2, 6, 'F');
    doc.rect(M, totY, W - M * 2, 6, 'S');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0, 32, 96);
    doc.text('Total Fee To Pay Next Term: Ksh. 0.00', W / 2, totY + 4.5, { align: 'center' });

    // Authenticity notice
    const notY = totY + 9;
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(0, 32, 96);
    doc.text(
      'This Assessment ReportCard has been issued without alteration. Any alteration invalidates its authenticity.',
      W / 2, notY, { align: 'center' },
    );
  }

  drawPDFFooter(doc, school);
  doc.save(`ReportCard_${student.name.replace(/\s+/g, '_')}_${year}.pdf`);
}

/* ─── PDF: Rankings + Subject Analysis (Landscape A4) ───────────────────────── */
async function generateRankingsPDF(params: {
  school: School | undefined;
  logo: { data: string; fmt: 'PNG' | 'JPEG' } | null;
  gradeName: string; examName: string; year: string; term: string;
  rankings: (Student & { rank: number; avg: number; total: number; subjects: number })[];
  subjects: Subject[];
  marks: Mark[];
}) {
  const { school, logo, gradeName, examName, year, term, rankings, subjects, marks } = params;
  const doc = new jsPDF('l', 'mm', 'a4'); // landscape
  const W = doc.internal.pageSize.width;
  const M = 14;

  drawPDFHeader(doc, school, logo, `RANKINGS & SUBJECT ANALYSIS — ${gradeName}`, true);

  // Summary strip
  const allScores = marks.map(m => m.score);
  const classAvg = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
  const passRate = allScores.length ? allScores.filter(s => s >= 41).length / allScores.length * 100 : 0;
  const classR = getRubric(classAvg);

  doc.setFillColor(232, 240, 255);
  doc.rect(M, 46, W - M * 2, 8, 'F');
  doc.setDrawColor(0, 32, 96); doc.setLineWidth(0.2);
  doc.rect(M, 46, W - M * 2, 8, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0, 32, 96);
  doc.text(
    `${gradeName}  •  ${examName}  •  Year ${year}  •  ${term || 'All Terms'}  •  Students: ${rankings.length}  •  Class Mean: ${classAvg.toFixed(1)}%  •  PL: ${classR.code}  •  Pass Rate: ${passRate.toFixed(0)}%`,
    W / 2, 51.5, { align: 'center' },
  );

  // ── Subject Analysis Table (left column) ──
  const leftW = (W - M * 2) * 0.42;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(0, 32, 96);
  doc.text('SUBJECT PERFORMANCE ANALYSIS', M, 61);

  const subjRows = subjects.map(subj => {
    const sm = marks.filter(m => m.subject_id === subj.id);
    if (!sm.length) return null;
    const a = sm.reduce((x, b) => x + b.score, 0) / sm.length;
    const r = getRubric(a);
    const pass = sm.filter(m => m.score >= 41).length / sm.length * 100;
    return [subj.subject_name, sm.length, a.toFixed(1) + '%', r.code, r.pts, pass.toFixed(0) + '%'];
  }).filter(Boolean);

  autoTable(doc, {
    startY: 63,
    head: [['Learning Area', 'N', 'Mean', 'PL', 'Pts', 'Pass%']],
    body: subjRows as any,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.8, lineColor: [180, 195, 220], lineWidth: 0.2 },
    headStyles: { fillColor: [0, 32, 96], textColor: [253, 224, 71], fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [247, 250, 255] },
    tableWidth: leftW,
    columnStyles: {
      0: { cellWidth: leftW * 0.42 },
      1: { cellWidth: leftW * 0.1, halign: 'center' },
      2: { cellWidth: leftW * 0.14, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: leftW * 0.13, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: leftW * 0.1, halign: 'center' },
      5: { cellWidth: leftW * 0.11, halign: 'center' },
    },
  });

  // Grade distribution below subject table
  const rightX = M + leftW + 6;
  const rightW = W - rightX - M;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(0, 32, 96);
  doc.text('STUDENT RANKINGS', rightX, 61);

  autoTable(doc, {
    startY: 63,
    margin: { left: rightX },
    head: [['Rank', 'Name', 'Adm No', 'Gender', 'Avg', 'PL', 'Pts', 'Level']],
    body: rankings.map(s => {
      const r = getRubric(s.avg);
      return [`#${s.rank}`, s.name, s.admission_number, s.gender, `${s.avg}%`, r.code, r.pts, r.label];
    }),
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.8, lineColor: [180, 195, 220], lineWidth: 0.2 },
    headStyles: { fillColor: [0, 32, 96], textColor: [253, 224, 71], fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [247, 250, 255] },
    tableWidth: rightW,
    columnStyles: {
      0: { cellWidth: rightW * 0.08, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: rightW * 0.26 },
      2: { cellWidth: rightW * 0.13 },
      3: { cellWidth: rightW * 0.1 },
      4: { cellWidth: rightW * 0.1, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: rightW * 0.1, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: rightW * 0.07, halign: 'center' },
      7: { cellWidth: rightW * 0.16 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const rank = parseInt(data.cell.text[0].replace('#', ''));
        if (rank === 1) data.cell.styles.textColor = [180, 130, 0];
        else if (rank === 2) data.cell.styles.textColor = [80, 90, 100];
        else if (rank === 3) data.cell.styles.textColor = [160, 82, 0];
      }
    },
  });

  drawPDFFooter(doc, school);
  doc.save(`Rankings_${gradeName.replace(/\s+/g, '_')}_${year}.pdf`);
}

/* ─── UI Primitives ──────────────────────────────────────────────────────────── */
const Skel = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700/50 ${className}`} />
);
const RubricBadge = ({ score }: { score: number }) => {
  const r = getRubric(score);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ background: r.bg, color: r.text }}>{r.code} • {r.pts}pts</span>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
export default function InsightsCenter() {
  const { user } = useAuth();
  const sid = user?.school_id;

  const [tab, setTab] = useState<'reportcards' | 'classanalysis' | 'rankings'>('reportcards');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [term, setTerm] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [examId, setExamId] = useState('');
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  const [school, setSchool] = useState<School | undefined>();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [logo, setLogo] = useState<{ data: string; fmt: 'PNG' | 'JPEG' } | null>(null);

  const yearOptions = useMemo(() => { const y = new Date().getFullYear(); return [y, y - 1, y - 2, y - 3].map(String); }, []);

  // ── School fetch — try both string and number id ──
  useEffect(() => {
    if (!sid) return;
    // Try exact match first, then cast
    const fetchSchool = async () => {
      let { data } = await supabase
        .from('schools')
        .select('id,name,logo_url,motto,address,phone,email,website')
        .eq('id', sid)
        .maybeSingle();
      if (!data) {
        // Try numeric cast
        const { data: d2 } = await supabase
          .from('schools')
          .select('id,name,logo_url,motto,address,phone,email,website')
          .eq('id', Number(sid))
          .maybeSingle();
        data = d2;
      }
      if (data) setSchool(data);
    };
    fetchSchool();
  }, [sid]);

  useEffect(() => {
    if (school?.logo_url) fetchLogo(school.logo_url).then(l => setLogo(l));
  }, [school?.logo_url]);

  useEffect(() => {
    if (!sid) return;
    supabase.from('grades').select('id,grade_name,school_id').eq('school_id', sid)
      .then(({ data }) => setGrades(data || []));
    supabase.from('subjects').select('id,subject_name,subject_code,school_id').eq('school_id', sid)
      .then(({ data }) => setSubjects(data || []));
  }, [sid]);

  useEffect(() => {
    if (!sid) return;
    supabase.from('exams')
      .select('id,exam_name,term,year,school_id,grade_id,is_school_wide')
      .eq('school_id', sid).eq('year', Number(year))
      .then(({ data }) => setExams(data || []));
  }, [sid, year]);

  useEffect(() => {
    if (!sid) return;
    let q = supabase.from('students')
      .select('id,name,admission_number,gender,grade_id,school_id')
      .eq('school_id', sid);
    if (gradeId) q = q.eq('grade_id', gradeId);
    q.then(({ data }) => { setStudents(data || []); setSelectedStudent(null); });
  }, [sid, gradeId]);

  useEffect(() => {
    if (!sid) return;
    setLoading(true);
    let q = supabase.from('marks')
      .select('id,student_id,subject_id,exam_id,score,school_id,teacher_remark,grade_id,teacher_id')
      .eq('school_id', sid);
    if (gradeId) q = q.eq('grade_id', gradeId);
    if (examId) q = q.eq('exam_id', examId);
    q.then(({ data }) => { setMarks(data || []); setLoading(false); });
  }, [sid, gradeId, examId]);

  useEffect(() => {
    if (!sid) return;
    let q = supabase.from('attendance')
      .select('id,school_id,student_id,grade_id,date,status')
      .eq('school_id', sid);
    if (gradeId) q = q.eq('grade_id', gradeId);
    q.then(({ data }) => setAttendance(data || []));
  }, [sid, gradeId]);

  // ── Derived ──
  const rankings = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    marks.forEach(m => {
      if (!map[m.student_id]) map[m.student_id] = { total: 0, count: 0 };
      map[m.student_id].total += m.score; map[m.student_id].count++;
    });
    return students
      .map(s => {
        const d = map[s.id];
        const avg = d ? d.total / d.count : 0;
        return { ...s, avg: Math.round(avg * 10) / 10, total: d?.total || 0, subjects: d?.count || 0 };
      })
      .filter(s => s.subjects > 0)
      .sort((a, b) => b.avg - a.avg)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }, [marks, students]);

  const filteredExams = useMemo(() =>
    exams.filter(e => !gradeId || e.grade_id === gradeId || e.is_school_wide),
    [exams, gradeId]);

  const filteredStudents = useMemo(() => {
    if (!search) return students;
    const s = search.toLowerCase();
    return students.filter(st => st.name.toLowerCase().includes(s) || st.admission_number.includes(s));
  }, [students, search]);

  const filteredRankings = useMemo(() => {
    if (!search) return rankings;
    const s = search.toLowerCase();
    return rankings.filter(r => r.name.toLowerCase().includes(s) || r.admission_number.includes(s));
  }, [rankings, search]);

  const getStudentMarks = useCallback((studentId: string) =>
    subjects.map(subj => {
      const m = marks.find(mk => mk.student_id === studentId && mk.subject_id === subj.id);
      return m ? { subject_name: subj.subject_name, subject_code: subj.subject_code, score: m.score, teacher_remark: m.teacher_remark } : null;
    }).filter(Boolean) as { subject_name: string; subject_code: string; score: number; teacher_remark?: string }[],
    [marks, subjects]);

  const getStudentAtt = useCallback((studentId: string) => {
    const sa = attendance.filter(a => a.student_id === studentId && new Date(a.date).getFullYear() === Number(year));
    return {
      total: sa.length,
      present: sa.filter(a => a.status === 'present').length,
      absent: sa.filter(a => a.status === 'absent').length,
      late: sa.filter(a => a.status === 'late').length,
      rate: sa.length ? Math.round(sa.filter(a => a.status === 'present').length / sa.length * 100) : 0,
    };
  }, [attendance, year]);

  const handleGenReportCard = useCallback(async (student: Student) => {
    const rank = rankings.find(r => r.id === student.id);
    await generateReportCard({
      school, logo,
      student: { ...student, rank: rank?.rank, totalStudents: rankings.length },
      grade: grades.find(g => g.id === student.grade_id),
      exam: exams.find(e => e.id === examId),
      year, term,
      subjectMarks: getStudentMarks(student.id),
      att: getStudentAtt(student.id),
    });
  }, [school, logo, grades, exams, examId, year, term, rankings, getStudentMarks, getStudentAtt]);

  const handleGenRankingsPDF = useCallback(async () => {
    if (!gradeId) { alert('Please select a grade first'); return; }
    await generateRankingsPDF({
      school, logo,
      gradeName: grades.find(g => g.id === gradeId)?.grade_name || 'Class',
      examName: exams.find(e => e.id === examId)?.exam_name || 'All Exams',
      year, term, rankings, subjects, marks,
    });
  }, [school, logo, grades, gradeId, exams, examId, year, term, rankings, subjects, marks]);

  const handleGenClassAnalysisPDF = useCallback(async () => {
    if (!gradeId) { alert('Please select a grade first'); return; }
    const gradeName = grades.find(g => g.id === gradeId)?.grade_name || 'Class';
    const doc = new jsPDF('p', 'mm', 'a4');
    const W = doc.internal.pageSize.width, M = 14;
    const exam = exams.find(e => e.id === examId);
    const allScores = marks.map(m => m.score);
    const avg = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
    const pass = allScores.length ? allScores.filter(s => s >= 41).length / allScores.length * 100 : 0;

    drawPDFHeader(doc, school, logo, `CLASS PERFORMANCE ANALYSIS — ${gradeName}`);

    doc.setFillColor(232, 240, 255);
    doc.rect(M, 46, W - M * 2, 8, 'F');
    doc.setDrawColor(0, 32, 96); doc.setLineWidth(0.2);
    doc.rect(M, 46, W - M * 2, 8, 'S');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0, 32, 96);
    doc.text(
      `${gradeName}  •  ${exam?.exam_name || 'All Exams'}  •  Year ${year}  •  ${term || 'All Terms'}  •  Students: ${students.length}  •  Mean: ${avg.toFixed(1)}%  •  Pass Rate: ${pass.toFixed(0)}%`,
      W / 2, 51.5, { align: 'center' },
    );

    const subjRows = subjects.map(subj => {
      const sm = marks.filter(m => m.subject_id === subj.id);
      if (!sm.length) return null;
      const a = sm.reduce((x, b) => x + b.score, 0) / sm.length;
      const r = getRubric(a);
      const p = sm.filter(m => m.score >= 41).length / sm.length * 100;
      return [subj.subject_name, sm.length, a.toFixed(1) + '%', r.code, r.pts, r.label, p.toFixed(0) + '%'];
    }).filter(Boolean);

    autoTable(doc, {
      startY: 57,
      head: [['Learning Area', 'Entries', 'Mean', 'PL', 'Pts', 'Performance Level', 'Pass%']],
      body: subjRows as any,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5, lineColor: [180, 195, 220], lineWidth: 0.2 },
      headStyles: { fillColor: [0, 32, 96], textColor: [253, 224, 71], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 250, 255] },
      columnStyles: { 0: { cellWidth: 52 }, 1: { halign: 'center' }, 2: { halign: 'center', fontStyle: 'bold' }, 3: { halign: 'center', fontStyle: 'bold' }, 4: { halign: 'center' } },
    });

    const y2 = (doc as any).lastAutoTable.finalY + 8;
    autoTable(doc, {
      startY: y2,
      head: [['Code', 'Level', 'Score Range', 'Pts', 'Count', '%']],
      body: RUBRIC.map(r => {
        const cnt = allScores.filter(s => s >= r.min && s <= r.max).length;
        return [r.code, r.label, `${r.min}–${r.max}`, r.pts, cnt, allScores.length ? (cnt / allScores.length * 100).toFixed(1) + '%' : '0%'];
      }),
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [0, 32, 96], textColor: [253, 224, 71], fontStyle: 'bold' },
    });

    drawPDFFooter(doc, school);
    doc.save(`ClassAnalysis_${gradeName}_${year}.pdf`);
  }, [school, logo, grades, gradeId, subjects, marks, students, year, term, examId, exams]);

  const handleBulkPDF = useCallback(async () => {
    if (!filteredStudents.length) return;
    setBulkLoading(true); setBulkProgress(0);
    for (let i = 0; i < Math.min(filteredStudents.length, 100); i++) {
      await handleGenReportCard(filteredStudents[i]);
      setBulkProgress(Math.round((i + 1) / Math.min(filteredStudents.length, 100) * 100));
      await new Promise(r => setTimeout(r, 180));
    }
    setBulkLoading(false); setBulkProgress(0);
  }, [filteredStudents, handleGenReportCard]);

  const exportExcel = useCallback(() => {
    const data = rankings.map(s => ({
      Rank: s.rank, Name: s.name, 'Adm No': s.admission_number,
      Gender: s.gender, Class: grades.find(g => g.id === s.grade_id)?.grade_name || '',
      Average: s.avg, PL: getRubric(s.avg).code, Level: getRubric(s.avg).label, Points: getRubric(s.avg).pts,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rankings');
    XLSX.writeFile(wb, `Rankings_${grades.find(g => g.id === gradeId)?.grade_name || 'All'}_${year}.xlsx`);
  }, [rankings, grades, gradeId, year]);

  /* ─── RENDER ─────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">

      {/* Sticky Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="w-1.5 h-5 rounded-full" style={{ background: 'linear-gradient(#002060,#0052cc)' }} />
              <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-blue-800 dark:text-blue-400">Insights Center</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Academic Reports</h1>
            <p className="text-xs text-slate-500">{school?.name || '…'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { val: year, set: setYear, opts: yearOptions.map(y => ({ v: y, l: y })), ph: 'Year' },
              { val: term, set: setTerm, opts: [{ v: '', l: 'All Terms' }, { v: 'Term 1', l: 'Term 1' }, { v: 'Term 2', l: 'Term 2' }, { v: 'Term 3', l: 'Term 3' }], ph: 'Term' },
              { val: gradeId, set: (v: string) => { setGradeId(v); setExamId(''); }, opts: [{ v: '', l: 'All Grades' }, ...grades.map(g => ({ v: g.id, l: g.grade_name }))], ph: 'Grade' },
              { val: examId, set: setExamId, opts: [{ v: '', l: 'All Exams' }, ...filteredExams.map(e => ({ v: e.id, l: e.exam_name }))], ph: 'Exam' },
            ].map(f => (
              <select key={f.ph} value={f.val} onChange={e => f.set(e.target.value)}
                className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-600 cursor-pointer">
                {f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            ))}
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-3 flex gap-1">
          {([
            { key: 'reportcards', label: '📄 Report Cards' },
            { key: 'classanalysis', label: '📊 Class Analysis' },
            { key: 'rankings', label: '🏆 Rankings' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t.key ? 'text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              style={tab === t.key ? { background: '#002060' } : {}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="max-w-6xl mx-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.18 }}>

            {/* ════ REPORT CARDS ════ */}
            {tab === 'reportcards' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div>
                      <h2 className="font-bold text-slate-900 dark:text-white">Student Report Cards</h2>
                      <p className="text-xs text-slate-500 mt-0.5">{filteredStudents.length} students · CBC 8-level grading</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <div className="relative">
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                          className="pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-600 text-slate-700 dark:text-slate-200 w-40" />
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                      </div>
                      <button onClick={handleBulkPDF} disabled={bulkLoading || !filteredStudents.length}
                        className="px-4 py-2 rounded-xl text-white text-xs font-semibold disabled:opacity-50"
                        style={{ background: '#002060' }}>
                        {bulkLoading ? `Generating… ${bulkProgress}%` : `⬇ Bulk PDF (${Math.min(filteredStudents.length, 100)})`}
                      </button>
                    </div>
                  </div>

                  {bulkLoading && (
                    <div className="mb-3 h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${bulkProgress}%`, background: '#002060' }} />
                    </div>
                  )}

                  {loading ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-20" />)}
                    </div>
                  ) : filteredStudents.length > 0 ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredStudents.map(s => {
                        const sMarks = getStudentMarks(s.id);
                        const avg = sMarks.length ? sMarks.reduce((a, b) => a + b.score, 0) / sMarks.length : null;
                        const rank = rankings.find(r => r.id === s.id);
                        const r = avg !== null ? getRubric(avg) : null;
                        const isSelected = selectedStudent?.id === s.id;
                        return (
                          <div key={s.id} onClick={() => setSelectedStudent(isSelected ? null : s)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-blue-800 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:border-blue-400'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                                  style={{ background: r ? r.color : '#94a3b8' }}>{s.name[0]}</div>
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{s.name}</div>
                                  <div className="text-[10px] text-slate-500">{s.admission_number}</div>
                                </div>
                              </div>
                              {r && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: r.bg, color: r.text }}>{r.code}</span>}
                            </div>
                            {avg !== null && (
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${avg}%`, background: r?.color }} />
                                </div>
                                <span className="text-xs font-bold">{avg.toFixed(1)}%</span>
                                {rank && <span className="text-[10px] text-slate-400">#{rank.rank}</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-slate-400 text-sm">
                      {gradeId ? 'No students found' : 'Select a grade to load students'}
                    </div>
                  )}
                </div>

                {/* Preview panel */}
                <AnimatePresence>
                  {selectedStudent && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                      <div className="flex items-start justify-between flex-wrap gap-3 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedStudent.name}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {selectedStudent.admission_number} · {selectedStudent.gender} · {grades.find(g => g.id === selectedStudent.grade_id)?.grade_name}
                            {rankings.find(r => r.id === selectedStudent.id) && ` · Rank #${rankings.find(r => r.id === selectedStudent.id)?.rank} of ${rankings.length}`}
                          </p>
                        </div>
                        <button onClick={() => handleGenReportCard(selectedStudent)}
                          className="px-4 py-2 rounded-xl text-white text-xs font-bold" style={{ background: '#002060' }}>
                          ⬇ Download PDF
                        </button>
                      </div>
                      {(() => {
                        const sMarks = getStudentMarks(selectedStudent.id);
                        const att = getStudentAtt(selectedStudent.id);
                        const avg = sMarks.length ? sMarks.reduce((a, b) => a + b.score, 0) / sMarks.length : 0;
                        const remarks = getRemarks(avg);
                        return sMarks.length > 0 ? (
                          <div className="space-y-4">
                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr style={{ background: '#002060' }}>
                                    {['Subject', 'Score', 'PL', 'Pts', 'Level', 'Remark'].map(h => (
                                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-yellow-400">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {sMarks.map(m => {
                                    const r = getRubric(m.score);
                                    return (
                                      <tr key={m.subject_name} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                        <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">{m.subject_name}</td>
                                        <td className="px-3 py-2.5 font-bold" style={{ color: r.color }}>{m.score}</td>
                                        <td className="px-3 py-2.5"><RubricBadge score={m.score} /></td>
                                        <td className="px-3 py-2.5 font-bold text-center" style={{ color: r.color }}>{r.pts}</td>
                                        <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300">{r.label}</td>
                                        <td className="px-3 py-2.5 text-xs text-slate-400 italic">{m.teacher_remark || '—'}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr style={{ background: '#002060' }}>
                                    <td className="px-3 py-2 text-xs font-bold text-yellow-400">OVERALL</td>
                                    <td className="px-3 py-2 font-bold text-white">{avg.toFixed(1)}%</td>
                                    <td className="px-3 py-2"><RubricBadge score={avg} /></td>
                                    <td className="px-3 py-2 font-bold text-white text-center">{getRubric(avg).pts}</td>
                                    <td colSpan={2} className="px-3 py-2 text-xs text-slate-400">{sMarks.length} subjects · Rank #{rankings.find(r => r.id === selectedStudent.id)?.rank || '-'}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                            <div className="grid md:grid-cols-3 gap-3">
                              <div className="rounded-xl p-3 border" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
                                <div className="text-[10px] font-bold uppercase text-blue-800 mb-2">Attendance</div>
                                <div className="grid grid-cols-2 gap-1 text-xs">
                                  {[['Sessions', att.total], ['Present', att.present], ['Absent', att.absent], ['Rate', `${att.rate}%`]].map(([k, v]) => (
                                    <div key={k as string} className="flex justify-between">
                                      <span className="text-slate-500">{k}</span>
                                      <span className="font-semibold text-slate-800">{v}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="rounded-xl p-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                <div className="text-[10px] font-bold uppercase text-blue-900 dark:text-blue-400 mb-1">Class Teacher</div>
                                <p className="text-xs italic text-slate-600 dark:text-slate-300">{remarks.teacher}</p>
                              </div>
                              <div className="rounded-xl p-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                <div className="text-[10px] font-bold uppercase text-blue-900 dark:text-blue-400 mb-1">Principal</div>
                                <p className="text-xs italic text-slate-600 dark:text-slate-300">{remarks.principal}</p>
                              </div>
                            </div>
                          </div>
                        ) : <div className="text-center py-10 text-slate-400 text-sm">No marks found for current filters</div>;
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ════ CLASS ANALYSIS ════ */}
            {tab === 'classanalysis' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white">Class Performance Analysis</h2>
                    <p className="text-xs text-slate-500">CBC 8-level subject means and grade distribution</p>
                  </div>
                  <button onClick={handleGenClassAnalysisPDF}
                    className="px-4 py-2 rounded-xl text-white text-xs font-bold" style={{ background: '#002060' }}>
                    ⬇ PDF
                  </button>
                </div>
                {!gradeId ? (
                  <div className="text-center py-16 text-slate-400 text-sm">Select a grade to view class analysis</div>
                ) : loading ? (
                  <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skel key={i} className="h-12" />)}</div>
                ) : (
                  <div className="space-y-5">
                    {(() => {
                      const scores = marks.map(m => m.score);
                      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
                      const pass = scores.length ? scores.filter(s => s >= 41).length / scores.length * 100 : 0;
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { l: 'Students', v: students.length, c: '#002060' },
                            { l: 'Class Mean', v: avg.toFixed(1) + '%', c: getRubric(avg).color },
                            { l: 'Pass Rate', v: pass.toFixed(0) + '%', c: '#15803d' },
                            { l: 'Class PL', v: getRubric(avg).code, c: getRubric(avg).color },
                          ].map(k => (
                            <div key={k.l} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{k.l}</div>
                              <div className="text-xl font-bold mt-1" style={{ color: k.c }}>{k.v}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: '#002060' }}>
                            {['#', 'Learning Area', 'Entries', 'Mean', 'PL', 'Pts', 'Level', 'Pass%', 'Bar'].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-yellow-400">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {subjects.map((subj, i) => {
                            const sm = marks.filter(m => m.subject_id === subj.id);
                            if (!sm.length) return null;
                            const avg = sm.reduce((a, b) => a + b.score, 0) / sm.length;
                            const r = getRubric(avg);
                            const pass = sm.filter(m => m.score >= 41).length / sm.length * 100;
                            return (
                              <tr key={subj.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                                <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">{subj.subject_name}</td>
                                <td className="px-3 py-2.5 text-center text-slate-600">{sm.length}</td>
                                <td className="px-3 py-2.5 font-bold" style={{ color: r.color }}>{avg.toFixed(1)}%</td>
                                <td className="px-3 py-2.5"><RubricBadge score={avg} /></td>
                                <td className="px-3 py-2.5 font-bold text-center" style={{ color: r.color }}>{r.pts}</td>
                                <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300">{r.label}</td>
                                <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: pass >= 41 ? '#15803d' : '#dc2626' }}>{pass.toFixed(0)}%</td>
                                <td className="px-3 py-2.5 w-24">
                                  <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${avg}%`, background: r.color }} />
                                  </div>
                                </td>
                              </tr>
                            );
                          }).filter(Boolean)}
                        </tbody>
                      </table>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {RUBRIC.map(r => {
                        const cnt = marks.filter(m => m.score >= r.min && m.score <= r.max).length;
                        const pct = marks.length ? Math.round(cnt / marks.length * 100) : 0;
                        return (
                          <div key={r.code} className="rounded-xl p-3 border" style={{ background: r.bg, borderColor: r.color + '40' }}>
                            <div className="text-xs font-bold" style={{ color: r.text }}>{r.code}</div>
                            <div className="text-[9px] mb-1" style={{ color: r.text + 'aa' }}>{r.min}–{r.max} pts</div>
                            <div className="text-2xl font-black" style={{ color: r.text }}>{cnt}</div>
                            <div className="text-[10px]" style={{ color: r.text + 'aa' }}>{pct}%</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ════ RANKINGS ════ */}
            {tab === 'rankings' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white">Student Rankings</h2>
                    <p className="text-xs text-slate-500">{filteredRankings.length} students ranked</p>
                  </div>
                  <div className="flex gap-2">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                      className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-600 text-slate-700 dark:text-slate-200 w-36" />
                    <button onClick={exportExcel} className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">Excel</button>
                    <button onClick={handleGenRankingsPDF}
                      className="px-3 py-2 rounded-xl text-white text-xs font-bold" style={{ background: '#002060' }}>
                      ⬇ PDF (Landscape)
                    </button>
                  </div>
                </div>

                {filteredRankings.length >= 3 && (
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[filteredRankings[1], filteredRankings[0], filteredRankings[2]].map((s, i) => {
                      const podium = [2, 1, 3][i];
                      const bgs = ['#64748b', '#002060', '#b45309'];
                      const heights = ['h-24', 'h-32', 'h-20'];
                      return (
                        <div key={s.id} className={`flex flex-col items-center ${i === 1 ? 'order-2' : i === 0 ? 'order-1' : 'order-3'}`}>
                          <div className={`w-full ${heights[i]} rounded-t-2xl flex flex-col items-center justify-end pb-3 text-white shadow-lg`}
                            style={{ background: bgs[i] }}>
                            <div className="text-3xl font-black">#{podium}</div>
                          </div>
                          <div className="w-full p-3 text-center rounded-b-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                            <div className="text-sm font-bold truncate text-slate-800 dark:text-slate-100">{s.name}</div>
                            <div className="text-[10px] text-slate-500">{s.admission_number}</div>
                            <div className="text-lg font-black mt-1" style={{ color: getRubric(s.avg).color }}>{s.avg}%</div>
                            <RubricBadge score={s.avg} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {loading ? (
                  <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-12" />)}</div>
                ) : filteredRankings.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: '#002060' }}>
                          {['Rank', 'Student', 'Adm No', 'Gender', 'Class', 'Score', 'PL', 'Pts', 'Level', ''].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-yellow-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRankings.map(s => {
                          const r = getRubric(s.avg);
                          const medals = ['text-yellow-500', 'text-slate-400', 'text-amber-700'];
                          return (
                            <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className={`px-3 py-3 font-black ${s.rank <= 3 ? medals[s.rank - 1] : 'text-slate-400'}`}>#{s.rank}</td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                    style={{ background: r.color }}>{s.name[0]}</div>
                                  <span className="font-medium text-slate-800 dark:text-slate-100">{s.name}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-slate-500 font-mono text-xs">{s.admission_number}</td>
                              <td className="px-3 py-3 text-slate-500 text-xs">{s.gender}</td>
                              <td className="px-3 py-3 text-slate-600 dark:text-slate-300 text-xs">{grades.find(g => g.id === s.grade_id)?.grade_name}</td>
                              <td className="px-3 py-3 font-bold" style={{ color: r.color }}>{s.avg}%</td>
                              <td className="px-3 py-3"><RubricBadge score={s.avg} /></td>
                              <td className="px-3 py-3 font-bold text-center" style={{ color: r.color }}>{r.pts}</td>
                              <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">{r.label}</td>
                              <td className="px-3 py-3">
                                <button onClick={() => { setSelectedStudent(s); setTab('reportcards'); }}
                                  className="text-xs font-semibold" style={{ color: '#002060' }}>
                                  Report →
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-16 text-slate-400 text-sm">
                    {gradeId ? 'No ranked students found' : 'Select a grade and exam to view rankings'}
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}