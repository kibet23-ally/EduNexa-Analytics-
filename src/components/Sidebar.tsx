import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../useAuth';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  BarChart3, 
  LogOut,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Building2,
  Users2,
  CreditCard,
  PieChart,
  Settings,
  UserCheck,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from 'react-router-dom';

interface NavSubItem {
  to: string;
  label: string;
}

interface NavItem {
  to?: string;
  icon: React.ElementType;
  label: string;
  subItems?: NavSubItem[];
}

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  
  // 4. Remember state - save in localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    // If not saved, default to collapsed on small screens
    if (saved === null) return window.innerWidth < 768;
    return saved === 'true';
  });

  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({});

  const toggleSubMenu = (label: string) => {
    if (isCollapsed) setIsCollapsed(false);
    setOpenSubMenus(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

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

  const isSuperAdminRole = user?.role?.toLowerCase() === 'superadmin' || user?.role?.toLowerCase() === 'super_admin' || user?.role?.toLowerCase().includes('super');
  
  const navItems: NavItem[] = isSuperAdminRole ? [
    { to: '/super-admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/super/schools', icon: Building2, label: 'My Institution' },
    { to: '/super/users', icon: Users2, label: 'User Management' },
    { to: '/super/subscriptions', icon: CreditCard, label: 'Platform Subscriptions' },
    { to: '/super/analytics', icon: PieChart, label: 'Analytics' },
    { to: '/status', icon: ClipboardList, label: 'Audit Logs' },
    { to: '/super/settings', icon: Settings, label: 'Settings' },
  ] : [
    { to: '/school-admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/students', icon: Users, label: 'Students' },
    { 
      icon: GraduationCap, 
      label: 'Academics',
      subItems: [
        { to: '/grades', label: 'Grades' },
        { to: '/subjects', label: 'Subjects' },
      ]
    },
    { 
      icon: ClipboardList, 
      label: 'Examinations',
      subItems: [
        { to: '/exams', label: 'Exams' },
        { to: '/marks', label: 'Marks Entry' },
      ]
    },
    { 
      icon: UserCheck, 
      label: 'Attendance',
      subItems: [
        { to: '/attendance', label: 'Take Attendance' },
        { to: '/attendance/report', label: 'Attendance Report' },
      ]
    },
    { 
      icon: BarChart3, 
      label: 'Analytics & Reports',
      subItems: [
        { to: '/analytics', label: 'Analytics' },
        { to: '/reports', label: 'Reports' },
      ]
    },
  ];

  if (user?.role === 'Admin' || user?.role === 'Principal' || user?.role === 'admin') {
    // Add subscription for school admins
    navItems.push({ to: '/subscription', icon: CreditCard, label: 'Subscription' });
    
    // Insert teachers before subscription
    const subIndex = navItems.findIndex(i => i.to === '/subscription');
    navItems.splice(subIndex, 0, { to: '/teachers', icon: Users2, label: 'Teachers' });
  }

  // Settings should always be at the bottom for non-SuperAdmin too
  if (!isSuperAdminRole) {
    navItems.push({ to: '/settings', icon: Settings, label: 'Settings' });
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
      className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 flex flex-col h-screen sticky top-0 z-40 shadow-xl border-r border-slate-100 dark:border-slate-800 transition-colors duration-300"
    >
      <div className={cn(
        "p-6 border-b border-slate-50 dark:border-slate-800/50 flex items-center justify-between relative",
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
              <h1 className="text-xl font-display font-bold tracking-tight text-slate-900 dark:text-white">EDUNEXA</h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">Analytics Platform</p>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* 2. Toggle button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400 dark:text-slate-500",
            isCollapsed ? "mt-2" : "absolute -right-3 top-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-lg text-primary"
          )}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {navItems.map((item) => {
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isSubMenuOpen = openSubMenus[item.label];
          const isAnyChildActive = hasSubItems && item.subItems?.some(sub => location.pathname === sub.to);

          if (hasSubItems) {
            return (
              <div key={item.label} className={cn("space-y-1", isCollapsed && "flex flex-col items-center")}>
                <button
                  onClick={() => toggleSubMenu(item.label)}
                  title={isCollapsed ? item.label : ''}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm font-medium group relative",
                    isAnyChildActive && !isSubMenuOpen
                      ? "bg-primary/5 text-primary"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white",
                    isCollapsed && "justify-center px-0"
                  )}
                >
                  <item.icon size={20} className={cn("shrink-0", !isCollapsed && "group-hover:scale-110 transition-transform")} />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 text-left whitespace-nowrap overflow-hidden">
                        {item.label}
                      </span>
                      <ChevronDown 
                        size={16} 
                        className={cn("transition-transform duration-200 text-slate-400", isSubMenuOpen && "rotate-180")} 
                      />
                    </>
                  )}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 dark:bg-primary text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                      {item.label}
                    </div>
                  )}
                </button>

                <AnimatePresence>
                  {isSubMenuOpen && !isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-1 pl-11 pr-2"
                    >
                      {item.subItems?.map(sub => (
                        <NavLink
                          key={sub.to}
                          to={sub.to}
                          onClick={handleNavItemClick}
                          className={({ isActive }) => cn(
                            "block px-3 py-2 rounded-md text-xs font-medium transition-all",
                            isActive 
                              ? "text-primary bg-primary/5 font-bold" 
                              : "text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          )}
                        >
                          {sub.label}
                        </NavLink>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }

          return (
            <NavLink
              key={item.to || item.label}
              to={item.to || '#'}
              onClick={handleNavItemClick}
              title={isCollapsed ? item.label : ''}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm font-medium group relative",
                isActive 
                  ? "bg-primary/10 text-primary shadow-sm border-l-4 border-primary" 
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white",
                isCollapsed && "justify-center px-0 border-l-0"
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
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 dark:bg-primary text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                  {item.label}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className={cn("p-4 border-t border-slate-50 dark:border-slate-800/50", isCollapsed && "px-2")}>
        <div className={cn("flex items-center gap-3 px-4 py-3 mb-2 rounded-lg bg-slate-50 dark:bg-slate-800/50", isCollapsed && "px-0 justify-center")}>
          <div className="w-8 h-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold border border-primary/20 shadow-sm text-primary">
            {user?.name.charAt(0)}
          </div>
          {!isCollapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold truncate text-slate-900 dark:text-white">{user?.name}</p>
              <p className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500">{user?.role}</p>
            </div>
          )}
        </div>
        <button
          onClick={logout}
          title={isCollapsed ? "Logout" : ""}
          className={cn(
            "flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group relative",
            isCollapsed && "justify-center px-0"
          )}
        >
          <LogOut size={20} className="shrink-0" />
          {!isCollapsed && <span className="font-bold">Logout</span>}
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
              Logout
            </div>
          )}
        </button>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
