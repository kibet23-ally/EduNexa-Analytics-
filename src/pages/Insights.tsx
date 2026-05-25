// src/pages/Insights.tsx
import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Download, Printer, TrendingUp 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { PDFDownloadLink } from '@react-pdf/renderer';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useAuth } from '../useAuth';
import { fetchWithProxy } from '../lib/fetchProxy';

import ReportCardPDF from '../components/ReportCardPDF';

const COLORS = ['#1E40AF', '#3B82F6', '#60A5FA', '#93C5FD'];

const Insights = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'analytics' | 'reports' | 'class'>('analytics');
  const [selectedTerm, setSelectedTerm] = useState('Term 2 2026');
  const [school, setSchool] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>({
    subjects: [],
    gradeDist: [],
    trends: [],
    topStudents: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch School + Analytics Data
  const fetchInsightsData = React.useCallback(async () => {
    if (!user?.school_id) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch school branding
      const schoolResult = await fetchWithProxy('schools');
      const schoolInfo = schoolResult.data?.find((s: any) => s.id === Number(user.school_id));
      setSchool(schoolInfo);

      // Fetch exam results / analytics (filtered by school_id via proxy)
      const resultsRes = await fetchWithProxy('exam_results');
      const results = resultsRes.data || [];

      // Process data (you can expand this with real aggregations)
      const processedSubjects = [
        { name: 'Math', mean: 82, students: 45 },
        { name: 'English', mean: 78, students: 45 },
        { name: 'Science', mean: 85, students: 45 },
      ].filter(() => true); // Replace with real aggregation from `results`

      const processedGrades = [
        { name: 'A', value: 28, fill: '#22C55E' },
        { name: 'B', value: 42, fill: '#3B82F6' },
        { name: 'C', value: 18, fill: '#EAB308' },
      ];

      setAnalyticsData({
        subjects: processedSubjects,
        gradeDist: processedGrades,
        trends: [
          { month: 'Jan', score: 72 },
          { month: 'Feb', score: 75 },
          { month: 'Mar', score: 79 },
          { month: 'Apr', score: 81 },
        ],
        topStudents: results.slice(0, 5) // Example
      });

    } catch (err: any) {
      setError(err.message || 'Failed to load insights data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInsightsData();
  }, [fetchInsightsData, selectedTerm]);

  if (loading) {
    return <div className="flex items-center justify-center h-96 text-slate-400">Loading Premium Insights...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-8 py-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Insights Center</h1>
              <p className="text-slate-400">Enterprise Analytics &amp; Reporting</p>
            </div>
          </div>

          <Select value={selectedTerm} onValueChange={setSelectedTerm}>
            <SelectTrigger className="w-56 bg-slate-800 border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Term 1 2026">Term 1 2026</SelectItem>
              <SelectItem value="Term 2 2026">Term 2 2026</SelectItem>
              <SelectItem value="Term 3 2025">Term 3 2025</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 pt-10">
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <TabsList className="mb-10 bg-slate-900 border border-slate-700">
            <TabsTrigger value="analytics">Exam Analytics</TabsTrigger>
            <TabsTrigger value="reports">Report Cards</TabsTrigger>
            <TabsTrigger value="class">Class Analysis</TabsTrigger>
          </TabsList>

          {/* EXAM ANALYTICS */}
          <TabsContent value="analytics" className="space-y-10">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { title: "School Mean", value: "81.7", trend: "+4.3" },
                { title: "Pass Rate", value: "94%", trend: "+2%" },
                { title: "Top Student", value: "Amani Okoth", trend: "94.8" },
                { title: "Classes", value: "18", trend: "" },
              ].map((stat, i) => (
                <Card key={i} className="bg-slate-900 border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-slate-400">{stat.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold">{stat.value}</div>
                    {stat.trend && <p className="text-emerald-500 text-sm mt-1">↑ {stat.trend}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="lg:col-span-8 bg-slate-900 border-slate-700">
                <CardHeader><CardTitle>Subject Mean Scores</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={380}>
                    <BarChart data={analyticsData.subjects}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" stroke="#94A3B8" />
                      <YAxis stroke="#94A3B8" />
                      <Tooltip />
                      <Bar dataKey="mean" fill="#3B82F6" radius={8} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="lg:col-span-4 bg-slate-900 border-slate-700">
                <CardHeader><CardTitle>Grade Distribution</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={380}>
                    <PieChart>
                      <Pie data={analyticsData.gradeDist} cx="50%" cy="50%" innerRadius={70} outerRadius={130} dataKey="value">
                        {analyticsData.gradeDist.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-900 border-slate-700">
              <CardHeader><CardTitle>Performance Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsData.trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" stroke="#94A3B8" />
                    <YAxis stroke="#94A3B8" />
                    <Tooltip />
                    <Line type="natural" dataKey="score" stroke="#60A5FA" strokeWidth={4} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REPORT CARDS */}
          <TabsContent value="reports">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-10">
              <div className="flex justify-between mb-10">
                <div className="flex items-center gap-6">
                  {school?.logo_url && <img src={school.logo_url} className="h-20 w-20 rounded-xl" alt="logo" />}
                  <div>
                    <h2 className="text-4xl font-bold" style={{ color: school?.primary_color || '#3B82F6' }}>
                      {school?.name || 'Your School'}
                    </h2>
                    <p className="text-slate-400">{school?.motto}</p>
                  </div>
                </div>
                <div className="text-right text-lg">{selectedTerm}</div>
              </div>

              <PDFDownloadLink
                document={
                  <ReportCardPDF 
                    school={school} 
                    term={selectedTerm} 
                    student={{
                      name: "Amani Okoth",
                      adm: "24103",
                      class: "4A",
                      mean: 92.8,
                      position: "2nd",
                      subjects: [
                        { name: "Mathematics", score: 94, grade: "A" },
                        { name: "English", score: 89, grade: "A-" },
                      ]
                    }} 
                  />
                }
                fileName={`Report_Card_Amani_Okoth.pdf`}
              >
                {({ loading }) => (
                  <Button size="lg" className="gap-3" disabled={loading}>
                    <Download className="w-5 h-5" />
                    {loading ? "Generating PDF..." : "Download Report Card PDF"}
                  </Button>
                )}
              </PDFDownloadLink>
            </div>
          </TabsContent>

          {/* CLASS ANALYSIS - Ready for expansion */}
          <TabsContent value="class">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle>Class & Stream Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">Expand with stream comparison charts here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Insights;