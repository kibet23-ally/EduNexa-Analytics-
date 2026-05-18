'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, UserCheck, DollarSign, Award, 
  Calendar, Plus, Bell, TrendingUp, 
  Clock, BookOpen 
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
    <div className="min-h-screen bg-[#0a1428] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a1428]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">Marumbasi Comprehensive School</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="text-sm">Welcome back, Annette</p>
              <p className="text-xs text-gray-500">{currentDate}</p>
            </div>

            <button className="p-3 hover:bg-white/10 rounded-2xl transition-colors relative">
              <Bell className="w-5 h-5" />
              <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            </button>

            <button className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 px-6 py-3 rounded-2xl font-medium transition-all active:scale-95">
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
            { icon: Users, label: "Total Students", value: stats.students.toLocaleString(), color: "cyan" },
            { icon: UserCheck, label: "Avg Attendance", value: `${stats.attendance}%`, color: "emerald" },
            { icon: DollarSign, label: "Fees Collected", value: `₦${(stats.feesCollected / 1000000).toFixed(1)}M`, color: "amber" },
            { icon: Award, label: "Avg Score", value: stats.avgScore, color: "violet" },
          ].map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/5 border border-white/10 rounded-3xl p-6 hover:border-cyan-500/30 transition-all group"
            >
              <div className="flex justify-between items-start">
                <div className={`p-4 bg-${item.color}-500/10 rounded-2xl`}>
                  <item.icon className={`w-8 h-8 text-${item.color}-400`} />
                </div>
                <span className="text-emerald-400 text-xs font-medium">↑ 4%</span>
              </div>
              <div className="mt-8">
                <div className="text-4xl font-bold font-mono tracking-tighter">{item.value}</div>
                <div className="text-gray-400 mt-1">{item.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Attendance & Charts Section */}
          <div className="lg:col-span-7 bg-white/5 border border-white/10 rounded-3xl p-8">
            <div className="flex justify-between mb-6">
              <h2 className="text-xl font-semibold">Attendance Analytics</h2>
              <span className="text-cyan-400 text-sm">Today • {currentDate}</span>
            </div>
            <div className="h-80 flex items-center justify-center border border-dashed border-white/20 rounded-2xl">
              <div className="text-center text-gray-400">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Interactive Charts (Donut + Bar) Coming Soon</p>
                <p className="text-xs mt-2">Recharts integration ready</p>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-5 bg-white/5 border border-white/10 rounded-3xl p-8">
            <h2 className="text-xl font-semibold mb-6">Recent Activity</h2>
            <div className="space-y-6">
              {recentActivities.map((activity, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-4"
                >
                  <div className="w-2 h-2 mt-2 bg-cyan-400 rounded-full" />
                  <div>
                    <p className="text-sm">{activity.action}</p>
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