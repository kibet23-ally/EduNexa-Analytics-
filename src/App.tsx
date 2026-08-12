import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';
import { Skeleton } from './components/ui/Skeleton';
import Sidebar from './components/Sidebar';
import GlobalHeader from './components/GlobalHeader';
import SubscriptionBanner from './components/SubscriptionBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import OfflineScreen from './components/OfflineScreen';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import { Toaster } from 'react-hot-toast';

// Lazy load all pages
const Landing            = lazy(() => import('./pages/Landing'));
const Login              = lazy(() => import('./pages/Login'));
const Register           = lazy(() => import('./pages/Register'));
const AwaitingApproval   = lazy(() => import('./pages/AwaitingApproval'));
const Dashboard          = lazy(() => import('./pages/Dashboard'));
const Students           = lazy(() => import('./pages/Students'));
const LearnerOnboarding  = lazy(() => import('./pages/LearnerOnboarding'));
const Grades             = lazy(() => import('./pages/Grades'));
const Subjects           = lazy(() => import('./pages/Subjects'));
const Exams              = lazy(() => import('./pages/Exams'));
const MarksEntry         = lazy(() => import('./pages/MarksEntry'));
const Analytics          = lazy(() => import('./pages/Analytics'));
const Reports            = lazy(() => import('./pages/Reports'));
const Teachers           = lazy(() => import('./pages/Teachers'));
const Finance            = lazy(() => import('./pages/Finance'));
const OrderForm          = lazy(() => import('./pages/OrderForm'));
const Schools            = lazy(() => import('./pages/Schools'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));
const SuperAdminAnalytics = lazy(() => import('./pages/SuperAdminAnalytics'));
const GlobalUsers        = lazy(() => import('./pages/GlobalUsers'));
const Subscriptions      = lazy(() => import('./pages/Subscription'));
const SchoolSubscription = lazy(() => import('./pages/SchoolSubscription'));
const TeacherAssignments = lazy(() => import('./pages/TeacherAssignments'));
const SettingsPage       = lazy(() => import('./pages/Settings'));
const SystemStatus       = lazy(() => import('./pages/SystemStatus'));
const Attendance         = lazy(() => import('./pages/Attendance'));
const AttendanceReport   = lazy(() => import('./pages/AttendanceReport'));
const StudentPromotion   = lazy(() => import('./pages/StudentPromotion'));
const ResetPassword      = lazy(() => import('./pages/ResetPassword'));
const ForgotPassword     = lazy(() => import('./pages/ForgotPassword'));
const InsightsCenter     = lazy(() => import('./pages/InsightsCenter'));
const SchoolLevels = lazy(() => import('./pages/SchoolLevels'));

// Footer pages
const Features = lazy(() => import('./pages/Features'));
const Pricing  = lazy(() => import('./pages/Pricing'));
const About    = lazy(() => import('./pages/About'));
const Contact  = lazy(() => import('./pages/Contact'));
const Privacy  = lazy(() => import('./pages/Privacy'));
const Terms    = lazy(() => import('./pages/TermsAndConditions'));

/* ─── Page skeleton fallback ─────────────────────────────────────────────── */
const PageFallback = () => (
  <div className="space-y-6 animate-in fade-in duration-500">
    <Skeleton className="h-10 w-1/3 mb-4" />
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
    <Skeleton className="h-64 w-full rounded-xl" />
  </div>
);

/* ─── Full-screen auth loading ───────────────────────────────────────────── */
const AuthLoadingScreen = () => (
  <div className="h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 gap-4">
    <div className="flex items-center gap-2 mb-2">
      <div className="w-8 h-8 rounded-lg bg-[#1e3a5f] flex items-center justify-center">
        <span className="text-white font-black text-sm">E</span>
      </div>
      <span className="text-xl font-black text-[#1e3a5f] dark:text-white">EduNexa</span>
    </div>
    <div className="w-6 h-6 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
    <p className="text-xs text-slate-400">Restoring your session…</p>
  </div>
);

