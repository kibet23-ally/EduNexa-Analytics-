import React from 'react';
import { useAuth } from '../useAuth';
import SchoolDashboard from '../components/dashboards/SchoolDashboard';
import TeacherDashboard from '../components/dashboards/TeacherDashboard';
import StudentDashboard from '../components/dashboards/StudentDashboard';

/**
 * 🧠 CENTRAL DASHBOARD ROUTER (PRODUCTION SAAS FIX)
 *
 * This file ONLY decides which dashboard to show.
 * It MUST NOT fetch data.
 * It MUST NOT contain business logic.
 */
const Dashboard = () => {
  const { user, sessionReady } = useAuth();

  /**
   * 🔴 WAIT FOR AUTH SESSION FIRST
   * Prevents RLS returning empty data due to missing JWT
   */
  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading session...
      </div>
    );
  }

  /**
   * 🔴 SAFETY CHECK: no school = no dashboard
   */
  if (!user?.school_id) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">
        No school assigned to this account.
      </div>
    );
  }

  /**
   * 🧠 RBAC DASHBOARD ROUTING
   * Single source of truth for role-based UI
   */
  const role = (user?.role || '').toLowerCase();

  switch (role) {
    // =========================
    // SCHOOL ADMIN DASHBOARD
    // =========================
    case 'admin':
    case 'principal':
    case 'school_admin':
      return <SchoolDashboard />;

    // =========================
    // TEACHER DASHBOARD
    // =========================
    case 'teacher':
      return <TeacherDashboard />;

    // =========================
    // STUDENT DASHBOARD
    // =========================
    case 'student':
      return <StudentDashboard />;

    // =========================
    // UNKNOWN ROLE SAFETY NET
    // =========================
    default:
      return (
        <div className="min-h-screen flex items-center justify-center text-gray-600">
          Unauthorized role: {user?.role}
        </div>
      );
  }
};

export default Dashboard;