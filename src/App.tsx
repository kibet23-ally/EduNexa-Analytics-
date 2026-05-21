import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';
import { Skeleton } from './components/ui/Skeleton';
import Sidebar from './components/Sidebar';
import GlobalHeader from './components/GlobalHeader';
import SubscriptionBanner from './components/SubscriptionBanner';
import { ErrorBoundary } from './components/ErrorBoundary';

// ── Lazy pages (unchanged) ────────────────────────────────────────────────────
const Landing          = lazy(() => import('./pages/Landing'));
const Login            = lazy(() => import('./pages/Login'));
const Register         = lazy(() => import('./pages/Register'));
const AwaitingApproval = lazy(() => import('./pages/AwaitingApproval'));
const Dashboard        = lazy(() => import('./pages/Dashboard'));
const Students         = lazy(() => import('./pages/Students'));
const Grades           = lazy(() => import('./pages/Grades'));
const Subjects         = lazy(() => import('./pages/Subjects'));
const Exams            = lazy(() => import('./pages/Exams'));
const MarksEntry       = lazy(() => import('./pages/MarksEntry'));
const Analytics        = lazy(() => import('./pages/Analytics'));
const Reports          = lazy(() => import('./pages/Reports'));
const Teachers         = lazy(() => import('./pages/Teachers'));
const OrderForm        = lazy(() => import('./pages/OrderForm'));
const Schools          = lazy(() => import('./pages/Schools'));
const SuperAdminDashboard  = lazy(() => import('./pages/SuperAdminDashboard'));
const SuperAdminAnalytics  = lazy(() => import('./pages/SuperAdminAnalytics'));
const GlobalUsers          = lazy(() => import('./pages/GlobalUsers'));
const Subscriptions        = lazy(() => import('./pages/Subscriptions'));
const SchoolSubscription   = lazy(() => import('./pages/SchoolSubscription'));
const TeacherAssignments   = lazy(() => import('./pages/TeacherAssignments'));
const SettingsPage         = lazy(() => import('./pages/Settings'));
const SystemStatus         = lazy(() => import('./pages/SystemStatus'));
const Attendance           = lazy(() => import('./pages/Attendance'));
const AttendanceReport     = lazy(() => import('./pages/AttendanceReport'));
const StudentPromotion     = lazy(() => import('./pages/StudentPromotion'));
const ResetPassword        = lazy(() => import('./pages/ResetPassword'));
const ForgotPassword       = lazy(() => import('./pages/ForgotPassword'));
const Features  = lazy(() => import('./pages/Features'));
const Pricing   = lazy(() => import('./pages/Pricing'));
const About     = lazy(() => import('./pages/About'));
const Contact   = lazy(() => import('./pages/Contact'));
const Privacy   = lazy(() => import('./pages/Privacy'));
const Terms     = lazy(() => import('./pages/Terms'));

// ── Skeletons ─────────────────────────────────────────────────────────────────
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

const LoadingScreen = () => (
  <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-blue-200/40" />
        <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   PROTECTED ROUTE
   KEY FIX: previously checked isAuthenticated synchronously,
   which fired BEFORE Supabase had confirmed/restored the session
   on hard refresh → instant redirect to /login for logged-in users.
   Now we block on sessionReady first.
──────────────────────────────────────────────────────────────  */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, sessionReady } = useAuth();

  // Session not yet confirmed — show spinner, do NOT redirect
  if (!sessionReady) return <LoadingScreen />;

  // Session confirmed and user is not authenticated
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

/* ─────────────────────────────────────────────────────────────
   ROLE-PROTECTED ROUTE
   Same fix: wait for sessionReady before evaluating role.
──────────────────────────────────────────────────────────────  */
const RoleProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles: string[];
}> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, sessionReady } = useAuth();

  if (!sessionReady)    return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user)            return <Navigate to="/login" replace />;

  const normalize = (r: string) =>
    r.toLowerCase().replace(/_/g, '').replace('school', '');

  const normalizedUserRole    = normalize(user.role);
  const normalizedAllowedRoles = allowedRoles.map(r => normalize(r));

  if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// ── Helpers (unchanged) ───────────────────────────────────────────────────────