/* ─── Protected Route ────────────────────────────────────────────────────── */
// CRITICAL: Never redirect while authLoading is true.
// Only redirect when authLoading=false AND session=null.
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, authLoading } = useAuth();

  // Auth check not complete yet — show spinner, never redirect
  if (authLoading) return <AuthLoadingScreen />;

  // Auth complete and no session — redirect to login
  if (!isAuthenticated) {
    console.log('[Route] Not authenticated → /login');
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

/* ─── Role Protected Route ───────────────────────────────────────────────── */
const RoleProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles: string[];
}> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, authLoading } = useAuth();

  // Wait for auth to complete
  if (authLoading) return <AuthLoadingScreen />;

  // Not logged in
  if (!isAuthenticated || !user) {
    console.log('[Route] Not authenticated → /login');
    return <Navigate to="/login" replace />;
  }

  // Check role
  const normalize = (r: string) =>
    r.toLowerCase().replace(/_/g, '').replace('school', '');

  const normalizedUserRole    = normalize(user.role);
  const normalizedAllowedRoles = allowedRoles.map(normalize);

  if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
    console.log('[Route] Role mismatch:', user.role, '→ redirecting');
    // Redirect to correct dashboard based on role
    const r = user.role?.toLowerCase();
    if (r === 'teacher')      return <Navigate to="/teacher"      replace />;
    if (r === 'school_admin') return <Navigate to="/school-admin" replace />;
    if (r === 'super_admin')  return <Navigate to="/super-admin"  replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

/* ─── Wrap helper ────────────────────────────────────────────────────────── */
const wrap = (component: React.ReactNode, name?: string) => (
  <ErrorBoundary name={name}>
    <Suspense fallback={<PageFallback />}>
      {component}
    </Suspense>
  </ErrorBoundary>
);

/* ─── Layout ─────────────────────────────────────────────────────────────── */
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
    <Toaster position="top-right" />
    <Sidebar />
    <div className="flex-1 flex flex-col min-w-0">
      <SubscriptionBanner />
      <GlobalHeader />
      <main className="flex-1 p-6 overflow-auto bg-slate-50 dark:bg-slate-950">
        {children}
      </main>
    </div>
  </div>
);

