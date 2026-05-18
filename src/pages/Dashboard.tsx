/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import { useAuth } from '../useAuth';

// DASHBOARDS
import SchoolDashboard from '../components/SchoolDashboard';

// OPTIONAL
// import TeacherDashboard from '../components/TeacherDashboard';
// import SuperAdminDashboard from '../components/SuperAdminDashboard';

const Dashboard = () => {
  const { user, sessionReady } = useAuth();

  /**
   * SESSION LOADING
   */
  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />

          <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
            Loading dashboard...
          </h2>

          <p className="text-sm text-slate-500 mt-1">
            Restoring your session and permissions
          </p>
        </div>
      </div>
    );
  }

  /**
   * NO AUTH USER
   */
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 max-w-md text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">
            Authentication Error
          </h2>

          <p className="text-slate-600 dark:text-slate-400">
            No authenticated user found.
          </p>
        </div>
      </div>
    );
  }

  /**
   * ROLE-BASED DASHBOARD ARCHITECTURE
   */

  // =========================
  // SUPER ADMIN
  // =========================
  if (
    user.role === 'Super Admin' ||
    user.role === 'super_admin' ||
    user.role === 'SuperAdmin'
  ) {
    // If you later create:
    // return <SuperAdminDashboard />;

    return <SchoolDashboard />;
  }

  // =========================
  // TEACHER
  // =========================
  if (
    user.role === 'Teacher' ||
    user.role === 'teacher'
  ) {
    // If you later create:
    // return <TeacherDashboard />;

    return <SchoolDashboard />;
  }

  // =========================
  // SCHOOL ADMIN / PRINCIPAL
  // =========================
  return <SchoolDashboard />;
};

export default Dashboard;