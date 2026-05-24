import React, { useMemo, useState } from 'react';
import {
  BarChart3,
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
  Bell,
} from 'lucide-react';

import { motion } from 'framer-motion';
import { useData } from '@/hooks/useData';

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

  /**
   * Replace these with your actual useData returns
   * based on your existing architecture.
   */
  const {
    assessments = [],
    students = [],
    subjects = [],
    analytics = {},
    rankings = [],
    loading,
  } = useData();

  /**
   * Dynamic KPI Calculations
   */
  const kpis = useMemo(() => {
    const publishedAssessments = assessments.filter(
      (item: any) => item.status === 'published'
    );

    const totalMean =
      assessments.reduce(
        (acc: number, item: any) => acc + (item.mean_score || 0),
        0
      ) || 0;

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
   * Filtered assessments
   */
  const filteredAssessments = useMemo(() => {
    return assessments.filter((assessment: any) =>
      assessment.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [assessments, search]);

  const currentTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTab),
    [activeTab]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/20 blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-500/20 blur-3xl rounded-full" />
      </div>

      <div className="relative z-10 p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-2xl bg-indigo-500/20 border border-indigo-500/30">
                <BookOpen className="w-6 h-6 text-indigo-300" />
              </div>

              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Assessment Hub
                </h1>

                <p className="text-slate-400 text-sm">
                  Centralized assessment intelligence platform
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition">
              <Bell className="w-4 h-4" />
              Notifications
            </button>

            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition">
              <Download className="w-4 h-4" />
              Export
            </button>

            <button className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition shadow-lg shadow-indigo-500/30">
              <Plus className="w-4 h-4" />
              Create Assessment
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />

            <input
              type="text"
              placeholder="Search assessments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select className="px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800">
            <option>Academic Year</option>
          </select>

          <select className="px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800">
            <option>Term</option>
          </select>

          <button className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800">
            <Filter className="w-4 h-4" />
            More Filters
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
          {kpis.map((item, index) => {
            const Icon = item.icon;

            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="rounded-3xl border border-slate-800 bg-slate-900/70 backdrop-blur-xl p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">
                      {item.title}
                    </p>

                    <h2 className="text-3xl font-bold mt-2">
                      {loading ? '...' : item.value}
                    </h2>
                  </div>

                  <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                    <Icon className="w-6 h-6 text-indigo-300" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-3 overflow-x-auto mb-8 scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl whitespace-nowrap transition-all ${
                  active
                    ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30'
                    : 'bg-slate-900 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Main */}
          <div className="xl:col-span-3">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-slate-800 bg-slate-900/70 backdrop-blur-xl p-6"
            >
              {/* OVERVIEW */}
              {activeTab === 'overview' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold">
                        Academic Overview
                      </h2>

                      <p className="text-slate-400 mt-1">
                        Live assessment analytics and insights
                      </p>
                    </div>
                  </div>

                  {loading ? (
                    <div className="py-20 text-center text-slate-400">
                      Loading analytics...
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5 min-h-[300px]">
                        <div className="flex items-center justify-between mb-5">
                          <h3 className="font-semibold">
                            Performance Analytics
                          </h3>

                          <BarChart3 className="w-5 h-5 text-indigo-300" />
                        </div>

                        {/* Insert your charts here */}
                        <div className="flex items-center justify-center h-56 text-slate-500">
                          Integrate Recharts analytics here
                        </div>
                      </div>

                      <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5">
                        <div className="flex items-center justify-between mb-5">
                          <h3 className="font-semibold">
                            AI Insights
                          </h3>

                          <Sparkles className="w-5 h-5 text-yellow-300" />
                        </div>

                        <div className="space-y-4">
                          {analytics?.insights?.length ? (
                            analytics.insights.map(
                              (insight: any, index: number) => (
                                <div
                                  key={index}
                                  className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20"
                                >
                                  <p className="text-sm text-slate-300">
                                    {insight.message}
                                  </p>
                                </div>
                              )
                            )
                          ) : (
                            <div className="text-slate-500 text-sm">
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
                      <h2 className="text-2xl font-bold">
                        Assessments
                      </h2>

                      <p className="text-slate-400 mt-1">
                        Manage and monitor all assessments
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-sm">
                          <th className="text-left py-4">Assessment</th>
                          <th className="text-left py-4">Subject</th>
                          <th className="text-left py-4">Class</th>
                          <th className="text-left py-4">Date</th>
                          <th className="text-left py-4">Status</th>
                        </tr>
                      </thead>

                      <tbody>
                        {loading ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="py-10 text-center text-slate-500"
                            >
                              Loading assessments...
                            </td>
                          </tr>
                        ) : filteredAssessments.length > 0 ? (
                          filteredAssessments.map(
                            (assessment: any) => (
                              <tr
                                key={assessment.id}
                                className="border-b border-slate-900 hover:bg-slate-800/30 transition"
                              >
                                <td className="py-5 font-medium">
                                  {assessment.name}
                                </td>

                                <td className="py-5 text-slate-300">
                                  {assessment.subject_name || '-'}
                                </td>

                                <td className="py-5 text-slate-300">
                                  {assessment.class_name || '-'}
                                </td>

                                <td className="py-5 text-slate-300">
                                  {assessment.date || '-'}
                                </td>

                                <td className="py-5">
                                  <span className="px-3 py-1 rounded-full text-xs bg-slate-800">
                                    {assessment.status || 'draft'}
                                  </span>
                                </td>
                              </tr>
                            )
                          )
                        ) : (
                          <tr>
                            <td
                              colSpan={5}
                              className="py-10 text-center text-slate-500"
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
                  <h2 className="text-2xl font-bold mb-2">
                    Rankings
                  </h2>

                  <p className="text-slate-400 mb-6">
                    Live student performance rankings
                  </p>

                  <div className="space-y-4">
                    {loading ? (
                      <div className="text-slate-500">
                        Loading rankings...
                      </div>
                    ) : rankings.length > 0 ? (
                      rankings.map(
                        (student: any, index: number) => (
                          <div
                            key={student.student_id}
                            className="flex items-center justify-between p-5 rounded-2xl border border-slate-800 bg-slate-950/40"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center font-bold">
                                #{index + 1}
                              </div>

                              <div>
                                <h3 className="font-semibold">
                                  {student.student_name}
                                </h3>

                                <p className="text-sm text-slate-400">
                                  {student.class_name}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <h3 className="font-bold text-xl">
                                {student.score || 0}%
                              </h3>
                            </div>
                          </div>
                        )
                      )
                    ) : (
                      <div className="text-slate-500">
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
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="p-5 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 mb-5">
                    {currentTab?.icon && (
                      <currentTab.icon className="w-10 h-10 text-indigo-300" />
                    )}
                  </div>

                  <h2 className="text-2xl font-bold mb-2">
                    {currentTab?.label}
                  </h2>

                  <p className="text-slate-400 max-w-md">
                    This module is ready for integration with
                    your live academic data infrastructure.
                  </p>
                </div>
              )}
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 backdrop-blur-xl p-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold">
                  Upcoming Assessments
                </h3>

                <CalendarDays className="w-5 h-5 text-indigo-300" />
              </div>

              {loading ? (
                <div className="text-slate-500">
                  Loading upcoming assessments...
                </div>
              ) : (
                <div className="space-y-4">
                  {assessments.slice(0, 3).map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/50 border border-slate-800"
                    >
                      <div>
                        <p className="font-medium text-sm">
                          {item.name}
                        </p>

                        <p className="text-xs text-slate-400 mt-1">
                          {item.date || 'No date'}
                        </p>
                      </div>

                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentHub;