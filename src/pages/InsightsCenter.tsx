import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../useAuth';

/* ─── CBC Kenya Grading Rubric (8 levels) ─────────────────────────────────── */
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

const getRubric = (score: number) => { const s = Math.round(score); return RUBRIC.find(r => s >= r.min && s <= r.max) || RUBRIC[RUBRIC.length - 1]; };

/* ─── Humanized remarks per performance band ─────────────────────────────── */
const getRemarks = (avg: number): { teacher: string; principal: string } => {
  if (avg >= 90) return {
    teacher: 'Outstanding achievement! This learner has demonstrated exceptional mastery across all learning areas. Keep soaring — the sky is not the limit!',
    principal: 'Remarkable performance! This learner is a true academic champion. We celebrate your excellence and encourage you to inspire your peers.',
  };
  if (avg >= 75) return {
    teacher: 'Excellent work this term! This learner has exceeded expectations in most areas and shown genuine commitment to learning. Very proud!',
    principal: 'Well done — a truly commendable performance. You have shown what consistent effort and focus can achieve. Keep it up!',
  };
  if (avg >= 58) return {
    teacher: 'Good performance this term. The learner has met expectations and shown steady growth. With a little more push, greatness is within reach.',
    principal: 'Satisfactory progress. You are on the right path. Stay focused, ask questions, and continue to give your best in every subject.',
  };
  if (avg >= 41) return {
    teacher: 'Fair effort this term. Some subjects need more attention and practice. Encourage this learner to seek help in areas of challenge.',
    principal: 'You are making progress, but there is room to grow. Set clear goals, study consistently, and believe in yourself — you can do better!',
  };
  if (avg >= 31) return {
    teacher: 'This learner is struggling in several areas and requires targeted support. Regular revision and teacher-parent engagement is strongly advised.',
    principal: 'We are concerned about your academic progress. Please come in for a meeting so we can put a support plan in place together.',
  };
  return {
    teacher: 'Urgent intervention needed. This learner requires immediate remedial support. Please contact the class teacher as soon as possible.',
    principal: 'This learner needs our collective support urgently. We invite the parent/guardian for a meeting to chart a way forward together.',
  };
};

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface School    { id: any; name: string; logo_url?: string; motto?: string; address?: string; phone?: string; email?: string; website?: string; }
interface Grade     { id: string; grade_name: string; school_id: any; }
interface Subject   { id: string; subject_name: string; subject_code: string; school_id: any; }
interface Exam      { id: string; exam_name: string; term: string; year: number; school_id: any; grade_id?: string; is_school_wide: boolean; }
interface Student   { id: string; name: string; admission_number: string; gender: string; grade_id: string; school_id: any; }
interface Mark      { id: string; student_id: string; subject_id: string; exam_id: string; score: number; school_id: any; teacher_remark?: string; grade_id: string; teacher_id?: string; }
interface AttendanceRecord { id: string; school_id: any; student_id: string; grade_id: string; date: string; status: string; }

/* ─── Logo fetcher ────────────────────────────────────────────────────────── */
async function fetchLogo(url: string): Promise<{ data: string; fmt: 'PNG' | 'JPEG' } | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const fmt: 'PNG' | 'JPEG' = blob.type.includes('png') ? 'PNG' : 'JPEG';
    const data: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    return { data, fmt };
  } catch { return null; }
}

/* ─── PDF Helpers ─────────────────────────────────────────────────────────── */
function drawPDFLetterhead(
  doc: jsPDF,
  school: School | undefined,
  logo: { data: string; fmt: 'PNG' | 'JPEG' } | null,
  title: string,
  landscape = false,
  showPhoto = false,
) {
  const W = doc.internal.pageSize.width;
  const M = 14;

  // Deep navy header bar
  doc.setFillColor(0, 32, 96);
  doc.rect(0, 0, W, 32, 'F');
  // Gold accent stripe
  doc.setFillColor(234, 179, 8);
  doc.rect(0, 32, W, 2.5, 'F');

  // Logo — left
  if (logo) {
    try { doc.addImage(logo.data, logo.fmt, M, 4, 24, 24); } catch { /* noop */ }
  } else {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(M, 4, 24, 24, 3, 3, 'F');
    doc.setTextColor(0, 32, 96); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text((school?.name || 'S')[0].toUpperCase(), M + 12, 20, { align: 'center' });
  }

  // School name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  const sName    = (school?.name    || 'Marumbasi Comprehensive School').trim();
  const sAddr    = (school?.address || 'P.O. Box 001, Marumbasi').trim();
  const sPhone   = (school?.phone   || '+254 700 000000').trim();
  const sEmail   = (school?.email   || 'admin@marumbasi.com').trim();
  const sMotto   = (school?.motto   || 'Together we Succeed').trim();
  doc.text(sName.toUpperCase(), W / 2, 11, { align: 'center' });

  // Contacts
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 200, 230);
  doc.text(`${sAddr}  |  ${sPhone}  |  ${sEmail}`, W / 2, 17, { align: 'center' });
  doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(253, 224, 71);
  doc.text(`"${sMotto}"`, W / 2, 23, { align: 'center' });

  // Title ribbon
  doc.setFillColor(245, 248, 255);
  doc.setDrawColor(0, 32, 96); doc.setLineWidth(0.5);
  doc.rect(M, 37, W - M * 2, 9, 'FD');
  doc.setTextColor(0, 32, 96); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), W / 2, 43, { align: 'center' });
}

function drawPDFFooter(doc: jsPDF, school: School | undefined) {
  const W = doc.internal.pageSize.width;
  const H = doc.internal.pageSize.height;
  doc.setDrawColor(234, 179, 8); doc.setLineWidth(0.5);
  doc.line(14, H - 10, W - 14, H - 10);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(100, 116, 139);
  doc.text(`${school?.name || ''} • Generated by EduNexa Analytics`, 14, H - 5);
  doc.text(new Date().toLocaleDateString('en-KE', { dateStyle: 'full' }), W - 14, H - 5, { align: 'right' });
}

