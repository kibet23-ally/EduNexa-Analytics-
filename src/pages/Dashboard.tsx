'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, UserCheck, DollarSign, Award, 
  Calendar, Plus, Bell, Clock 
} from 'lucide-react';
import { motion } from 'framer-motion';

const Dashboard = () => {
  const [stats, setStats] = useState({
    students: 0,
    attendance: 0,
    feesCollected: 0,
    avgScore: 0,
  });

  const currentDate = new Date().toLocaleDateString('en-GB', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  // Number Animation
  useEffect(() => {
    const animateValue = (start: number, end: number, setter: (value: number) => void, duration = 1800) => {
      let startTimestamp: number | null = null;
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        setter(value);
        if (progress < 1) window.requestAnimationFrame(step);
      };
      window.requestAnimationFrame(step);
    };

    setTimeout(() => {
      animateValue(0, 1248, (v) => setStats(prev => ({...prev, students: v})));
      animateValue(0, 94, (v) => setStats(prev => ({...prev, attendance: v})));
      animateValue(0, 8740000, (v) => setStats(prev => ({...prev, feesCollected: v})));
      animateValue(0, 83, (v) => setStats(prev => ({...prev, avgScore: v})));
    }, 400);
  }, []);

  const recentActivities = [
    { time: "Just now", action: "Attendance marked for Form 4A", user: "Mr. Kimani" },
    { time: "12 min ago", action: "New student registered - Jane Muthoni", user: "Annette Koskei" },
    { time: "47 min ago", action: "Mid-term exam results uploaded", user: "Academic Office" },
    { time: "2 hrs ago", action: "Fee payment received - ₦125,000", user: "Finance" },
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
              <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            </button>

            <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-medium transition-all active:scale-95">
              <Plus className="w-4 h-4" />
              Quick Action
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
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
                <span className="text-emerald-600 text-xs font-medium">↑ 4%</span>
              </div>
              <div className="mt-8">
                <div className="text-4xl font-bold font-mono tracking-tighter text-gray-900">{item.value}</div>
                <div className="text-gray-600 mt-1">{item.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Attendance Analytics */}
          <div className="lg:col-span-7 bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
            <div className="flex justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Attendance Analytics</h2>
              <span className="text-blue-600 text-sm">Today • {currentDate}</span>
            </div>
            <div className="h-80 flex items-center justify-center border border-dashed border-gray-300 rounded-2xl bg-gray-50">
              <div className="text-center text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-60" />
                <p>Interactive Charts (Donut + Weekly Bar) Coming Soon</p>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-5 bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
            <h2 className="text-xl font-semibold mb-6 text-gray-900">Recent Activity</h2>
            <div className="space-y-6">
              {recentActivities.map((activity, i) => (
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