/* ─── Routes ─────────────────────────────────────────────────────────────── */
const AppRoutes = () => {
  const { authLoading } = useAuth();

  // While restoring session, show spinner — never render routes
  if (authLoading) return <AuthLoadingScreen />;

  return (
    <Routes>
      {/* ── Public Routes ── */}
      <Route path="/"                element={<Suspense fallback={<AuthLoadingScreen />}><Landing /></Suspense>} />
      <Route path="/features"        element={<Suspense fallback={<AuthLoadingScreen />}><Features /></Suspense>} />
      <Route path="/pricing"         element={<Suspense fallback={<AuthLoadingScreen />}><Pricing /></Suspense>} />
      <Route path="/about"           element={<Suspense fallback={<AuthLoadingScreen />}><About /></Suspense>} />
      <Route path="/contact"         element={<Suspense fallback={<AuthLoadingScreen />}><Contact /></Suspense>} />
      <Route path="/privacy"         element={<Suspense fallback={<AuthLoadingScreen />}><Privacy /></Suspense>} />
      <Route path="/terms"           element={<Suspense fallback={<AuthLoadingScreen />}><Terms /></Suspense>} />
      <Route path="/login"           element={<Suspense fallback={<AuthLoadingScreen />}><Login /></Suspense>} />
      <Route path="/register"        element={<Suspense fallback={<AuthLoadingScreen />}><Register /></Suspense>} />
      <Route path="/awaiting-approval" element={<Suspense fallback={<AuthLoadingScreen />}><AwaitingApproval /></Suspense>} />
      <Route path="/order"           element={<Suspense fallback={<AuthLoadingScreen />}><OrderForm /></Suspense>} />
      <Route path="/status"          element={<RoleProtectedRoute allowedRoles={['SuperAdmin','super_admin']}><Suspense fallback={<AuthLoadingScreen />}><SystemStatus /></Suspense></RoleProtectedRoute>} />
      <Route path="/reset-password"  element={<Suspense fallback={<AuthLoadingScreen />}><ResetPassword /></Suspense>} />
      <Route path="/forgot-password" element={<Suspense fallback={<AuthLoadingScreen />}><ForgotPassword /></Suspense>} />

      {/* ── Shared Authenticated Routes ── */}
      <Route path="/dashboard"   element={<ProtectedRoute><Layout>{wrap(<Dashboard />, 'Dashboard')}</Layout></ProtectedRoute>} />
      <Route path="/school-admin" element={<ProtectedRoute><Layout>{wrap(<Dashboard />, 'Dashboard')}</Layout></ProtectedRoute>} />
      <Route path="/teacher"     element={<ProtectedRoute><Layout>{wrap(<Dashboard />, 'Dashboard')}</Layout></ProtectedRoute>} />

      {/* ── School Admin & Teacher Routes ── */}
      <Route path="/students"          element={<ProtectedRoute><Layout>{wrap(<Students />, 'Students')}</Layout></ProtectedRoute>} />
      <Route path="/students/onboard"  element={<ProtectedRoute><Layout>{wrap(<LearnerOnboarding />, 'Learner Onboarding')}</Layout></ProtectedRoute>} />
      <Route path="/students/:id/edit" element={<ProtectedRoute><Layout>{wrap(<LearnerOnboarding />, 'Edit Learner Profile')}</Layout></ProtectedRoute>} />
      <Route path="/grades"            element={<ProtectedRoute><Layout>{wrap(<Grades />, 'Grades')}</Layout></ProtectedRoute>} />
      <Route path="/subjects"          element={<ProtectedRoute><Layout>{wrap(<Subjects />, 'Subjects')}</Layout></ProtectedRoute>} />
      <Route path="/exams"             element={<ProtectedRoute><Layout>{wrap(<Exams />, 'Exams')}</Layout></ProtectedRoute>} />
      <Route path="/marks"             element={<ProtectedRoute><Layout>{wrap(<MarksEntry />, 'Marks Entry')}</Layout></ProtectedRoute>} />
      <Route path="/attendance"        element={<ProtectedRoute><Layout>{wrap(<Attendance />, 'Attendance')}</Layout></ProtectedRoute>} />
      <Route path="/attendance/report" element={<ProtectedRoute><Layout>{wrap(<AttendanceReport />, 'Attendance Report')}</Layout></ProtectedRoute>} />
      <Route path="/analytics"         element={<ProtectedRoute><Layout>{wrap(<Analytics />, 'Analytics')}</Layout></ProtectedRoute>} />
      <Route path="/reports"           element={<ProtectedRoute><Layout>{wrap(<Reports />, 'Reports')}</Layout></ProtectedRoute>} />
      <Route path="/settings"          element={<ProtectedRoute><Layout>{wrap(<SettingsPage />, 'Settings')}</Layout></ProtectedRoute>} />
      <Route path="/settings/levels" element={
  <RoleProtectedRoute allowedRoles={['Admin','admin','school_admin','Principal']}>
    <Layout>{wrap(<SchoolLevels />, 'School Levels')}</Layout>
  </RoleProtectedRoute>
} />
      <Route path="/insights"          element={<ProtectedRoute><Layout>{wrap(<InsightsCenter />, 'Insights Center')}</Layout></ProtectedRoute>} />

      {/* ── Student Promotion ── */}
      <Route path="/promotion" element={
        <RoleProtectedRoute allowedRoles={['Admin','admin','school_admin','Principal','SuperAdmin','super_admin']}>
          <Layout>{wrap(<StudentPromotion />, 'Student Promotion')}</Layout>
        </RoleProtectedRoute>
      } />

      {/* ── School Admin Only ── */}
      <Route path="/assignments" element={
        <RoleProtectedRoute allowedRoles={['Admin','admin','school_admin','Principal']}>
          <Layout>{wrap(<TeacherAssignments />, 'Teacher Assignments')}</Layout>
        </RoleProtectedRoute>
      } />
      <Route path="/teachers" element={
        <RoleProtectedRoute allowedRoles={['Admin','admin','school_admin','Principal','SuperAdmin','super_admin']}>
          <Layout>{wrap(<Teachers />, 'Teachers')}</Layout>
        </RoleProtectedRoute>
      } />
      <Route path="/subscription" element={
        <RoleProtectedRoute allowedRoles={['Admin','admin','school_admin','Principal','SuperAdmin','super_admin']}>
          <Layout>{wrap(<Subscriptions />, 'Subscription')}</Layout>
        </RoleProtectedRoute>
      } />
      <Route path="/finance" element={
        <RoleProtectedRoute allowedRoles={['Admin','admin','school_admin','Principal','Bursar','bursar','SuperAdmin','super_admin']}>
          <Layout>{wrap(<Finance />, 'Finance')}</Layout>
        </RoleProtectedRoute>
      } />

      {/* ── Super Admin Routes ── */}
      <Route path="/super-admin"         element={<RoleProtectedRoute allowedRoles={['SuperAdmin','super_admin']}><Layout>{wrap(<SuperAdminDashboard />, 'Super Admin Dashboard')}</Layout></RoleProtectedRoute>} />
      <Route path="/super/dashboard"     element={<RoleProtectedRoute allowedRoles={['SuperAdmin','super_admin']}><Layout>{wrap(<SuperAdminDashboard />, 'Super Admin Dashboard')}</Layout></RoleProtectedRoute>} />
      <Route path="/super/schools"       element={<RoleProtectedRoute allowedRoles={['SuperAdmin','super_admin']}><Layout>{wrap(<Schools />, 'Schools')}</Layout></RoleProtectedRoute>} />
      <Route path="/super/users"         element={<RoleProtectedRoute allowedRoles={['SuperAdmin','super_admin']}><Layout>{wrap(<GlobalUsers />, 'Global Users')}</Layout></RoleProtectedRoute>} />
      <Route path="/super/subscriptions" element={<RoleProtectedRoute allowedRoles={['SuperAdmin','super_admin']}><Layout>{wrap(<Subscriptions />, 'Subscriptions')}</Layout></RoleProtectedRoute>} />
      <Route path="/super/analytics"     element={<RoleProtectedRoute allowedRoles={['SuperAdmin','super_admin']}><Layout>{wrap(<SuperAdminAnalytics />, 'Platform Analytics')}</Layout></RoleProtectedRoute>} />
      <Route path="/super/settings"      element={<RoleProtectedRoute allowedRoles={['SuperAdmin','super_admin']}><Layout>{wrap(<SettingsPage />, 'Settings')}</Layout></RoleProtectedRoute>} />
    </Routes>
  );
};

