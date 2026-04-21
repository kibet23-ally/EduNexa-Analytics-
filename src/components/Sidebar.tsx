import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../useAuth';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  BookOpen, 
  FileEdit, 
  BarChart3, 
  FileText, 
  LogOut,
  UserCog,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Building2,
  Users2,
  CreditCard,
  PieChart,
  Settings
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const Sidebar = () => {
  const { user, logout } = useAuth();
  
  // 4. Remember state - save in localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    // If not saved, default to collapsed on small screens
    if (saved === null) return window.innerWidth < 768;
    return saved === 'true';
  });

  // 1. Auto-collapse on mobile - sidebar should automatically collapse to just icons on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    // Initial check
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', isCollapsed.toString());
  }, [isCollapsed]);

  const navItems = user?.role === 'SuperAdmin' ? [
    { to: '/super/dashboard', icon: LayoutDashboard, label: 'Dashboard Overview' },
    { to: '/super/schools', icon: Building2, label: 'Schools' },
    { to: '/super/users', icon: Users2, label: 'Global Users' },
    { to: '/super/subscriptions', icon: CreditCard, label: 'Subscriptions' },
    { to: '/super/analytics', icon: PieChart, label: 'Subscription Analytics' },
    { to: '/super/settings', icon: Settings, label: 'Settings' },
  ] : [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/students', icon: Users, label: 'Students' },
    { to: '/grades', icon: GraduationCap, label: 'Grades' },
    { to: '/subjects', icon: BookOpen, label: 'Subjects' },
    { to: '/exams', icon: ClipboardList, label: 'Exams' },
    { to: '/marks', icon: FileEdit, label: 'Marks Entry' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/reports', icon: FileText, label: 'Reports' },
  ];

  if (user?.role === 'Admin') {
    navItems.push({ to: '/teachers', icon: UserCog, label: 'Teachers' });
    navItems.push({ to: '/schools', icon: Building2, label: 'Schools' });
  }

  // 6. Auto-collapse after navigation on mobile
  const handleNavItemClick = () => {
    if (window.innerWidth < 768) {
      setIsCollapsed(true);
    }
  };

  return (
    <motion.aside 
      initial={false}
      // 5. Smooth animation - transition width
      animate={{ width: isCollapsed ? 80 : 256 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="bg-blue-900 text-white flex flex-col h-screen sticky top-0 z-40 shadow-xl"
    >
      <div className={cn(
        "p-6 border-b border-blue-800 flex items-center justify-between relative",
        isCollapsed && "px-4 justify-center"
      )}>
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <h1 className="text-xl font-bold tracking-tight">EDUNEXA</h1>
              <p className="text-xs text-blue-300">Analytics Platform</p>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* 2. Toggle button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "p-1.5 rounded-lg bg-blue-800 hover:bg-blue-700 transition-colors text-blue-200",
            isCollapsed ? "mt-2" : "absolute -right-3 top-1/2 -translate-y-1/2 bg-blue-900 border border-blue-800 shadow-lg"
          )}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={handleNavItemClick}
            // 3. Collapsed state - tooltips on hover (using custom div for tooltips)
            title={isCollapsed ? item.label : ''}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm font-medium group relative",
              // 8. Active state - clearly highlight active navigation item
              isActive ? "bg-blue-800 text-white shadow-inner" : "text-blue-100 hover:bg-blue-800/50",
              isCollapsed && "justify-center px-0"
            )}
          >
            <item.icon size={20} className={cn("shrink-0", !isCollapsed && "group-hover:scale-110 transition-transform")} />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="whitespace-nowrap overflow-hidden"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
            {/* 3. Custom Hover Tooltip for Collapsed State */}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                {item.label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={cn("p-4 border-t border-blue-800", isCollapsed && "px-2")}>
        <div className={cn("flex items-center gap-3 px-4 py-3 mb-2 rounded-lg bg-blue-950/30", isCollapsed && "px-0 justify-center")}>
          <div className="w-8 h-8 shrink-0 rounded-full bg-blue-700 flex items-center justify-center text-xs font-bold border border-blue-600 shadow-sm">
            {user?.name.charAt(0)}
          </div>
          {!isCollapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-blue-300">{user?.role}</p>
            </div>
          )}
        </div>
        <button
          onClick={logout}
          title={isCollapsed ? "Logout" : ""}
          className={cn(
            "flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-red-300 hover:bg-red-900/30 transition-colors group relative",
            isCollapsed && "justify-center px-0"
          )}
        >
          <LogOut size={20} className="shrink-0" />
          {!isCollapsed && <span>Logout</span>}
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-red-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Logout
            </div>
          )}
        </button>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