/* ══════════════════════════════════════════════════════════════════════════
   PDF: RANKINGS — 3 pages
   Page 1: Letterhead + Exam info + Subject Performance Analysis
   Page 2: Full Student Rankings (all subjects in one row, totals, avg, rubric)
   Page 3: Exam Comparison (current vs previous)
══════════════════════════════════════════════════════════════════════════ */
async function generateRankingsPDF(params: {
  school: School | undefined;
  logo: { data: string; fmt: 'PNG' | 'JPEG' } | null;
  gradeName: string; examName: string; year: string; term: string;
  rankings: (Student & { rank: number; avg: number; total: number; subjects: number })[];
  subjects: Subject[];
  marks: Mark[];
  prevMarks?: Mark[];
  prevExamName?: string;
}) {
  const { school, logo, gradeName, examName, year, term, rankings, subjects, marks, prevMarks, prevExamName } = params;
  const doc = new jsPDF('l', 'mm', 'a4');
  const W = doc.internal.pageSize.width;
  const M = 14;

  /* ── PAGE 1: Letterhead + Exam Info + Subject Analysis ── */
  drawPDFLetterhead(doc, school, logo, `EXAMINATION RESULTS — ${gradeName} • ${examName}`, true);

  const allScores = marks.map(m => m.score);
  const classAvg  = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
  const passRate  = allScores.length ? allScores.filter(s => s >= 41).length / allScores.length * 100 : 0;
  const classR    = getRubric(classAvg);

  // Exam summary strip
  doc.setFillColor(232, 240, 255);
  doc.rect(M, 49, W - M * 2, 10, 'F');
  doc.setDrawColor(0, 32, 96); doc.setLineWidth(0.2);
  doc.rect(M, 49, W - M * 2, 10, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0, 32, 96);

  const kpis = [
    `Exam: ${examName}`,
    `Grade: ${gradeName}`,
    `Year: ${year}`,
    `Term: ${term || 'All Terms'}`,
    `Students: ${rankings.length}`,
    `Mean: ${classAvg.toFixed(1)}%`,
    `Class PL: ${classR.code} (${classR.pts} pts)`,
    `Pass Rate: ${passRate.toFixed(1)}%`,
  ];
  doc.text(kpis.join('   •   '), W / 2, 55.5, { align: 'center' });

  // Subject Performance Analysis table
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0, 32, 96);
  doc.text('SUBJECT PERFORMANCE ANALYSIS', M, 65);

  const subjRows = subjects.map((subj, i) => {
    const sm = marks.filter(m => m.subject_id === subj.id);
    if (!sm.length) return null;
    const avg = sm.reduce((x, b) => x + b.score, 0) / sm.length;
    const r = getRubric(avg);
    const pass = sm.filter(m => m.score >= 41).length / sm.length * 100;
    const highest = Math.max(...sm.map(m => m.score));
    const lowest  = Math.min(...sm.map(m => m.score));
    return [
      i + 1,
      subj.subject_name,
      subj.subject_code,
      sm.length,
      avg.toFixed(1),
      r.code,
      r.pts,
      r.label,
      pass.toFixed(0) + '%',
      highest,
      lowest,
    ];
  }).filter(Boolean);

  autoTable(doc, {
    startY: 67,
    head: [['#', 'Learning Area', 'Code', 'N', 'Mean', 'PL', 'Pts', 'Performance Level', 'Pass%', 'Highest', 'Lowest']],
    body: subjRows as any,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, lineColor: [200, 210, 230], lineWidth: 0.2 },
    headStyles: { fillColor: [0, 32, 96], textColor: [253, 224, 71], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
    alternateRowStyles: { fillColor: [247, 250, 255] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 50 },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 10, halign: 'center' },
      7: { cellWidth: 52 },
      8: { cellWidth: 16, halign: 'center' },
      9: { cellWidth: 18, halign: 'center' },
      10: { cellWidth: 18, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const code = String(data.cell.text[0]);
        const r = RUBRIC.find(r => r.code === code);
        if (r) { data.cell.styles.textColor = r.color as any; data.cell.styles.fontStyle = 'bold'; }
      }
    },
  });

  // Rubric key at bottom of page 1
  const ry = (doc as any).lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0, 32, 96);
  doc.text('CBC GRADING RUBRIC KEY', M, ry);
  autoTable(doc, {
    startY: ry + 2,
    head: [['Code', 'Performance Level', 'Score Range', 'Rubric Points']],
    body: RUBRIC.map(r => [r.code, r.label, `${r.min} – ${r.max}`, r.pts]),
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [200, 210, 230], lineWidth: 0.15 },
    headStyles: { fillColor: [0, 32, 96], textColor: [253, 224, 71], fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [250, 251, 255] },
    tableWidth: (W - M * 2) / 2,
    columnStyles: {
      0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 65 },
      2: { cellWidth: 28, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const code = String(data.cell.text[0]);
        const r = RUBRIC.find(r => r.code === code);
        if (r) data.cell.styles.textColor = r.color as any;
      }
    },
  });

  drawPDFFooter(doc, school);

  /* ── PAGE 2: Full Student Rankings ── */
  doc.addPage('l');
  drawPDFLetterhead(doc, school, logo, `STUDENT RANKINGS — ${gradeName} • ${examName} • ${year}`, true);

  // Build dynamic columns: Rank, Name, Adm, Gender, [Subject cols...], Total, Avg, PL, Pts
  const subjectCols = subjects.filter(s => marks.some(m => m.subject_id === s.id));
  const availableW  = W - M * 2;
  const fixedW      = 10 + 42 + 18 + 14 + 14 + 14 + 16 + 14; // rank+name+adm+gender+total+avg+pl+pts
  const subColW     = Math.max(12, Math.min(18, (availableW - fixedW) / (subjectCols.length || 1)));

  const rankHead = ['#', 'Student Name', 'Adm No', 'Sex',
    ...subjectCols.map(s => s.subject_code || s.subject_name.substring(0, 6)),
    'Total', 'Avg%', 'PL', 'Pts'];

  const rankBody = rankings.map(s => {
    const subScores = subjectCols.map(subj => {
      const m = marks.find(mk => mk.student_id === s.id && mk.subject_id === subj.id);
      return m ? m.score : '-';
    });
    const r = getRubric(s.avg);
    return [
      `#${s.rank}`,
      s.name,
      s.admission_number,
      s.gender.charAt(0).toUpperCase(),
      ...subScores,
      s.total,
      s.avg.toFixed(1),
      r.code,
      r.pts,
    ];
  });

  const subColStyles: Record<number, object> = {};
  subjectCols.forEach((_, i) => {
    subColStyles[4 + i] = { cellWidth: subColW, halign: 'center', fontSize: 6.5 };
  });

  autoTable(doc, {
    startY: 49,
    head: [rankHead],
    body: rankBody,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.8, lineColor: [200, 210, 230], lineWidth: 0.2, overflow: 'ellipsize' },
    headStyles: { fillColor: [0, 32, 96], textColor: [253, 224, 71], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    alternateRowStyles: { fillColor: [247, 250, 255] },
    columnStyles: {
      0:  { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
      1:  { cellWidth: 42 },
      2:  { cellWidth: 18 },
      3:  { cellWidth: 10, halign: 'center' },
      ...subColStyles,
      [4 + subjectCols.length]:     { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      [4 + subjectCols.length + 1]: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      [4 + subjectCols.length + 2]: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      [4 + subjectCols.length + 3]: { cellWidth: 10, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const plCol = 4 + subjectCols.length + 2;
        if (data.column.index === 0) {
          const rank = parseInt(String(data.cell.text[0]).replace('#', ''));
          if (rank === 1) data.cell.styles.textColor = [160, 100, 0] as any;
          else if (rank === 2) data.cell.styles.textColor = [80, 90, 100] as any;
          else if (rank === 3) data.cell.styles.textColor = [140, 70, 0] as any;
        }
        if (data.column.index === plCol) {
          const code = String(data.cell.text[0]);
          const r = RUBRIC.find(r => r.code === code);
          if (r) data.cell.styles.textColor = r.color as any;
        }
        // Colour individual subject scores
        if (data.column.index >= 4 && data.column.index < 4 + subjectCols.length) {
          const val = parseFloat(String(data.cell.text[0]));
          if (!isNaN(val)) {
            const r = getRubric(val);
            data.cell.styles.textColor = r.color as any;
          }
        }
      }
    },
  });

  // Class summary footer row
  const fy2 = (doc as any).lastAutoTable.finalY;
  doc.setFillColor(0, 32, 96);
  doc.rect(M, fy2 + 0.5, W - M * 2, 7, 'F');
  doc.setTextColor(253, 224, 71); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  doc.text(
    `CLASS SUMMARY  •  Students: ${rankings.length}  •  Class Mean: ${classAvg.toFixed(1)}%  •  PL: ${classR.code}  •  Pass Rate: ${passRate.toFixed(1)}%`,
    W / 2, fy2 + 5.5, { align: 'center' }
  );

  drawPDFFooter(doc, school);

  /* ── PAGE 3: Exam Comparison ── */
  doc.addPage('l');
  drawPDFLetterhead(doc, school, logo, `EXAM COMPARISON — ${gradeName} • ${year}`, true);

  if (prevMarks && prevMarks.length > 0 && prevExamName) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(0, 32, 96);
    doc.text(`Comparing: ${examName}  vs  ${prevExamName}`, W / 2, 52, { align: 'center' });

    const compRows = subjects.map((subj, i) => {
      const curr = marks.filter(m => m.subject_id === subj.id);
      const prev = prevMarks.filter(m => m.subject_id === subj.id);
      if (!curr.length && !prev.length) return null;
      const currAvg = curr.length ? curr.reduce((a, b) => a + b.score, 0) / curr.length : 0;
      const prevAvg = prev.length ? prev.reduce((a, b) => a + b.score, 0) / prev.length : 0;
      const diff = currAvg - prevAvg;
      const rCurr = getRubric(currAvg);
      const rPrev = getRubric(prevAvg);
      const trend = diff > 2 ? '▲ Improved' : diff < -2 ? '▼ Declined' : '→ Stable';
      return [
        i + 1,
        subj.subject_name,
        prevAvg.toFixed(1), rPrev.code,
        currAvg.toFixed(1), rCurr.code,
        (diff >= 0 ? '+' : '') + diff.toFixed(1),
        trend,
      ];
    }).filter(Boolean);

    const allCurrScores = marks.map(m => m.score);
    const allPrevScores = prevMarks.map(m => m.score);
    const currMean = allCurrScores.length ? allCurrScores.reduce((a, b) => a + b) / allCurrScores.length : 0;
    const prevMean = allPrevScores.length ? allPrevScores.reduce((a, b) => a + b) / allPrevScores.length : 0;
    const meanDiff = currMean - prevMean;

    autoTable(doc, {
      startY: 55,
      head: [['#', 'Learning Area', `${prevExamName} Mean`, 'PL', `${examName} Mean`, 'PL', 'Change', 'Trend']],
      body: compRows as any,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.2, lineColor: [200, 210, 230], lineWidth: 0.2 },
      headStyles: { fillColor: [0, 32, 96], textColor: [253, 224, 71], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [247, 250, 255] },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 60 },
        2: { cellWidth: 32, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: 32, halign: 'center', fontStyle: 'bold' },
        5: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
        6: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
        7: { cellWidth: 30, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          if (data.column.index === 6) {
            const val = parseFloat(String(data.cell.text[0]));
            if (!isNaN(val)) data.cell.styles.textColor = val >= 0 ? [22, 163, 74] as any : [220, 38, 38] as any;
          }
          if (data.column.index === 7) {
            const t = String(data.cell.text[0]);
            if (t.includes('▲')) data.cell.styles.textColor = [22, 163, 74] as any;
            else if (t.includes('▼')) data.cell.styles.textColor = [220, 38, 38] as any;
            else data.cell.styles.textColor = [100, 116, 139] as any;
          }
        }
      },
    });

    // Overall comparison summary
    const fy3 = (doc as any).lastAutoTable.finalY + 6;
    doc.setFillColor(232, 240, 255);
    doc.rect(M, fy3, W - M * 2, 12, 'F');
    doc.setDrawColor(0, 32, 96); doc.setLineWidth(0.3);
    doc.rect(M, fy3, W - M * 2, 12, 'S');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0, 32, 96);
    doc.text(
      `Overall Class Mean: ${prevExamName}: ${prevMean.toFixed(1)}%  →  ${examName}: ${currMean.toFixed(1)}%  |  Change: ${meanDiff >= 0 ? '+' : ''}${meanDiff.toFixed(1)}%  |  ${meanDiff >= 0 ? '▲ Performance Improved' : '▼ Performance Declined'}`,
      W / 2, fy3 + 8, { align: 'center' }
    );
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(100, 116, 139);
    doc.text('No previous exam data available for comparison.', W / 2, 90, { align: 'center' });
    doc.setFontSize(8);
    doc.text('To enable comparison, mark entries must exist for a prior exam in the same grade and school year.', W / 2, 100, { align: 'center' });
  }

  drawPDFFooter(doc, school);
  doc.save(`Rankings_${gradeName.replace(/\s+/g, '_')}_${examName.replace(/\s+/g, '_')}_${year}.pdf`);
}