const wrap = (component: React.ReactNode, name?: string) => (
  <ErrorBoundary name={name}>
    <Suspense fallback={<PageFallback />}>
      {component}
    </Suspense>
  </ErrorBoundary>
);

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
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

// ── Routes (identical to your repo) ──────────────────────────────────────────
const AppRoutes = () => (
  <Routes>
    {/* Public */}
    <Route path="/"                element={<Suspense fallback={<LoadingScreen />}><Landing /></Suspense>} />
    <Route path="/features"        element={<Suspense fallback={<LoadingScreen />}><Features /></Suspense>} />
    <Route path="/pricing"         element={<Suspense fallback={<LoadingScreen />}><Pricing /></Suspense>} />
    <Route path="/about"           element={<Suspense fallback={<LoadingScreen />}><About /></Suspense>} />
    <Route path="/contact"         element={<Suspense fallback={<LoadingScreen />}><Contact /></Suspense>} />
    <Route path="/privacy"         element={<Suspense fallback={<LoadingScreen />}><Privacy /></Suspense>} />
    <Route path="/terms"           element={<Suspense fallback={<LoadingScreen />}><Terms /></Suspense>} />
    <Route path="/login"           element={<Suspense fallback={<LoadingScreen />}><Login /></Suspense>} />
    <Route path="/register"        element={<Suspense fallback={<LoadingScreen />}><Register /></Suspense>} />
    <Route path="/awaiting-approval" element={<Suspense fallback={<LoadingScreen />}><AwaitingApproval /></Suspense>} />
    <Route path="/order"           element={<Suspense fallback={<LoadingScreen />}><OrderForm /></Suspense>} />
    <Route path="/status"          element={<Suspense fallback={<LoadingScreen />}><SystemStatus /></Suspense>} />
    <Route path="/reset-password"  element={<Suspense fallback={<LoadingScreen />}><ResetPassword /></Suspense>} />
    <Route path="/forgot-password" element={<Suspense fallback={<LoadingScreen />}><ForgotPassword /></Suspense>} />

    {/* Shared authenticated */}
    <Route path="/dashboard"   element={<ProtectedRoute><Layout>{wrap(<Dashboard />, 'Dashboard')}</Layout></ProtectedRoute>} />
    <Route path="/school-admin" element={<ProtectedRoute><Layout>{wrap(<Dashboard />, 'Dashboard')}</Layout></ProtectedRoute>} />
    <Route path="/teacher"     element={<ProtectedRoute><Layout>{wrap(<Dashboard />, 'Dashboard')}</Layout></ProtectedRoute>} />
    <Route path="/students"    element={<ProtectedRoute><Layout>{wrap(<Students />, 'Students')}</Layout></ProtectedRoute>} />
    <Route path="/grades"      element={<ProtectedRoute><Layout>{wrap(<Grades />, 'Grades')}</Layout></ProtectedRoute>} />
    <Route path="/subjects"    element={<ProtectedRoute><Layout>{wrap(<Subjects />, 'Subjects')}</Layout></ProtectedRoute>} />
    <Route path="/exams"       element={<ProtectedRoute><Layout>{wrap(<Exams />, 'Exams')}</Layout></ProtectedRoute>} />
    <Route path="/marks"       element={<ProtectedRoute><Layout>{wrap(<MarksEntry />, 'Marks Entry')}</Layout></ProtectedRoute>} />
    <Route path="/attendance"  element={<ProtectedRoute><Layout>{wrap(<Attendance />, 'Attendance')}</Layout></ProtectedRoute>} />
    <Route path="/attendance/report" element={<ProtectedRoute><Layout>{wrap(<AttendanceReport />, 'Attendance Report')}</Layout></ProtectedRoute>} />
    <Route path="/analytics"   element={<ProtectedRoute><Layout>{wrap(<Analytics />, 'Analytics')}</Layout></ProtectedRoute>} />
    <Route path="/reports"     element={<ProtectedRoute><Layout>{wrap(<Reports />, 'Reports')}</Layout></ProtectedRoute>} />
    <Route path="/settings"    element={<ProtectedRoute><Layout>{wrap(<SettingsPage />, 'Settings')}</Layout></ProtectedRoute>} />

    {/* Role-protected */}
    <Route path="/promotion"
      element={
        <RoleProtectedRoute allowedRoles={['Admin','admin','school_admin','Principal','SuperAdmin','super_admin']}>
          <Layout>{wrap(<StudentPromotion />, 'Student Promotion')}</Layout>
        </RoleProtectedRoute>
      }
    />
    <Route path="/assignments"
      element={
        <RoleProtectedRoute allowedRoles={['Admin','admin','school_admin','Principal']}>
          <Layout>{wrap(<TeacherAssignments />, 'Teacher Assignments')}</Layout>
        </RoleProtectedRoute>
      }
    />
    <Route path="/teachers"
      element={
        <RoleProtectedRoute allowedRoles={['Admin','admin','school_admin','Principal','SuperAdmin','super_admin']}>
          <Layout>{wrap(<Teachers />, 'Teachers')}</Layout>
        </RoleProtectedRoute>
      }
    />
    <Route path="/subscription"
      element={
        <RoleProtectedRoute allowedRoles={['Admin','admin','school_admin','Principal','SuperAdmin','super_admin']}>
          <Layout>{wrap(<SchoolSubscription />, 'Subscription')}</Layout>
        </RoleProtectedRoute>
      }
    />
    <Route path="/super-admin"
      element={<RoleProtectedRoute allowedRoles={['SuperAdmin','super_admin']}><Layout>{wrap(<SuperAdminDashboard />, 'Super Admin Dashboard')}</Layout></RoleProtectedRoute>}
    />
    <Route path="/super/dashboard"
      element={<RoleProtectedRoute allowedRoles={['SuperAdmin','super_admin']}><Layout>{wrap(<SuperAdminDashboard />, 'Super Admin Dashboard')}</Layout></RoleProtectedRoute>}
    />
    <Route path="/super/schools"
      element={<RoleProtectedRoute allowedRoles={['SuperAdmin','super_admin']}><Layout>{wrap(<Schools />, 'Schools')}</Layout></RoleProtectedRoute>}
    />
    <Route path="/super/users"
      element={<RoleProtectedRoute allowedRoles={['SuperAdmin','super_admin']}><Layout>{wrap(<GlobalUsers />, 'Global Users')}</Layout></RoleProtectedRoute>}
    />
    <Route path="/super/subscriptions"
      element={<RoleProtectedRoute allowedRoles={['SuperAdmin','super_admin']}><Layout>{wrap(<Subscriptions />, 'Subscriptions')}</Layout></RoleProtectedRoute>}
    />
    <Route path="/super/analytics"
      element={<RoleProtectedRoute allowedRoles={['SuperAdmin','super_admin']}><Layout>{wrap(<SuperAdminAnalytics />, 'Platform Analytics')}</Layout></RoleProtectedRoute>}
    />
    <Route path="/super/settings"
      element={<RoleProtectedRoute allowedRoles={['SuperAdmin','super_admin']}><Layout>{wrap(<SettingsPage />, 'Settings')}</Layout></RoleProtectedRoute>}
    />
  </Routes>
);

export default function App() {
  React.useEffect(() => {
    if (!localStorage.getItem(THEME_KEY)) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

// Keep in sync with AuthContext
const THEME_KEY = 'edunexa_theme';