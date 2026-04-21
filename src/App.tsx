import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Grades from './pages/Grades';
import Subjects from './pages/Subjects';
import Exams from './pages/Exams';
import MarksEntry from './pages/MarksEntry';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import Teachers from './pages/Teachers';
import OrderForm from './pages/OrderForm';
import Schools from './pages/Schools';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import GlobalUsers from './pages/GlobalUsers';
import Subscriptions from './pages/Subscriptions';
import SuperSettings from './pages/SuperSettings';
import Sidebar from './components/Sidebar';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/students" element={<ProtectedRoute><Layout><Students /></Layout></ProtectedRoute>} />
      <Route path="/grades" element={<ProtectedRoute><Layout><Grades /></Layout></ProtectedRoute>} />
      <Route path="/subjects" element={<ProtectedRoute><Layout><Subjects /></Layout></ProtectedRoute>} />
      <Route path="/exams" element={<ProtectedRoute><Layout><Exams /></Layout></ProtectedRoute>} />
      <Route path="/marks" element={<ProtectedRoute><Layout><MarksEntry /></Layout></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><Layout><Analytics /></Layout></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Layout><Reports /></Layout></ProtectedRoute>} />
      <Route path="/teachers" element={<ProtectedRoute><Layout><Teachers /></Layout></ProtectedRoute>} />
      <Route path="/schools" element={<ProtectedRoute><Layout><Schools /></Layout></ProtectedRoute>} />
      <Route path="/super/dashboard" element={<ProtectedRoute><Layout><SuperAdminDashboard /></Layout></ProtectedRoute>} />
      <Route path="/super/schools" element={<ProtectedRoute><Layout><Schools /></Layout></ProtectedRoute>} />
      <Route path="/super/users" element={<ProtectedRoute><Layout><GlobalUsers /></Layout></ProtectedRoute>} />
      <Route path="/super/subscriptions" element={<ProtectedRoute><Layout><Subscriptions /></Layout></ProtectedRoute>} />
      <Route path="/super/analytics" element={<ProtectedRoute><Layout><SuperAdminDashboard /></Layout></ProtectedRoute>} />
      <Route path="/super/settings" element={<ProtectedRoute><Layout><SuperSettings /></Layout></ProtectedRoute>} />
      <Route path="/order" element={<OrderForm />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