/* ══════════════════════════════════════════════════════════════════════════
   PDF: REPORT CARD (single student, portrait A4)
══════════════════════════════════════════════════════════════════════════ */
async function generateReportCard(params: {
  school: School | undefined;
  logo: { data: string; fmt: 'PNG' | 'JPEG' } | null;
  student: Student & { rank?: number; totalStudents?: number };
  grade: Grade | undefined;
  exam: Exam | undefined;
  year: string; term: string;
  subjectMarks: { subject_name: string; subject_code: string; score: number; teacher_remark?: string; teacher_name?: string }[];
  att: { total: number; present: number; absent: number; late: number; rate: number };
  prevSubjectMarks?: { subject_name: string; score: number }[];
}) {
  const { school, logo, student, grade, exam, year, term, subjectMarks, att, prevSubjectMarks } = params;
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = doc.internal.pageSize.width;
  const M = 14;

  drawPDFLetterhead(doc, school, logo, 'LEARNER ASSESSMENT REPORT CARD', false, true);

  /* ── Student Details Panel ── */
  const panelY = 49;
  doc.setFillColor(240, 245, 255);
  doc.rect(M, panelY, W - M * 2, 26, 'F');
  doc.setFillColor(0, 32, 96);
  doc.rect(M, panelY, W - M * 2, 5.5, 'F');
  doc.setDrawColor(180, 195, 220); doc.setLineWidth(0.2);
  doc.rect(M, panelY, W - M * 2, 26, 'S');
  doc.setTextColor(253, 224, 71); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
  doc.text("LEARNER'S OFFICIAL DETAILS", M + 2, panelY + 4);

  const c1 = M + 2, c2 = M + 68, c3 = M + 130;
  doc.setFontSize(7.5); doc.setTextColor(0, 0, 0);
  const lbl = (t: string, x: number, y: number) => { doc.setFont('helvetica', 'bold'); doc.text(t, x, y); };
  const val = (t: string, x: number, y: number) => { doc.setFont('helvetica', 'normal'); doc.text(t, x, y); };
  lbl('NAME:',      c1, panelY + 11); val(student.name.toUpperCase(), c1 + 14, panelY + 11);
  lbl('ADM NO:',    c2, panelY + 11); val(student.admission_number,   c2 + 17, panelY + 11);
  lbl('GENDER:',    c3, panelY + 11); val(student.gender?.toUpperCase() || '-', c3 + 16, panelY + 11);
  lbl('GRADE:',     c1, panelY + 18); val(grade?.grade_name?.toUpperCase() || '-', c1 + 14, panelY + 18);
  lbl('TERM:',      c2, panelY + 18); val(term || exam?.term || 'All Terms', c2 + 12, panelY + 18);
  lbl('YEAR:',      c3, panelY + 18); val(year, c3 + 11, panelY + 18);
  lbl('EXAM:',      c1, panelY + 24); val(exam?.exam_name || 'All Exams', c1 + 12, panelY + 24);
  lbl('RANK:',      c2, panelY + 24); val(student.rank ? `${student.rank} / ${student.totalStudents}` : '—', c2 + 12, panelY + 24);

  /* ── Marks Table ── */
  const tableY = panelY + 29;

  if (subjectMarks.length === 0) {
    doc.setTextColor(120, 130, 150); doc.setFontSize(9); doc.setFont('helvetica', 'italic');
    doc.text('No marks recorded for this student.', W / 2, tableY + 20, { align: 'center' });
  } else {
    autoTable(doc, {
      startY: tableY,
      head: [['LEARNING AREA', 'MARKS\n(/100)', 'GRADE', 'RUBRIC\nPOINTS', 'PERFORMANCE LEVEL', "TEACHER'S NAME"]],
      body: subjectMarks.map(m => {
        const r = getRubric(m.score);
        return [m.subject_name, m.score, r.code, r.pts, r.label, m.teacher_name || '—'];
      }),
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2.2, lineColor: [180, 195, 220], lineWidth: 0.2 },
      headStyles: {
        fillColor: [0, 32, 96], textColor: [253, 224, 71], fontStyle: 'bold',
        fontSize: 7.5, halign: 'center', lineColor: [0, 32, 96], lineWidth: 0.3,
      },
      alternateRowStyles: { fillColor: [247, 250, 255] },
      columnStyles: {
        0: { cellWidth: 52 },
        1: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: 52 },
        5: { cellWidth: 28 },
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          if (data.column.index === 1) {
            const val = parseFloat(String(data.cell.text[0]));
            if (!isNaN(val)) data.cell.styles.textColor = getRubric(val).color as any;
          }
          if (data.column.index === 2) {
            const code = String(data.cell.text[0]);
            const r = RUBRIC.find(r => r.code === code);
            if (r) data.cell.styles.textColor = r.color as any;
          }
        }
      },
    });

    const fy = (doc as any).lastAutoTable.finalY;
    const totalScore = subjectMarks.reduce((a, b) => a + b.score, 0);
    const avg = totalScore / subjectMarks.length;
    const avgR = getRubric(avg);

    // Overall summary row
    doc.setFillColor(0, 32, 96);
    doc.rect(M, fy + 0.5, W - M * 2, 7.5, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text(`OVERALL AVERAGE: ${avg.toFixed(1)} / 100`, M + 4, fy + 5.5);
    doc.text(`GRADE: ${avgR.code}`, M + 80, fy + 5.5);
    doc.text(`RUBRIC POINTS: ${avgR.pts}`, M + 110, fy + 5.5);
    doc.text(`RANK: ${student.rank || '—'} / ${student.totalStudents || '—'}`, M + 148, fy + 5.5);

    /* ── Performance Trend Chart ── */
    const chartY = fy + 12;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0, 32, 96);
    doc.text('LEARNER PERFORMANCE TREND — Subject Overview', W / 2, chartY + 3, { align: 'center' });

    const chartH = 32;
    const chartW = W - M * 2;
    doc.setDrawColor(200, 210, 230); doc.setLineWidth(0.2);
    doc.setFillColor(248, 250, 255);
    doc.rect(M, chartY + 5, chartW, chartH, 'FD');

    // Gridlines & Y-axis labels
    doc.setFontSize(5); doc.setFont('helvetica', 'normal'); doc.setTextColor(140, 150, 165);
    [0, 25, 50, 75, 100].forEach(v => {
      const y = chartY + 5 + chartH - (v / 100 * chartH);
      doc.text(String(v), M - 1, y + 1, { align: 'right' });
      doc.setDrawColor(220, 225, 235); doc.setLineWidth(0.1);
      doc.line(M, y, M + chartW, y);
    });

    if (subjectMarks.length > 0) {
      const spacing = chartW / (subjectMarks.length + 1);

      // Previous exam line (if available)
      if (prevSubjectMarks && prevSubjectMarks.length > 0) {
        const prevPts = subjectMarks.map((m, i) => {
          const prev = prevSubjectMarks.find(p => p.subject_name === m.subject_name);
          return {
            x: M + spacing * (i + 1),
            y: chartY + 5 + chartH - (Math.min(prev?.score ?? 0, 100) / 100 * chartH),
          };
        });
        doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.5);
        for (let i = 0; i < prevPts.length - 1; i++)
          doc.line(prevPts[i].x, prevPts[i].y, prevPts[i + 1].x, prevPts[i + 1].y);
        prevPts.forEach(p => { doc.setFillColor(180, 180, 180); doc.circle(p.x, p.y, 1, 'F'); });
      }

      // Current exam line
      const pts = subjectMarks.map((m, i) => ({
        x: M + spacing * (i + 1),
        y: chartY + 5 + chartH - (Math.min(m.score, 100) / 100 * chartH),
        score: m.score,
        name: m.subject_name.length > 8 ? m.subject_name.substring(0, 8) : m.subject_name,
      }));

      // Fill area under line
      doc.setFillColor(0, 82, 204, 0.08 as any);
      const areaPath = [
        [pts[0].x, chartY + 5 + chartH],
        ...pts.map(p => [p.x, p.y]),
        [pts[pts.length - 1].x, chartY + 5 + chartH],
      ];
      // Draw filled polygon approximation
      doc.setFillColor(220, 230, 255);
      doc.setDrawColor(220, 230, 255);

      doc.setDrawColor(0, 82, 204); doc.setLineWidth(0.8);
      for (let i = 0; i < pts.length - 1; i++)
        doc.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);

      pts.forEach(p => {
        const r = getRubric(p.score);
        doc.setFillColor(...hexToRgb(r.color) as [number, number, number]);
        doc.circle(p.x, p.y, 1.5, 'F');
        doc.setTextColor(0, 0, 0); doc.setFontSize(5.5); doc.setFont('helvetica', 'bold');
        doc.text(String(p.score), p.x, p.y - 2.5, { align: 'center' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(4.8); doc.setTextColor(80, 90, 110);
        doc.text(p.name, p.x, chartY + 5 + chartH + 4.5, { align: 'center' });
      });
    }

    // Chart legend
    const legendY = chartY + chartH + 11;
    if (prevSubjectMarks && prevSubjectMarks.length > 0) {
      doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.5);
      doc.line(M + 3, legendY, M + 10, legendY);
      doc.setTextColor(120, 120, 120); doc.setFontSize(6);
      doc.text('Previous Exam', M + 12, legendY + 1);
      doc.setDrawColor(0, 82, 204); doc.setLineWidth(0.8);
      doc.line(M + 40, legendY, M + 47, legendY);
      doc.setFillColor(0, 82, 204); doc.circle(M + 43.5, legendY, 1, 'F');
      doc.setTextColor(0, 32, 96);
      doc.text('Current Exam', M + 49, legendY + 1);
    }

    /* ── Attendance Bar ── */
    const attY = legendY + 5;
    doc.setFillColor(235, 242, 255);
    doc.rect(M, attY, W - M * 2, 8, 'F');
    doc.setDrawColor(0, 82, 204); doc.setLineWidth(0.2);
    doc.rect(M, attY, W - M * 2, 8, 'S');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(0, 32, 96);
    doc.text(
      `ATTENDANCE  •  Sessions: ${att.total}  |  Present: ${att.present}  |  Absent: ${att.absent}  |  Late: ${att.late}  |  Attendance Rate: ${att.rate}%`,
      W / 2, attY + 5.5, { align: 'center' },
    );

    /* ── Remarks ── */
    const remarks = getRemarks(avg);
    const remY = attY + 11;
    const halfW = (W - M * 2 - 4) / 2;

    // Class teacher box
    doc.setFillColor(248, 252, 255);
    doc.setDrawColor(180, 195, 220); doc.setLineWidth(0.3);
    doc.rect(M, remY, halfW, 32, 'FD');
    doc.setFillColor(0, 32, 96);
    doc.rect(M, remY, halfW, 6, 'F');
    doc.setTextColor(253, 224, 71); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text("CLASS TEACHER'S REMARKS", M + 3, remY + 4.5);
    doc.setTextColor(40, 50, 70); doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5);
    doc.text(remarks.teacher, M + 3, remY + 11, { maxWidth: halfW - 5 });
    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.text('Name: ___________________________', M + 3, remY + 25);
    doc.text('Sign: ________________  Date: _______', M + 3, remY + 30);

    // Principal box
    doc.setFillColor(248, 252, 255);
    doc.rect(M + halfW + 4, remY, halfW, 32, 'FD');
    doc.setFillColor(0, 32, 96);
    doc.rect(M + halfW + 4, remY, halfW, 6, 'F');
    doc.setTextColor(253, 224, 71); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text("PRINCIPAL'S REMARKS", M + halfW + 7, remY + 4.5);
    doc.setTextColor(40, 50, 70); doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5);
    doc.text(remarks.principal, M + halfW + 7, remY + 11, { maxWidth: halfW - 5 });
    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.text('Name: ___________________________', M + halfW + 7, remY + 25);
    doc.text('Sign: ________________  Date: _______', M + halfW + 7, remY + 30);

    /* ── Term Dates / Fee Grid ── */
    const feeY = remY + 35;
    doc.setDrawColor(180, 195, 220); doc.setLineWidth(0.2);
    doc.rect(M, feeY, W - M * 2, 14, 'S');
    doc.line(W / 2, feeY, W / 2, feeY + 14);
    doc.line(M, feeY + 7, W - M, feeY + 7);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(0, 0, 0);
    doc.text('Term Closed:', M + 3, feeY + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }), M + 28, feeY + 5);
    doc.setFont('helvetica', 'bold'); doc.text('Next Term Opens:', W / 2 + 3, feeY + 5);
    doc.setFont('helvetica', 'normal'); doc.text('—', W / 2 + 36, feeY + 5);
    doc.setFont('helvetica', 'bold'); doc.text('Fee Balance: Ksh. 0.00', M + 3, feeY + 12);
    doc.setFont('helvetica', 'bold'); doc.text('Next Term Fee: Ksh. 0.00', W / 2 + 3, feeY + 12);

    /* ── Authenticity notice ── */
    doc.setFont('helvetica', 'italic'); doc.setFontSize(6.5); doc.setTextColor(0, 32, 96);
    doc.text(
      'This Report Card has been issued without alteration. Any form of alteration invalidates its authenticity.',
      W / 2, feeY + 20, { align: 'center' },
    );
  }

  drawPDFFooter(doc, school);
  doc.save(`ReportCard_${student.name.replace(/\s+/g, '_')}_${year}.pdf`);
}

