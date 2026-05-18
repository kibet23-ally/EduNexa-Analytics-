import React from 'react'; import { Users, GraduationCap, BookOpen, ClipboardList, UserCheck, TrendingUp, Calendar, Bell, Activity, ShieldCheck, } from 'lucide-react'; import { motion } from 'framer-motion'; import { useAuth } from '../useAuth'; import { useData } from '../hooks/useData'; import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, } from 'recharts';

const SchoolDashboard = () => { const { user, sessionReady } = useAuth();

const enabled = sessionReady && !!user?.school_id;

// ============================= // COUNTS // =============================

const studentsQuery = useData<number>( 'dashboard-students', 'students', { countOnly: true, filters: { school_id: user?.school_id, }, }, enabled );

const teachersQuery = useData<number>( 'dashboard-teachers', 'teachers', { countOnly: true, filters: { school_id: user?.school_id, }, }, enabled );

const gradesQuery = useData<number>( 'dashboard-grades', 'grades', { countOnly: true, filters: { school_id: user?.school_id, }, }, enabled );

const subjectsQuery = useData<number>( 'dashboard-subjects', 'subjects', { countOnly: true, filters: { school_id: user?.school_id, }, }, enabled );

const examsQuery = useData<number>( 'dashboard-exams', 'exams', { countOnly: true, filters: { school_id: user?.school_id, }, }, enabled );

// ============================= // ATTENDANCE // =============================

const today = new Date().toISOString().slice(0, 10);

const attendanceQuery = useData<any>( 'dashboard-attendance', 'attendance', { select: 'student_id, status, date', filters: { school_id: user?.school_id, date: today, }, }, enabled );

// ============================= // LOADING // =============================

if (!sessionReady) { return ( <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"> <div className="text-center"> <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" /> <h2 className="text-xl font-bold text-slate-700 dark:text-white"> Loading Dashboard... </h2> </div> </div> ); }

// ============================= // ATTENDANCE SUMMARY // =============================

const attendanceData = attendanceQuery.data || [];

const present = attendanceData.filter( (a: any) => a.status?.toLowerCase() === 'present' ).length;

const absent = attendanceData.filter( (a: any) => a.status?.toLowerCase() === 'absent' ).length;

const late = attendanceData.filter( (a: any) => a.status?.toLowerCase() === 'late' ).length;

const attendanceChart = [ { name: 'Present', value: present }, { name: 'Absent', value: absent }, { name: 'Late', value: late }, ];

const COLORS = ['#10B981', '#EF4444', '#F59E0B'];

// ============================= // PERFORMANCE MOCK // =============================

const performanceData = [ { grade: 'Grade 7', score: 76 }, { grade: 'Grade 8', score: 81 }, { grade: 'Grade 9', score: 74 }, { grade: 'Grade 10', score: 88 }, { grade: 'Grade 11', score: 79 }, { grade: 'Grade 12', score: 91 }, ];

const stats = [ { title: 'Students', value: studentsQuery.data || 0, icon: Users, color: 'bg-blue-600', }, { title: 'Teachers', value: teachersQuery.data || 0, icon: UserCheck, color: 'bg-emerald-600', }, { title: 'Subjects', value: subjectsQuery.data || 0, icon: BookOpen, color: 'bg-violet-600', }, { title: 'Exams', value: examsQuery.data || 0, icon: ClipboardList, color: 'bg-amber-600', }, ];

return ( <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 lg:p-8"> {/* Header */} <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8"> <div> <h1 className="text-3xl font-bold text-slate-900 dark:text-white"> Dashboard Overview </h1>

<p className="text-slate-500 mt-2">
        Welcome back {user?.name || 'Admin'}
      </p>
    </div>

    <div className="flex items-center gap-3">
      <button className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-sm">
        <Bell size={20} />
      </button>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3 shadow-sm">
        <p className="text-xs text-slate-500">Today</p>
        <p className="font-semibold text-slate-900 dark:text-white">
          {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  </div>

  {/* Stats */}
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
    {stats.map((item, index) => (
      <motion.div
        key={item.title}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">{item.title}</p>
            <h2 className="text-4xl font-bold mt-2 text-slate-900 dark:text-white">
              {item.value}
            </h2>
          </div>

          <div className={`${item.color} w-16 h-16 rounded-2xl flex items-center justify-center text-white`}>
            <item.icon size={28} />
          </div>
        </div>
      </motion.div>
    ))}
  </div>

  {/* Main Grid */}
  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
    {/* Performance */}
    <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Academic Performance
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Average score by grade
          </p>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
          <TrendingUp />
        </div>
      </div>

      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="grade" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="score" radius={[8, 8, 0, 0]} fill="#2563EB" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    {/* Attendance */}
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Attendance
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Today's attendance summary
          </p>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
          <Activity />
        </div>
      </div>

      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={attendanceChart}
              dataKey="value"
              outerRadius={90}
              innerRadius={50}
              paddingAngle={5}
            >
              {attendanceChart.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-3 mt-4">
        {attendanceChart.map((item, index) => (
          <div
            key={item.name}
            className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-2xl px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[index] }}
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {item.name}
              </span>
            </div>

            <span className="font-bold text-slate-900 dark:text-white">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>

  {/* Bottom Grid */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {/* Quick Actions */}
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
        Quick Actions
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {[
          {
            title: 'Add Student',
            icon: Users,
          },
          {
            title: 'Create Exam',
            icon: ClipboardList,
          },
          {
            title: 'Manage Grades',
            icon: GraduationCap,
          },
          {
            title: 'School Settings',
            icon: ShieldCheck,
          },
        ].map((action) => (
          <button
            key={action.title}
            className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 text-left"
          >
            <action.icon className="mb-3 text-blue-600" size={24} />
            <p className="font-semibold text-slate-900 dark:text-white">
              {action.title}
            </p>
          </button>
        ))}
      </div>
    </div>

    {/* System Overview */}
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
        School Overview
      </h3>

      <div className="space-y-5">
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <Calendar className="text-blue-600" />
            <span className="font-medium">Academic Year</span>
          </div>

          <span className="font-bold">2026</span>
        </div>

        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <GraduationCap className="text-emerald-600" />
            <span className="font-medium">Total Grades</span>
          </div>

          <span className="font-bold">
            {gradesQuery.data || 0}
          </span>
        </div>

        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <BookOpen className="text-violet-600" />
            <span className="font-medium">Subjects Offered</span>
          </div>

          <span className="font-bold">
            {subjectsQuery.data || 0}
          </span>
        </div>
      </div>
    </div>
  </div>
</div>

); };

export default SchoolDashboard;