/* ─── App root ───────────────────────────────────────────────────────────── */
// Theme state/class-toggling is owned exclusively by AuthContext (edunexa-theme
// key) — no separate effect here, to avoid the two mechanisms fighting each
// other over the <html> `dark` class.
export default function App() {
  useEffect(() => {
    // The manifest's `orientation: portrait-primary` is only a hint on many
    // Android/Chrome combinations and isn't always enforced. The Screen
    // Orientation API's lock() is the actual enforcement mechanism - but it
    // only works (and only makes sense) when running as an installed
    // standalone app, never inside a regular browser tab, where it throws.
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true; // iOS Safari flag

    if (!isStandalone) return;

    const lockPortrait = () => {
      const orientation = (screen as any).orientation;
      if (orientation?.lock) {
        orientation.lock('portrait').catch(() => {
          // Some devices/browsers reject this (e.g. tablets, or if the
          // fullscreen requirement isn't met) - fail silently, the manifest
          // hint still applies as a fallback.
        });
      }
    };

    lockPortrait();
    // Re-assert on resume - some browsers release the lock when the app is
    // backgrounded and restored.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') lockPortrait();
    });
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      {/* Mounted once, globally: */}
      {/* - OfflineScreen: full-screen takeover the instant the browser goes offline. */}
      {/* - PWAUpdatePrompt: small banner when a newly deployed version is ready. */}
      {/* Neither of these caches or serves any app data - see vite.config.ts. */}
      <OfflineScreen />
      <PWAUpdatePrompt />
    </AuthProvider>
  );
}