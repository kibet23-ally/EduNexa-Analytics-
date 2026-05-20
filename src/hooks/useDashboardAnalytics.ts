/**
 * useDashboardAnalytics
 *
 * Replaces all mock data in:
 *  - Academic Performance chart  (avg score per exam, last 6 exams)
 *  - Subject Performance Trend   (avg score per subject, last 6 months)
 *
 * Both queries are school-scoped via Supabase RLS (auth_school_id()).
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AcademicPerformancePoint {
  label: string;   // exam name / term
  avg: number;     // average score (0-100)
  count: number;   // number of marks recorded
}

export interface SubjectTrendPoint {
  subject: string;
  avg: number;
  count: number;
}

export interface DashboardAnalytics {
  academicPerformance: AcademicPerformancePoint[];
  subjectTrend: SubjectTrendPoint[];
  loadingPerformance: boolean;
  loadingTrend: boolean;
  errorPerformance: string | null;
  errorTrend: string | null;
  refetch: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useDashboardAnalytics(): DashboardAnalytics {
  const { user } = useAuth();

  const [academicPerformance, setAcademicPerformance] = useState<AcademicPerformancePoint[]>([]);
  const [subjectTrend, setSubjectTrend]               = useState<SubjectTrendPoint[]>([]);
  const [loadingPerformance, setLoadingPerformance]   = useState(true);
  const [loadingTrend, setLoadingTrend]               = useState(true);
  const [errorPerformance, setErrorPerformance]       = useState<string | null>(null);
  const [errorTrend, setErrorTrend]                   = useState<string | null>(null);

  // ── Academic Performance: avg score per exam (last 6 exams) ─────────────
  const fetchAcademicPerformance = useCallback(async () => {
    if (!user) return;
    setLoadingPerformance(true);
    setErrorPerformance(null);
    try {
      // Get marks joined with exams, grouped by exam
      // We use a raw SQL aggregation via RPC or a subquery approach
      const { data, error } = await supabase
        .from('marks')
        .select(`
          score,
          exam_id,
          exams!inner ( id, exam_name, exam_date )
        `)
        .not('score', 'is', null)
        .order('exam_id', { ascending: false });

      if (error) throw error;

      // Group by exam in JS
      const examMap = new Map<string, { label: string; scores: number[]; date: string }>();
      for (const row of data ?? []) {
        const exam = (row as Record<string, unknown>).exams as { id: number; exam_name: string; exam_date: string } | null;
        if (!exam || row.score === null) continue;
        const key = String(exam.id);
        if (!examMap.has(key)) {
          examMap.set(key, { label: exam.exam_name, scores: [], date: exam.exam_date ?? '' });
        }
        examMap.get(key)!.scores.push(row.score as number);
      }

      // Sort by date desc, take last 6
      const sorted = Array.from(examMap.values())
        .sort((a, b) => (b.date > a.date ? 1 : -1))
        .slice(0, 6)
        .reverse(); // chronological order for chart

      setAcademicPerformance(
        sorted.map(e => ({
          label: e.label,
          avg: Math.round(e.scores.reduce((s, v) => s + v, 0) / e.scores.length),
          count: e.scores.length,
        }))
      );
    } catch (e: unknown) {
      setErrorPerformance(e instanceof Error ? e.message : 'Failed to load performance data');
    } finally {
      setLoadingPerformance(false);
    }
  }, [user]);

  // ── Subject Performance Trend: avg score per subject ────────────────────
  const fetchSubjectTrend = useCallback(async () => {
    if (!user) return;
    setLoadingTrend(true);
    setErrorTrend(null);
    try {
      const { data, error } = await supabase
        .from('marks')
        .select(`
          score,
          subject_id,
          subjects!inner ( id, subject_name )
        `)
        .not('score', 'is', null);

      if (error) throw error;

      // Group by subject
      const subjectMap = new Map<string, { label: string; scores: number[] }>();
      for (const row of data ?? []) {
        const subject = (row as Record<string, unknown>).subjects as { id: number; subject_name: string } | null;
        if (!subject || row.score === null) continue;
        const key = String(subject.id);
        if (!subjectMap.has(key)) {
          subjectMap.set(key, { label: subject.subject_name, scores: [] });
        }
        subjectMap.get(key)!.scores.push(row.score as number);
      }

      const result = Array.from(subjectMap.values())
        .map(s => ({
          subject: s.label,
          avg: Math.round(s.scores.reduce((sum, v) => sum + v, 0) / s.scores.length),
          count: s.scores.length,
        }))
        .sort((a, b) => b.avg - a.avg); // highest avg first

      setSubjectTrend(result);
    } catch (e: unknown) {
      setErrorTrend(e instanceof Error ? e.message : 'Failed to load subject trend');
    } finally {
      setLoadingTrend(false);
    }
  }, [user]);

  const refetch = useCallback(() => {
    fetchAcademicPerformance();
    fetchSubjectTrend();
  }, [fetchAcademicPerformance, fetchSubjectTrend]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    academicPerformance,
    subjectTrend,
    loadingPerformance,
    loadingTrend,
    errorPerformance,
    errorTrend,
    refetch,
  };
}
