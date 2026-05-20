/**
 * Dashboard chart components using real Supabase data.
 * Drop-in replacements for any mock-data versions.
 *
 * Uses recharts (already in your package.json).
 */

import React from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { useDashboardAnalytics } from '../hooks/useDashboardAnalytics';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="animate-pulse" style={{ height }}>
      <div className="flex items-end gap-2 h-full px-4 pb-4">
        {[65, 80, 55, 90, 70, 85].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-gray-100 rounded-t"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <p className="text-sm text-red-400 mb-2">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-blue-500 hover:text-blue-700 font-medium">
          Retry
        </button>
      )}
    </div>
  );
}

// colour ramp: red → amber → green based on score
function scoreColor(avg: number) {
  if (avg >= 70) return '#22c55e';   // green-500
  if (avg >= 50) return '#f59e0b';   // amber-400
  return '#ef4444';                  // red-500
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-3 py-2">
      <p className="text-xs font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs text-gray-500">
          Avg score: <span className="font-bold text-gray-800">{p.value}%</span>
        </p>
      ))}
    </div>
  );
}

// ─── Academic Performance Chart ───────────────────────────────────────────────

export function AcademicPerformanceChart() {
  const { academicPerformance, loadingPerformance, errorPerformance, refetch } =
    useDashboardAnalytics();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">Academic Performance</h3>
          <p className="text-xs text-gray-400 mt-0.5">Average score per exam</p>
        </div>
        {!loadingPerformance && academicPerformance.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> ≥70%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 50–69%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> &lt;50%
            </span>
          </div>
        )}
      </div>

      {loadingPerformance && <ChartSkeleton />}

      {!loadingPerformance && errorPerformance && (
        <ErrorState message={errorPerformance} onRetry={refetch} />
      )}

      {!loadingPerformance && !errorPerformance && academicPerformance.length === 0 && (
        <EmptyState message="No exam results recorded yet." />
      )}

      {!loadingPerformance && !errorPerformance && academicPerformance.length > 0 && (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={academicPerformance}
            margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
            barSize={28}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              interval={0}
              tickFormatter={v => v.length > 12 ? v.slice(0, 12) + '…' : v}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
              {academicPerformance.map((entry, i) => (
                <Cell key={i} fill={scoreColor(entry.avg)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Subject Performance Trend ────────────────────────────────────────────────

export function SubjectPerformanceTrend() {
  const { subjectTrend, loadingTrend, errorTrend, refetch } =
    useDashboardAnalytics();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">Subject Performance</h3>
          <p className="text-xs text-gray-400 mt-0.5">Average score by subject</p>
        </div>
      </div>

      {loadingTrend && <ChartSkeleton height={200} />}

      {!loadingTrend && errorTrend && (
        <ErrorState message={errorTrend} onRetry={refetch} />
      )}

      {!loadingTrend && !errorTrend && subjectTrend.length === 0 && (
        <EmptyState message="No marks recorded yet." />
      )}

      {!loadingTrend && !errorTrend && subjectTrend.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={subjectTrend}
              margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="subject"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                interval={0}
                tickFormatter={v => v.length > 10 ? v.slice(0, 10) + '…' : v}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="avg"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#2563eb' }}
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Subject legend with scores */}
          <div className="mt-4 flex flex-wrap gap-2">
            {subjectTrend.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 text-xs"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: scoreColor(s.avg) }}
                />
                <span className="text-gray-600 font-medium">{s.subject}</span>
                <span className="text-gray-400">{s.avg}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
