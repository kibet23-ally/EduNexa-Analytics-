import { ErrorBoundary } from './components/ErrorBoundary';
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';
import { Skeleton } from './components/ui/Skeleton';
import Sidebar from './components/Sidebar';
import GlobalHeader from './components/GlobalHeader';
import SubscriptionBanner from './components/SubscriptionBanner';

// Lazy load all pages
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Students = lazy(() => import('./pages/Students'));
const Grades = lazy(() => import('./pages/Grades'));
const Subjects = lazy(() => import('./pages/Subjects'));
const Exams = lazy(() => import('./pages/Exams'));
const MarksEntry = lazy(() => import('./pages/MarksEntry'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Reports = lazy(() => import('./pages/Reports'));
const Teachers = lazy(() => import('./pages/Teachers'));
const OrderForm = lazy(() => import('./pages/OrderForm'));
const Schools = lazy(() => import('./pages/Schools'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));
const GlobalUsers = lazy(() => import('./pages/GlobalUsers'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const SystemStatus = lazy(() => import('./pages/SystemStatus'));
const Attendance = lazy(() => import('./pages/Attendance'));
const AttendanceReport = lazy(() => import('./pages/AttendanceReport'));
const SchoolSubscription = lazy(() => import('./pages/SchoolSubscription'));

const PageFallback = () => (
  <div className="space-y-6 animate-in fade-in duration-500">
    <Skeleton className="h-10 w-1/3 mb-4" />
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
    <Skeleton className="h-64 w-full rounded-xl" />
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const RoleProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles: string[] }> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!user) return <Navigate to="/login" />;
  
  const normalize = (r: string) => r.toLowerCase().replace(/_/g, '').replace('school', '');
  const normalizedUserRole = normalize(user.role);
  const normalizedAllowedRoles = allowedRoles.map(r => normalize(r));
  
  if (!normalizedAllowedRoles.includes(normalizedUserRole)) return <Navigate to="/" />;
  return <>{children}</>;
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <SubscriptionBanner />
        <GlobalHeader />
        <main className="flex-1 p-6 overflow-auto bg-slate-50 dark:bg-slate-950">
          <Suspense fallback={<PageFallback />}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Suspense fallback={<div className="h-screen flex items-center justify-center bg-slate-50">Loading...</div>}><Login /></Suspense>} />
      <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/school-admin" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/teacher" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/students" element={<ProtectedRoute><Layout><Students /></Layout></ProtectedRoute>} />
      <Route path="/grades" element={<ProtectedRoute><Layout><Grades /></Layout></ProtectedRoute>} />
      <Route path="/subjects" element={<ProtectedRoute><Layout><Subjects /></Layout></ProtectedRoute>} />
      <Route path="/exams" element={<ProtectedRoute><Layout><Exams /></Layout></ProtectedRoute>} />
      <Route path="/attendance" element={<ProtectedRoute><Layout><Attendance /></Layout></ProtectedRoute>} />
      <Route path="/attendance/report" element={<ProtectedRoute><Layout><AttendanceReport /></Layout></ProtectedRoute>} />
      <Route path="/marks" element={<ProtectedRoute><Layout><MarksEntry /></Layout></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><Layout><ErrorBoundary name="Analytics"><Analytics /></ErrorBoundary></Layout></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Layout><Reports /></Layout></ProtectedRoute>} />
      <Route path="/teachers" element={<RoleProtectedRoute allowedRoles={['Admin', 'Principal', 'SuperAdmin']}><Layout><Teachers /></Layout></RoleProtectedRoute>} />
      <Route path="/subscription" element={<RoleProtectedRoute allowedRoles={['Admin', 'Principal', 'SuperAdmin']}><Layout><SchoolSubscription /></Layout></RoleProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Layout><ErrorBoundary name="Settings"><SettingsPage /></ErrorBoundary></Layout></ProtectedRoute>} />
      <Route path="/order" element={<Suspense fallback={<div>Loading...</div>}><OrderForm /></Suspense>} />
      <Route path="/status" element={<Suspense fallback={<div>Loading...</div>}><SystemStatus /></Suspense>} />
      
      {/* Super Admin Routes */}
      <Route path="/super-admin" element={<RoleProtectedRoute allowedRoles={['SuperAdmin', 'super_admin']}><Layout><SuperAdminDashboard /></Layout></RoleProtectedRoute>} />
      <Route path="/super/dashboard" element={<RoleProtectedRoute allowedRoles={['SuperAdmin', 'super_admin']}><Layout><SuperAdminDashboard /></Layout></RoleProtectedRoute>} />
      <Route path="/super/schools" element={<RoleProtectedRoute allowedRoles={['SuperAdmin', 'super_admin']}><Layout><Schools /></Layout></RoleProtectedRoute>} />
      <Route path="/super/users" element={<RoleProtectedRoute allowedRoles={['SuperAdmin', 'super_admin']}><Layout><GlobalUsers /></Layout></RoleProtectedRoute>} />
      <Route path="/super/subscriptions" element={<RoleProtectedRoute allowedRoles={['SuperAdmin', 'super_admin']}><Layout><Subscriptions /></Layout></RoleProtectedRoute>} />
      <Route path="/super/analytics" element={<RoleProtectedRoute allowedRoles={['SuperAdmin', 'super_admin']}><Layout><ErrorBoundary name="Analytics"><Analytics /></ErrorBoundary></Layout></RoleProtectedRoute>} />
      <Route path="/super/settings" element={<RoleProtectedRoute allowedRoles={['SuperAdmin', 'super_admin']}><Layout><ErrorBoundary name="Settings"><SettingsPage /></ErrorBoundary></Layout></RoleProtectedRoute>} />
    </Routes>
  );
};

export default function App() {
  React.useEffect(() => {
    // Force light mode as default if nothing set
    if (!localStorage.getItem('edunexa_theme')) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('edunexa_theme', 'light');
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
