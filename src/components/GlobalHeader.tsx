import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { Clock, Calendar, Building2, User, Moon, Sun } from 'lucide-react';
import { supabase } from '../lib/supabase';
import NotificationBell from './NotificationBell';

const GlobalHeader: React.FC = () => {
  const { user, theme, setTheme } = useAuth();
  const [schoolName, setSchoolName] = useState<string>(() => user?.school_name || 'Loading Institution...');
  const [currentTime, setCurrentTime] = useState(new Date());

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    // 1. Live updating time
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // If school_name is already set in state via initializer or previous fetch, skip sync set
    if (user?.school_name && schoolName === user.school_name) {
      return;
    }
    
    // If it's different, update it
    if (user?.school_name) {
      const name = user.school_name;
      Promise.resolve().then(() => setSchoolName(name));
      return;
    }

    const fetchSchoolInfo = async () => {
      if (user?.role?.toLowerCase() === 'superadmin' || user?.role?.toLowerCase() === 'super_admin' || user?.role?.toLowerCase().includes('super')) {
        setSchoolName('EduNexa Analytics (System)');
        return;
      }

      if (!user?.school_id) {
        return;
      }
      try {
        const { data: school, error } = await supabase
          .from('schools')
          .select('name')
          .eq('id', user.school_id)
          .single();
          
        if (error) throw error;
        if (school) {
          setSchoolName(school.name);
        }
      } catch (err) {
        console.error('Failed to fetch school name from Supabase:', err);
        setSchoolName(user.school_name || 'EduNexa School');
      }
    };

    fetchSchoolInfo();
  }, [user?.school_id, user?.school_name, user?.role, schoolName]);

  // Format date: Friday, 23 April 2026
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  };

  // Format time: 15:42:10
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-GB', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-50 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] transition-colors">
      <div className="flex items-center gap-4">
        <div className="bg-primary/5 dark:bg-primary/10 p-2.5 rounded-xl">
          <Building2 className="text-primary" size={24} />
        </div>
        <div>
          <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white leading-tight">
            {schoolName}
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <User size={12} className="text-slate-400" />
            <span>{user?.name || 'Authorized Personnel'}</span>
            <span className="bg-slate-200 dark:bg-slate-700 w-1 h-1 rounded-full"></span>
            <span className="text-accent font-bold uppercase tracking-wider text-[10px]">
              {(user?.role === 'Admin' || user?.role === 'admin') ? 'Admin' : ((user?.role === 'SuperAdmin' || user?.role === 'super_admin') ? 'Super Admin' : (user?.role === 'Principal' ? 'Principal' : user?.role))}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-5 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-700 transition-colors">
        <div className="flex items-center gap-2.5">
          <Calendar size={18} className="text-primary opacity-60" />
          <span className="text-sm font-medium tracking-tight">
            {formatDate(currentTime)}
          </span>
        </div>
        
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700"></div>
        
        <div className="flex items-center gap-2.5 min-w-[90px]">
          <Clock size={18} className="text-primary opacity-60" />
          <span className="text-sm font-mono font-bold text-slate-800 dark:text-white tabular-nums">
            {formatTime(currentTime)}
          </span>
        </div>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700"></div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          
          <button 
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-600 dark:text-slate-300 shadow-sm"
            title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default GlobalHeader;
