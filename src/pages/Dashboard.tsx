'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, UserCheck, DollarSign, Award, 
  Plus, Bell, Clock 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useData } from '../hooks/useData';   // ← Fixed import path

const Dashboard = () => {
  // Fetch real data - change table name if needed
  const { data: schoolStats, loading, error } = useData('school_stats'); 

  const currentDate = new Date().toLocaleDateString('en-GB', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  const stats = {
    students: schoolStats?.total_students || schoolStats?.students || 1248,
    attendance: schoolStats?.avg_attendance || schoolStats?.attendance || 94,
    feesCollected: schoolStats?.fees_collected || schoolStats?.total_fees || 8740000,
    avgScore: schoolStats?.avg_score || schoolStats?.average_score || 83,
  };

  const recentActivities = schoolStats?.recent_activities || [
    { time: "Just now", action: "System is loading live data...", user: "EduNexa" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
            <p className="text-gray-600 text-sm mt-1">Marumbasi Comprehensive School</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium">Welcome back, Annette</p>
              <p className="text-xs text-gray-500">{currentDate}</p>
            </div>

            <button className="p-3 hover:bg-gray-100 rounded-2xl transition-colors relative">
              <Bell className="w-5 h-5 text-gray-600" />
            </button>

            <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-medium transition-all active:scale-95">
              <Plus className="w-4 h-4" />
              Quick Action
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading && (
          <div className="flex justify-center py-20">
            <p className="text-gray-500">Loading live school data...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl mb-6">
            Error loading data. Showing fallback values.
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {[
            { icon: Users, label: "Total Students", value: stats.students.toLocaleString(), color: "blue" },
            { icon: UserCheck, label: "Avg Attendance", value: `${stats.attendance}%`, color: "emerald" },
            { icon: DollarSign, label: "Fees Collected", value: `₦${(stats.feesCollected / 1000000).toFixed(1)}M`, color: "amber" },
            { icon: Award, label: "Avg Score", value: stats.avgScore, color: "violet" },
          ].map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white border border-gray-200 rounded-3xl p-6 hover:shadow-lg hover:border-gray-300 transition-all"
            >
              <div className="flex justify-between items-start">
                <div className={`p-4 bg-${item.color}-100 rounded-2xl`}>
                  <item.icon className={`w-8 h-8 text-${item.color}-600`} />
                </div>
                <span className="text-emerald-600 text-xs font-medium">Live</span>
              </div>
              <div className="mt-8">
                <div className="text-4xl font-bold font-mono tracking-tighter text-gray-900">
                  {item.value}
                </div>
                <div className="text-gray-600 mt-1">{item.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Attendance Section */}
          <div className="lg:col-span-7 bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
            <div className="flex justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Attendance Analytics</h2>
              <span className="text-blue-600 text-sm">Today • {currentDate}</span>
            </div>
            <div className="h-80 flex items-center justify-center border border-dashed border-gray-300 rounded-2xl bg-gray-50">
              <div className="text-center text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-60" />
                <p>Advanced analytics charts coming soon</p>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-5 bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
            <h2 className="text-xl font-semibold mb-6 text-gray-900">Recent Activity</h2>
            <div className="space-y-6">
              {recentActivities.map((activity: any, i: number) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-4"
                >
                  <div className="w-2 h-2 mt-2 bg-blue-600 rounded-full" />
                  <div>
                    <p className="text-sm text-gray-800">{activity.action}</p>
                    <p className="text-xs text-gray-500">{activity.user} • {activity.time}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;