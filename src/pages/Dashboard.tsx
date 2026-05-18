import React, { useState, useEffect } from 'react';
import { Users, DollarSign, Award, TrendingUp, Clock, UserCheck } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState({
    students: 0,
    attendance: 0,
    feesCollected: 0,
    avgScore: 0,
  });

  // Animate numbers
  useEffect(() => {
    const animateValue = (start: number, end: number, setter: (value: number) => void, duration = 1500) => {
      let startTimestamp: number | null = null;
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        setter(value);
        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      };
      window.requestAnimationFrame(step);
    };

    // Trigger animations
    setTimeout(() => {
      animateValue(0, 1248, (v) => setStats(prev => ({...prev, students: v})));
      animateValue(0, 94, (v) => setStats(prev => ({...prev, attendance: v})));
      animateValue(0, 8740000, (v) => setStats(prev => ({...prev, feesCollected: v})));
      animateValue(0, 83, (v) => setStats(prev => ({...prev, avgScore: v})));
    }, 300);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a1428] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Dashboard</h1>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-cyan-500/10 rounded-2xl">
                <Users className="w-8 h-8 text-cyan-400" />
              </div>
              <div>
                <div className="text-4xl font-mono font-bold">{stats.students.toLocaleString()}</div>
                <div className="text-gray-400">Total Students</div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-emerald-500/10 rounded-2xl">
                <UserCheck className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <div className="text-4xl font-mono font-bold">{stats.attendance}%</div>
                <div className="text-gray-400">Avg Attendance</div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-amber-500/10 rounded-2xl">
                <DollarSign className="w-8 h-8 text-amber-400" />
              </div>
              <div>
                <div className="text-4xl font-mono font-bold">₦{(stats.feesCollected / 1000000).toFixed(1)}M</div>
                <div className="text-gray-400">Fees Collected</div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-violet-500/10 rounded-2xl">
                <Award className="w-8 h-8 text-violet-400" />
              </div>
              <div>
                <div className="text-4xl font-mono font-bold">{stats.avgScore}</div>
                <div className="text-gray-400">Avg Score</div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center text-gray-400 py-12">
          More dashboard sections coming soon...
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
