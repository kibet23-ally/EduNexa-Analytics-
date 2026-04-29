import React, { lazy, Suspense } from 'react';
import { useAuth } from '../useAuth';
import { Skeleton } from '../components/ui/Skeleton';

const SuperAdminDashboard = lazy(() => import('./SuperAdminDashboard'));
const SchoolDashboard = lazy(() => import('../components/SchoolDashboard'));

const Dashboard = () => {
  const { user } = useAuth();
  
  const isSuperAdmin = user?.role?.toLowerCase() === 'superadmin' || 
                      user?.role?.toLowerCase() === 'super_admin' || 
                      user?.role?.toLowerCase().includes('super');

  return (
    <Suspense fallback={<div className="p-8 space-y-6"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-64 w-full" /></div>}>
      {isSuperAdmin ? <SuperAdminDashboard /> : <SchoolDashboard />}
    </Suspense>
  );
};

export default Dashboard;