/* ─── Hex → RGB helper ────────────────────────────────────────────────────── */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

/* ─── UI Primitives ───────────────────────────────────────────────────────── */
const Skel = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700/50 ${className}`} />
);

const RubricBadge = ({ score }: { score: number }) => {
  const r = getRubric(score);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
      style={{ background: r.bg, color: r.text }}>
      {r.code} · {r.pts}pts
    </span>
  );
};

const KpiCard = ({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</div>
    <div className="text-2xl font-black" style={{ color: accent }}>{value}</div>
    {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
  </div>
);

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function InsightsCenter() {
  const { user } = useAuth();
  const sid = user?.school_id;

  // ── Filters ──
  const [tab,     setTab]     = useState<'overview' | 'rankings' | 'reportcards'>('overview');
  const [year,    setYear]    = useState(String(new Date().getFullYear()));
  const [term,    setTerm]    = useState('');
  const [gradeId, setGradeId] = useState('');
  const [examId,  setExamId]  = useState('');
  const [prevExamId, setPrevExamId] = useState('');
  const [search,  setSearch]  = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [bulkLoading,  setBulkLoading]  = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  // ── Data ──
  const [school,     setSchool]     = useState<School | undefined>();
  const [grades,     setGrades]     = useState<Grade[]>([]);
  const [subjects,   setSubjects]   = useState<Subject[]>([]);
  const [exams,      setExams]      = useState<Exam[]>([]);
  const [students,   setStudents]   = useState<Student[]>([]);
  const [marks,      setMarks]      = useState<Mark[]>([]);
  const [prevMarks,  setPrevMarks]  = useState<Mark[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [logo, setLogo] = useState<{ data: string; fmt: 'PNG' | 'JPEG' } | null>(null);

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return [y, y - 1, y - 2, y - 3].map(String);
  }, []);

  // ── Fetchers ──
  useEffect(() => {
    if (!sid) return;
    const fetchSchool = async () => {
      let { data } = await supabase
        .from('schools')
        .select('id,name,logo_url,motto,address,phone,email,website')
        .eq('id', sid).maybeSingle();
      if (!data) {
        const { data: d2 } = await supabase
          .from('schools')
          .select('id,name,logo_url,motto,address,phone,email,website')
          .eq('id', Number(sid)).maybeSingle();
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
    if (examId)  q = q.eq('exam_id', examId);
    q.then(({ data }) => { setMarks(data || []); setLoading(false); });
  }, [sid, gradeId, examId]);

  useEffect(() => {
    if (!sid || !prevExamId) { setPrevMarks([]); return; }
    let q = supabase.from('marks')
      .select('id,student_id,subject_id,exam_id,score,school_id,teacher_remark,grade_id,teacher_id')
      .eq('school_id', sid).eq('exam_id', prevExamId);
    if (gradeId) q = q.eq('grade_id', gradeId);
    q.then(({ data }) => setPrevMarks(data || []));
  }, [sid, prevExamId, gradeId]);

  useEffect(() => {
    if (!sid) return;
    let q = supabase.from('attendance')
      .select('id,school_id,student_id,grade_id,date,status')
      .eq('school_id', sid);
    if (gradeId) q = q.eq('grade_id', gradeId);
    q.then(({ data }) => setAttendance(data || []));
  }, [sid, gradeId]);

  // ── Derived ──
  const filteredExams = useMemo(() =>
    exams.filter(e => !gradeId || e.grade_id === gradeId || e.is_school_wide),
    [exams, gradeId]);

  const rankings = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    marks.forEach(m => {
      if (!map[m.student_id]) map[m.student_id] = { total: 0, count: 0 };
      map[m.student_id].total += m.score;
      map[m.student_id].count++;
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

  const classStats = useMemo(() => {
    const scores = marks.map(m => m.score);
    if (!scores.length) return null;
    const avg  = scores.reduce((a, b) => a + b, 0) / scores.length;
    const pass = scores.filter(s => s >= 41).length / scores.length * 100;
    const highest = Math.max(...scores);
    const lowest  = Math.min(...scores);
    return { avg, pass, highest, lowest, count: students.length, r: getRubric(avg) };
  }, [marks, students]);

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
      return m ? {
        subject_name: subj.subject_name,
        subject_code: subj.subject_code,
        score: m.score,
        teacher_remark: m.teacher_remark,
      } : null;
    }).filter(Boolean) as { subject_name: string; subject_code: string; score: number; teacher_remark?: string }[],
    [marks, subjects]);

  const getPrevStudentMarks = useCallback((studentId: string) =>
    subjects.map(subj => {
      const m = prevMarks.find(mk => mk.student_id === studentId && mk.subject_id === subj.id);
      return m ? { subject_name: subj.subject_name, score: m.score } : null;
    }).filter(Boolean) as { subject_name: string; score: number }[],
    [prevMarks, subjects]);

  const getStudentAtt = useCallback((studentId: string) => {
    const sa = attendance.filter(a => a.student_id === studentId && new Date(a.date).getFullYear() === Number(year));
    return {
      total: sa.length,
      present: sa.filter(a => a.status === 'present').length,
      absent:  sa.filter(a => a.status === 'absent').length,
      late:    sa.filter(a => a.status === 'late').length,
      rate:    sa.length ? Math.round(sa.filter(a => a.status === 'present').length / sa.length * 100) : 0,
    };
  }, [attendance, year]);

  // ── Export handlers ──
  const handleGenReportCard = useCallback(async (student: Student) => {
    const rank = rankings.find(r => r.id === student.id);
    await generateReportCard({
      school, logo,
      student: { ...student, rank: rank?.rank, totalStudents: rankings.length },
      grade: grades.find(g => g.id === student.grade_id),
      exam:  exams.find(e => e.id === examId),
      year, term,
      subjectMarks: getStudentMarks(student.id),
      att: getStudentAtt(student.id),
      prevSubjectMarks: prevExamId ? getPrevStudentMarks(student.id) : undefined,
    });
  }, [school, logo, grades, exams, examId, year, term, rankings, getStudentMarks, getStudentAtt, getPrevStudentMarks, prevExamId]);

  const handleGenRankingsPDF = useCallback(async () => {
    if (!gradeId) { alert('Please select a grade first.'); return; }
    await generateRankingsPDF({
      school, logo,
      gradeName: grades.find(g => g.id === gradeId)?.grade_name || 'Class',
      examName:  exams.find(e => e.id === examId)?.exam_name    || 'All Exams',
      year, term, rankings, subjects, marks,
      prevMarks:     prevExamId ? prevMarks : undefined,
      prevExamName:  prevExamId ? exams.find(e => e.id === prevExamId)?.exam_name : undefined,
    });
  }, [school, logo, grades, gradeId, exams, examId, year, term, rankings, subjects, marks, prevMarks, prevExamId]);

  const exportRankingsExcel = useCallback(() => {
    if (!gradeId) { alert('Please select a grade first.'); return; }
    const subjectCols = subjects.filter(s => marks.some(m => m.subject_id === s.id));
    const wb = XLSX.utils.book_new();

    // Sheet 1: Rankings with all subject marks
    const rows = rankings.map(s => {
      const row: Record<string, any> = {
        Rank: s.rank,
        'Student Name': s.name,
        'Adm No': s.admission_number,
        Gender: s.gender,
        Class: grades.find(g => g.id === s.grade_id)?.grade_name || '',
      };
      subjectCols.forEach(subj => {
        const m = marks.find(mk => mk.student_id === s.id && mk.subject_id === subj.id);
        row[subj.subject_name] = m ? m.score : '';
      });
      row['Total'] = s.total;
      row['Average (%)'] = s.avg;
      row['Grade (PL)'] = getRubric(s.avg).code;
      row['Performance Level'] = getRubric(s.avg).label;
      row['Rubric Points'] = getRubric(s.avg).pts;
      return row;
    });
    const ws1 = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws1, 'Rankings');

    // Sheet 2: Subject Analysis
    const subjRows = subjects.map(subj => {
      const sm = marks.filter(m => m.subject_id === subj.id);
      if (!sm.length) return null;
      const avg = sm.reduce((a, b) => a + b.score, 0) / sm.length;
      const r   = getRubric(avg);
      return {
        'Subject': subj.subject_name,
        'Code': subj.subject_code,
        'Entries': sm.length,
        'Mean (%)': avg.toFixed(1),
        'Grade': r.code,
        'Performance Level': r.label,
        'Rubric Points': r.pts,
        'Pass% (≥41)': (sm.filter(m => m.score >= 41).length / sm.length * 100).toFixed(1) + '%',
        'Highest': Math.max(...sm.map(m => m.score)),
        'Lowest':  Math.min(...sm.map(m => m.score)),
      };
    }).filter(Boolean);
    const ws2 = XLSX.utils.json_to_sheet(subjRows as any);
    XLSX.utils.book_append_sheet(wb, ws2, 'Subject Analysis');

    // Sheet 3: Grading Rubric
    const rubricRows = RUBRIC.map(r => ({
      Code: r.code, 'Performance Level': r.label,
      'Min Score': r.min, 'Max Score': r.max, 'Rubric Points': r.pts,
    }));
    const ws3 = XLSX.utils.json_to_sheet(rubricRows);
    XLSX.utils.book_append_sheet(wb, ws3, 'Grading Rubric');

    const gradeName = grades.find(g => g.id === gradeId)?.grade_name || 'Class';
    const examName  = exams.find(e => e.id === examId)?.exam_name    || 'AllExams';
    XLSX.writeFile(wb, `Rankings_${gradeName}_${examName}_${year}.xlsx`);
  }, [rankings, subjects, marks, grades, gradeId, exams, examId, year]);

  const handleBulkPDF = useCallback(async () => {
    if (!filteredStudents.length) return;
    setBulkLoading(true); setBulkProgress(0);
    const limit = Math.min(filteredStudents.length, 100);
    for (let i = 0; i < limit; i++) {
      await handleGenReportCard(filteredStudents[i]);
      setBulkProgress(Math.round((i + 1) / limit * 100));
      await new Promise(r => setTimeout(r, 180));
    }
    setBulkLoading(false); setBulkProgress(0);
  }, [filteredStudents, handleGenReportCard]);

  /* ─── RENDER ─────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">

      {/* ── Sticky Header ── */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto">
          {/* Top row: Title + Filters */}
          <div className="flex items-start justify-between flex-wrap gap-4 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-1.5 h-5 rounded-full" style={{ background: 'linear-gradient(#002060,#0052cc)' }} />
                <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-blue-800 dark:text-blue-400">Insights Center</span>
              </div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">Academic Reports & Rankings</h1>
              <p className="text-xs text-slate-500 mt-0.5">{school?.name || '—'} · CBC 8-Level Grading System</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { val: year,    set: setYear,    opts: yearOptions.map(y => ({ v: y, l: y })),                                                  ph: 'Year'      },
                { val: term,    set: setTerm,    opts: [{ v: '', l: 'All Terms' }, ...['Term 1','Term 2','Term 3'].map(t => ({ v: t, l: t }))], ph: 'Term'      },
                { val: gradeId, set: (v: string) => { setGradeId(v); setExamId(''); setPrevExamId(''); },
                                                 opts: [{ v: '', l: 'All Grades' }, ...grades.map(g => ({ v: g.id, l: g.grade_name }))],       ph: 'Grade'     },
                { val: examId,  set: setExamId,  opts: [{ v: '', l: 'All Exams' }, ...filteredExams.map(e => ({ v: e.id, l: e.exam_name }))],   ph: 'Exam'      },
                { val: prevExamId, set: setPrevExamId, opts: [{ v: '', l: 'Compare With…' }, ...filteredExams.filter(e => e.id !== examId).map(e => ({ v: e.id, l: e.exam_name }))], ph: 'Compare' },
              ].map(f => (
                <select key={f.ph} value={f.val} onChange={e => f.set(e.target.value)}
                  className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-600 cursor-pointer">
                  {f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              ))}
            </div>
          </div>

          {/* Tab row */}
          <div className="flex gap-1">
            {([
              { key: 'overview',    label: '📊 Overview'    },
              { key: 'rankings',    label: '🏆 Rankings'    },
              { key: 'reportcards', label: '📄 Report Cards' },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t.key ? 'text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                style={tab === t.key ? { background: '#002060' } : {}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-7xl mx-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>

            {/* ════ OVERVIEW ════ */}
            {tab === 'overview' && (
              <div className="space-y-6">
                {/* KPI row */}
                {!gradeId ? (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center">
                    <div className="text-3xl mb-3">📊</div>
                    <div className="font-semibold text-slate-700 dark:text-slate-300">Select a grade to view the exam overview</div>
                    <div className="text-sm text-slate-400 mt-1">Use the Grade dropdown above to get started</div>
                  </div>
                ) : loading ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-24" />)}
                  </div>
                ) : (
                  <>
                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <KpiCard label="Students" value={String(classStats?.count ?? 0)} sub={grades.find(g => g.id === gradeId)?.grade_name} accent="#002060" />
                      <KpiCard label="Class Mean" value={classStats ? `${classStats.avg.toFixed(1)}%` : '—'} sub={classStats?.r.label} accent={classStats?.r.color ?? '#94a3b8'} />
                      <KpiCard label="Pass Rate" value={classStats ? `${classStats.pass.toFixed(1)}%` : '—'} sub="Score ≥ 41" accent="#15803d" />
                      <KpiCard label="Class PL" value={classStats?.r.code ?? '—'} sub={classStats ? `${classStats.r.pts} rubric points` : undefined} accent={classStats?.r.color ?? '#94a3b8'} />
                    </div>

                    {/* Exam Summary Cards */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h2 className="font-bold text-slate-900 dark:text-white">Current Exam Summary</h2>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {exams.find(e => e.id === examId)?.exam_name || 'All Exams'} · {grades.find(g => g.id === gradeId)?.grade_name} · {year}
                          </p>
                        </div>
                        {examId && gradeId && (
                          <div className="flex gap-2">
                            <button onClick={exportRankingsExcel}
                              className="px-3 py-2 rounded-xl text-xs font-semibold border border-green-300 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors">
                              ⬇ Excel
                            </button>
                            <button onClick={handleGenRankingsPDF}
                              className="px-3 py-2 rounded-xl text-white text-xs font-semibold transition-colors"
                              style={{ background: '#002060' }}>
                              ⬇ PDF Report
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Subject performance table */}
                      {marks.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-sm">No marks data for the current filters</div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                          <table className="w-full text-sm">
                            <thead>
                              <tr style={{ background: '#002060' }}>
                                {['#', 'Learning Area', 'Code', 'N', 'Mean', 'PL', 'Pts', 'Pass%', 'Highest', 'Lowest', 'Bar'].map(h => (
                                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-yellow-400 whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {subjects.map((subj, i) => {
                                const sm = marks.filter(m => m.subject_id === subj.id);
                                if (!sm.length) return null;
                                const avg  = sm.reduce((a, b) => a + b.score, 0) / sm.length;
                                const r    = getRubric(avg);
                                const pass = sm.filter(m => m.score >= 41).length / sm.length * 100;
                                return (
                                  <tr key={subj.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                    <td className="px-3 py-2.5 text-slate-400 text-xs">{i + 1}</td>
                                    <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">{subj.subject_name}</td>
                                    <td className="px-3 py-2.5 text-xs text-slate-500">{subj.subject_code}</td>
                                    <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-400 text-xs">{sm.length}</td>
                                    <td className="px-3 py-2.5 font-bold" style={{ color: r.color }}>{avg.toFixed(1)}%</td>
                                    <td className="px-3 py-2.5"><RubricBadge score={avg} /></td>
                                    <td className="px-3 py-2.5 font-bold text-center" style={{ color: r.color }}>{r.pts}</td>
                                    <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: pass >= 50 ? '#15803d' : '#dc2626' }}>{pass.toFixed(0)}%</td>
                                    <td className="px-3 py-2.5 text-xs text-center font-bold text-green-700">{Math.max(...sm.map(m => m.score))}</td>
                                    <td className="px-3 py-2.5 text-xs text-center font-bold text-red-600">{Math.min(...sm.map(m => m.score))}</td>
                                    <td className="px-3 py-2.5 w-24">
                                      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${avg}%`, background: r.color }} />
                                      </div>
                                    </td>
                                  </tr>
                                );
                              }).filter(Boolean)}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Rubric distribution */}
                    {marks.length > 0 && (
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                        <h3 className="font-bold text-slate-900 dark:text-white mb-4">Grade Distribution</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {RUBRIC.map(r => {
                            const cnt  = marks.filter(m => m.score >= r.min && m.score <= r.max).length;
                            const pct  = marks.length ? (cnt / marks.length * 100) : 0;
                            return (
                              <div key={r.code} className="rounded-xl p-3 border" style={{ background: r.bg, borderColor: r.color + '40' }}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold" style={{ color: r.text }}>{r.code}</span>
                                  <span className="text-[10px] font-semibold" style={{ color: r.text }}>{r.pts}pts</span>
                                </div>
                                <div className="text-lg font-black" style={{ color: r.color }}>{cnt}</div>
                                <div className="text-[10px]" style={{ color: r.text }}>{pct.toFixed(1)}% · {r.min}–{r.max}</div>
                                <div className="mt-1.5 h-1 rounded-full overflow-hidden bg-white/50">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.color }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ════ RANKINGS ════ */}
            {tab === 'rankings' && (
              <div className="space-y-5">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                  <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
                    <div>
                      <h2 className="font-bold text-slate-900 dark:text-white">Student Rankings</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {filteredRankings.length} students ranked · {grades.find(g => g.id === gradeId)?.grade_name || 'All Grades'} · {exams.find(e => e.id === examId)?.exam_name || 'All Exams'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <div className="relative">
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student…"
                          className="pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-600 text-slate-700 dark:text-slate-200 w-44" />
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                      </div>
                      <button onClick={exportRankingsExcel} disabled={!gradeId}
                        className="px-3 py-2 rounded-xl text-xs font-semibold border border-green-300 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 disabled:opacity-40 transition-colors">
                        ⬇ Excel
                      </button>
                      <button onClick={handleGenRankingsPDF} disabled={!gradeId}
                        className="px-4 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-40 transition-colors"
                        style={{ background: '#002060' }}>
                        ⬇ PDF (3 Pages)
                      </button>
                    </div>
                  </div>

                  {!gradeId ? (
                    <div className="text-center py-16 text-slate-400 text-sm">Select a grade to view rankings</div>
                  ) : loading ? (
                    <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skel key={i} className="h-12" />)}</div>
                  ) : filteredRankings.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 text-sm">No ranking data available</div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: '#002060' }}>
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-yellow-400 w-12">Rank</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-yellow-400">Student</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-yellow-400">Adm No</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-yellow-400">Gender</th>
                            {subjects.filter(s => marks.some(m => m.subject_id === s.id)).map(s => (
                              <th key={s.id} className="px-2 py-2.5 text-center text-[10px] font-bold uppercase text-yellow-400 whitespace-nowrap">
                                {s.subject_code || s.subject_name.substring(0, 5)}
                              </th>
                            ))}
                            <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase text-yellow-400">Total</th>
                            <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase text-yellow-400">Avg%</th>
                            <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase text-yellow-400">PL</th>
                            <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase text-yellow-400">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRankings.map(s => {
                            const r = getRubric(s.avg);
                            const activeSubs = subjects.filter(sub => marks.some(m => m.subject_id === sub.id));
                            return (
                              <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="px-3 py-2.5 font-black text-sm" style={{
                                  color: s.rank === 1 ? '#b45309' : s.rank === 2 ? '#64748b' : s.rank === 3 ? '#92400e' : '#94a3b8'
                                }}>
                                  {s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : `#${s.rank}`}
                                </td>
                                <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-100">{s.name}</td>
                                <td className="px-3 py-2.5 text-xs text-slate-500">{s.admission_number}</td>
                                <td className="px-3 py-2.5 text-xs text-slate-500">{s.gender}</td>
                                {activeSubs.map(subj => {
                                  const m = marks.find(mk => mk.student_id === s.id && mk.subject_id === subj.id);
                                  const sr = m ? getRubric(m.score) : null;
                                  return (
                                    <td key={subj.id} className="px-2 py-2.5 text-center text-xs font-bold"
                                      style={{ color: sr?.color ?? '#94a3b8' }}>
                                      {m ? m.score : '—'}
                                    </td>
                                  );
                                })}
                                <td className="px-3 py-2.5 text-center font-bold text-slate-700 dark:text-slate-200">{s.total}</td>
                                <td className="px-3 py-2.5 text-center font-bold" style={{ color: r.color }}>{s.avg}%</td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: r.bg, color: r.text }}>{r.code}</span>
                                </td>
                                <td className="px-3 py-2.5 text-center font-bold" style={{ color: r.color }}>{r.pts}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {classStats && (
                          <tfoot>
                            <tr style={{ background: '#002060' }}>
                              <td colSpan={4} className="px-3 py-2.5 text-[10px] font-bold text-yellow-400 uppercase">Class Summary</td>
                              {subjects.filter(s => marks.some(m => m.subject_id === s.id)).map(subj => {
                                const sm = marks.filter(m => m.subject_id === subj.id);
                                const a  = sm.length ? sm.reduce((a, b) => a + b.score, 0) / sm.length : 0;
                                return (
                                  <td key={subj.id} className="px-2 py-2.5 text-center text-[10px] font-bold text-white">{a.toFixed(0)}</td>
                                );
                              })}
                              <td className="px-3 py-2.5 text-center text-[10px] font-bold text-white">—</td>
                              <td className="px-3 py-2.5 text-center text-[10px] font-bold text-yellow-400">{classStats.avg.toFixed(1)}%</td>
                              <td className="px-3 py-2.5 text-center">
                                <span className="text-[10px] font-bold text-yellow-400">{classStats.r.code}</span>
                              </td>
                              <td className="px-3 py-2.5 text-center text-[10px] font-bold text-white">{classStats.r.pts}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════ REPORT CARDS ════ */}
            {tab === 'reportcards' && (
              <div className="space-y-5">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
                    <div>
                      <h2 className="font-bold text-slate-900 dark:text-white">Student Report Cards</h2>
                      <p className="text-xs text-slate-500 mt-0.5">{filteredStudents.length} students · CBC 8-Level Grading</p>
                    </div>
                    <div className="flex gap-2 flex-wrap items-center">
                      <div className="relative">
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student…"
                          className="pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-600 text-slate-700 dark:text-slate-200 w-44" />
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                      </div>
                      <button onClick={handleBulkPDF} disabled={bulkLoading || !filteredStudents.length}
                        className="px-4 py-2 rounded-xl text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                        style={{ background: '#002060' }}>
                        {bulkLoading ? `Generating… ${bulkProgress}%` : `⬇ Bulk PDF (${Math.min(filteredStudents.length, 100)})`}
                      </button>
                    </div>
                  </div>

                  {bulkLoading && (
                    <div className="mb-4 h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${bulkProgress}%`, background: 'linear-gradient(90deg,#002060,#0052cc)' }} />
                    </div>
                  )}

                  {loading ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-24" />)}
                    </div>
                  ) : filteredStudents.length > 0 ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredStudents.map(s => {
                        const sMarks  = getStudentMarks(s.id);
                        const avg     = sMarks.length ? sMarks.reduce((a, b) => a + b.score, 0) / sMarks.length : null;
                        const rank    = rankings.find(r => r.id === s.id);
                        const r       = avg !== null ? getRubric(avg) : null;
                        const isSelected = selectedStudent?.id === s.id;
                        return (
                          <div key={s.id} onClick={() => setSelectedStudent(isSelected ? null : s)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-blue-700 bg-blue-50 dark:bg-blue-900/20 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:border-blue-400 hover:shadow-sm'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                                  style={{ background: r ? r.color : '#94a3b8' }}>{s.name[0]}</div>
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{s.name}</div>
                                  <div className="text-[10px] text-slate-500">{s.admission_number} · {s.gender}</div>
                                </div>
                              </div>
                              {r && <RubricBadge score={avg!} />}
                            </div>
                            {avg !== null && (
                              <div className="mt-2.5 flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${avg}%`, background: r?.color }} />
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{avg.toFixed(1)}%</span>
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

                {/* ── Student Preview Panel ── */}
                <AnimatePresence>
                  {selectedStudent && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">

                      {/* Panel header */}
                      <div className="flex items-start justify-between flex-wrap gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedStudent.name}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {selectedStudent.admission_number} · {selectedStudent.gender} · {grades.find(g => g.id === selectedStudent.grade_id)?.grade_name}
                            {rankings.find(r => r.id === selectedStudent.id) && ` · Rank #${rankings.find(r => r.id === selectedStudent.id)?.rank} of ${rankings.length}`}
                          </p>
                        </div>
                        <button onClick={() => handleGenReportCard(selectedStudent)}
                          className="px-4 py-2 rounded-xl text-white text-xs font-bold shadow-sm transition-colors"
                          style={{ background: '#002060' }}>
                          ⬇ Download PDF Report Card
                        </button>
                      </div>

                      {(() => {
                        const sMarks = getStudentMarks(selectedStudent.id);
                        const att    = getStudentAtt(selectedStudent.id);
                        const avg    = sMarks.length ? sMarks.reduce((a, b) => a + b.score, 0) / sMarks.length : 0;
                        const remarks = getRemarks(avg);

                        return sMarks.length > 0 ? (
                          <div className="space-y-5">
                            {/* Marks table */}
                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr style={{ background: '#002060' }}>
                                    {['Learning Area', 'Marks (/100)', 'Grade', 'Rubric Pts', 'Performance Level', "Teacher's Remark"].map(h => (
                                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-yellow-400 whitespace-nowrap">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {sMarks.map(m => {
                                    const r = getRubric(m.score);
                                    return (
                                      <tr key={m.subject_name} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                        <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">{m.subject_name}</td>
                                        <td className="px-3 py-2.5 font-black text-lg" style={{ color: r.color }}>{m.score}</td>
                                        <td className="px-3 py-2.5">
                                          <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: r.bg, color: r.text }}>{r.code}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-center font-bold" style={{ color: r.color }}>{r.pts}</td>
                                        <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300">{r.label}</td>
                                        <td className="px-3 py-2.5 text-xs text-slate-400 italic">{m.teacher_remark || '—'}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr style={{ background: '#002060' }}>
                                    <td className="px-3 py-2.5 text-xs font-bold text-yellow-400">OVERALL</td>
                                    <td className="px-3 py-2.5 font-black text-white text-lg">{avg.toFixed(1)}%</td>
                                    <td className="px-3 py-2.5"><RubricBadge score={avg} /></td>
                                    <td className="px-3 py-2.5 font-bold text-white text-center">{getRubric(avg).pts}</td>
                                    <td className="px-3 py-2.5 text-xs text-slate-300">{sMarks.length} subjects</td>
                                    <td className="px-3 py-2.5 text-xs text-slate-400">Rank #{rankings.find(r => r.id === selectedStudent.id)?.rank || '—'} / {rankings.length}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>

                            {/* Performance mini-chart */}
                            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Performance Trend — Subject Scores</div>
                              <div className="flex items-end gap-2 h-24">
                                {sMarks.map(m => {
                                  const r   = getRubric(m.score);
                                  const pct = (m.score / 100) * 100;
                                  return (
                                    <div key={m.subject_name} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                                      <div className="text-[10px] font-bold" style={{ color: r.color }}>{m.score}</div>
                                      <div className="w-full rounded-t-lg transition-all"
                                        style={{ height: `${Math.max(pct * 0.8, 4)}px`, background: r.color, minHeight: '4px' }} />
                                      <div className="text-[9px] text-slate-400 truncate w-full text-center">
                                        {m.subject_name.substring(0, 6)}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Bottom row: Attendance + Remarks */}
                            <div className="grid md:grid-cols-3 gap-3">
                              <div className="rounded-xl p-3 border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
                                <div className="text-[10px] font-bold uppercase text-blue-800 dark:text-blue-300 mb-2">Attendance</div>
                                <div className="grid grid-cols-2 gap-y-1 text-xs">
                                  {[['Sessions', att.total], ['Present', att.present], ['Absent', att.absent], ['Rate', `${att.rate}%`]].map(([k, v]) => (
                                    <div key={String(k)} className="flex justify-between gap-2">
                                      <span className="text-slate-500">{k}</span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200">{v}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="rounded-xl p-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                                <div className="text-[10px] font-bold uppercase text-blue-900 dark:text-blue-400 mb-1.5">Class Teacher's Remarks</div>
                                <p className="text-xs italic text-slate-600 dark:text-slate-300 leading-relaxed">{remarks.teacher}</p>
                              </div>

                              <div className="rounded-xl p-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                                <div className="text-[10px] font-bold uppercase text-blue-900 dark:text-blue-400 mb-1.5">Principal's Remarks</div>
                                <p className="text-xs italic text-slate-600 dark:text-slate-300 leading-relaxed">{remarks.principal}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-10 text-slate-400 text-sm">No marks found for current filters</div>
                        );
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}