import React, { useMemo, useState } from 'react';

import {
  BarChart3,
  Bell,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  Filter,
  GraduationCap,
  LayoutGrid,
  Medal,
  Plus,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';

import { motion } from 'framer-motion';

import { useData } from '../hooks/useData';

/**
 * PREMIUM THEME
 * IMPORTANT:
 * Make sure this file exists:
 *
 * src/styles/premium-theme.css
 */
import '../styles/premium-theme.css';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'assessments', label: 'Assessments', icon: ClipboardCheck },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'rankings', label: 'Rankings', icon: Medal },
  { id: 'competencies', label: 'Competencies', icon: BrainCircuit },
  { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const AssessmentHub = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');

  const data = useData?.() || {};

  const assessments = Array.isArray(data.assessments)
    ? data.assessments
    : [];

  const students = Array.isArray(data.students)
    ? data.students
    : [];

  const rankings = Array.isArray(data.rankings)
    ? data.rankings
    : [];

  const analytics = data.analytics || {};
  const loading = data.loading || false;

  /**
   * KPI calculations
   */
  const kpis = useMemo(() => {
    const publishedAssessments = assessments.filter(
      (item: any) => item?.status === 'published'
    );

    const totalMean = assessments.reduce(
      (acc: number, item: any) =>
        acc + Number(item?.mean_score || 0),
      0
    );

    const averageScore =
      assessments.length > 0
        ? (totalMean / assessments.length).toFixed(1)
        : '0';

    return [
      {
        title: 'Total Assessments',
        value: assessments.length,
        icon: ClipboardCheck,
      },
      {
        title: 'Students Assessed',
        value: students.length,
        icon: Users,
      },
      {
        title: 'Average Mean Score',
        value: `${averageScore}%`,
        icon: TrendingUp,
      },
      {
        title: 'Published Results',
        value: publishedAssessments.length,
        icon: GraduationCap,
      },
    ];
  }, [assessments, students]);

  /**
   * Search filtering
   */
  const filteredAssessments = useMemo(() => {
    return assessments.filter((assessment: any) =>
      String(assessment?.name || '')
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [assessments, search]);

  const currentTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTab),
    [activeTab]
  );

  return (
    <div className="premium-page">
      {/* Header */}
      <div className="premium-header">
        <div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-400 shadow-lg">
              <BookOpen className="w-7 h-7 text-white" />
            </div>

            <div>
              <h1 className="premium-title">
                Assessment Hub
              </h1>

              <p className="premium-subtitle">
                Premium academic assessment intelligence center
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="btn-secondary">
            <Bell className="w-4 h-4" />
            Notifications
          </button>

          <button className="btn-secondary">
            <Download className="w-4 h-4" />
            Export
          </button>

          <button className="btn-primary">
            <Plus className="w-4 h-4" />
            Create Assessment
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8 mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-4 w-4 h-4 text-slate-400" />

          <input
            type="text"
            placeholder="Search assessments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="premium-input pl-11"
          />
        </div>

        <select className="premium-select">
          <option>Academic Year</option>
        </select>

        <select className="premium-select">
          <option>Term</option>
        </select>

        <button className="btn-secondary">
          <Filter className="w-4 h-4" />
          More Filters
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid mb-8">
        {kpis.map((item, index) => {
          const Icon = item.icon;

          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="kpi-card"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="kpi-label">
                    {item.title}
                  </p>

                  <h2 className="kpi-value">
                    {loading ? '...' : item.value}
                  </h2>
                </div>

                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-indigo-100">
                  <Icon className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-3 overflow-x-auto mb-8">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={
                active
                  ? 'btn-primary'
                  : 'btn-secondary'
              }
            >
              <Icon className="w-4 h-4" />

              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="xl:col-span-3">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="premium-card p-6"
          >
            {/* OVERVIEW */}
            {activeTab === 'overview' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">
                      Academic Overview
                    </h2>

                    <p className="text-slate-500 mt-1">
                      Real-time assessment intelligence
                    </p>
                  </div>
                </div>

                {loading ? (
                  <div className="empty-state">
                    Loading analytics...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Analytics Card */}
                    <div className="premium-card p-5 min-h-[320px]">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="font-semibold text-slate-800">
                          Performance Analytics
                        </h3>

                        <BarChart3 className="w-5 h-5 text-indigo-500" />
                      </div>

                      <div className="flex items-center justify-center h-56 text-slate-400">
                        Integrate charts here
                      </div>
                    </div>

                    {/* Insights */}
                    <div className="premium-card p-5">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="font-semibold text-slate-800">
                          AI Insights
                        </h3>

                        <Sparkles className="w-5 h-5 text-amber-500" />
                      </div>

                      <div className="space-y-4">
                        {Array.isArray(analytics?.insights) &&
                        analytics.insights.length > 0 ? (
                          analytics.insights.map(
                            (insight: any, index: number) => (
                              <div
                                key={index}
                                className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100"
                              >
                                <p className="text-sm text-slate-700">
                                  {insight?.message ||
                                    'No insight message'}
                                </p>
                              </div>
                            )
                          )
                        ) : (
                          <div className="text-slate-400 text-sm">
                            No insights available
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ASSESSMENTS */}
            {activeTab === 'assessments' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">
                      Assessments
                    </h2>

                    <p className="text-slate-500 mt-1">
                      Assessment management center
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Assessment</th>
                        <th>Subject</th>
                        <th>Class</th>
                        <th>Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {loading ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-center py-10 text-slate-400"
                          >
                            Loading assessments...
                          </td>
                        </tr>
                      ) : filteredAssessments.length > 0 ? (
                        filteredAssessments.map(
                          (assessment: any) => (
                            <tr key={assessment?.id}>
                              <td>
                                {assessment?.name || '-'}
                              </td>

                              <td>
                                {assessment?.subject_name ||
                                  '-'}
                              </td>

                              <td>
                                {assessment?.class_name || '-'}
                              </td>

                              <td>
                                {assessment?.date || '-'}
                              </td>

                              <td>
                                <span
                                  className={`status-badge ${
                                    assessment?.status ===
                                    'published'
                                      ? 'status-published'
                                      : assessment?.status ===
                                        'pending'
                                      ? 'status-pending'
                                      : 'status-draft'
                                  }`}
                                >
                                  {assessment?.status ||
                                    'draft'}
                                </span>
                              </td>
                            </tr>
                          )
                        )
                      ) : (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-center py-10 text-slate-400"
                          >
                            No assessments found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RANKINGS */}
            {activeTab === 'rankings' && (
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                  Rankings
                </h2>

                <p className="text-slate-500 mb-6">
                  Live student rankings
                </p>

                <div className="space-y-4">
                  {loading ? (
                    <div className="empty-state">
                      Loading rankings...
                    </div>
                  ) : rankings.length > 0 ? (
                    rankings.map(
                      (student: any, index: number) => (
                        <div
                          key={student?.student_id || index}
                          className="premium-card p-5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                #{index + 1}
                              </div>

                              <div>
                                <h3 className="font-semibold text-slate-800">
                                  {student?.student_name ||
                                    '-'}
                                </h3>

                                <p className="text-sm text-slate-500">
                                  {student?.class_name ||
                                    '-'}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <h3 className="font-bold text-2xl text-slate-800">
                                {student?.score || 0}%
                              </h3>
                            </div>
                          </div>
                        </div>
                      )
                    )
                  ) : (
                    <div className="empty-state">
                      No rankings available
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* OTHER TABS */}
            {!['overview', 'assessments', 'rankings'].includes(
              activeTab
            ) && (
              <div className="empty-state">
                <div className="flex justify-center mb-5">
                  {currentTab?.icon && (
                    <div className="w-20 h-20 rounded-3xl bg-indigo-100 flex items-center justify-center">
                      <currentTab.icon className="w-10 h-10 text-indigo-600" />
                    </div>
                  )}
                </div>

                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                  {currentTab?.label}
                </h2>

                <p className="text-slate-500">
                  Ready for live integration with your
                  academic infrastructure.
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="premium-card p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-slate-800">
                Upcoming Assessments
              </h3>

              <CalendarDays className="w-5 h-5 text-indigo-500" />
            </div>

            {loading ? (
              <div className="text-slate-400">
                Loading upcoming assessments...
              </div>
            ) : (
              <div className="space-y-4">
                {assessments.slice(0, 3).map((item: any) => (
                  <div
                    key={item?.id}
                    className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-white"
                  >
                    <div>
                      <p className="font-medium text-sm text-slate-800">
                        {item?.name || '-'}
                      </p>

                      <p className="text-xs text-slate-500 mt-1">
                        {item?.date || 'No date'}
                      </p>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentHub;