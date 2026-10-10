import React, { useState, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { useData } from '../hooks/useData';
import { Bell, AlertTriangle, Info, CheckCircle2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { Exam, School } from '../types';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  // Real (database-backed) notifications can be marked read server-side;
  // the synthetic ones below (subscription expiry, setup reminders, etc.)
  // only ever exist locally, so they're marked read in local state only.
  dbId?: number;
}

interface DbNotification {
  id: number;
  title: string;
  body: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
}

const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // 1. Fetch data based on role to generate notifications
  const schoolsQuery = useData<School>('schools-notif', 'schools', {
    select: 'id, name, subscription_status, subscription_expiry'
  }, !!user?.school_id || user?.role?.toLowerCase().includes('super'));

  const examsQuery = useData<Exam>('exams-notif', 'exams', {
    select: 'id, exam_name, term, year'
  }, !!user?.school_id);

  // Real notifications — e.g. "a new event was posted" — created
  // server-side (see the notify_school_on_event trigger) whenever
  // someone in the school posts an event/notice. RLS already restricts
  // this to the signed-in user's own rows, so no extra filter is needed
  // here.
  const dbNotificationsQuery = useData<DbNotification>(
    'my-notifications', 'notifications',
    { select: 'id, title, body, type, is_read, created_at', orderBy: { column: 'created_at', ascending: false }, limit: 30 },
    !!user?.id,
  );

  const notifications = useMemo(() => {
    const notifs: Notification[] = [];
    const now = new Date();

    // SUPER ADMIN NOTIFICATIONS
    if (user?.role?.toLowerCase().includes('super')) {
      const schools = schoolsQuery.data || [];
      const expiredCount = schools.filter(s => s.subscription_status?.toLowerCase() === 'expired').length;
      const expiringSoon = schools.filter(s => {
        if (!s.subscription_expiry) return false;
        const expiry = new Date(s.subscription_expiry);
        const diff = expiry.getTime() - now.getTime();
        const days = diff / (1000 * 60 * 60 * 24);
        return days > 0 && days < 30;
      }).length;

      if (expiredCount > 0) {
        notifs.push({
          id: 'super-expired',
          type: 'error',
          title: 'Expired Subscriptions',
          message: `${expiredCount} schools have expired subscriptions.`,
          timestamp: now.toISOString(),
          read: false
        });
      }
      if (expiringSoon > 0) {
        notifs.push({
          id: 'super-expiring',
          type: 'warning',
          title: 'Expiring Soon',
          message: `${expiringSoon} schools have subscriptions expiring within 30 days.`,
          timestamp: now.toISOString(),
          read: false
        });
      }
    }

    // PRINCIPAL / ADMIN NOTIFICATIONS
    if (user?.role === 'Principal' || user?.role === 'Admin') {
      const mySchool = (schoolsQuery.data as School[])?.find(s => s.id === user.school_id);
      if (mySchool?.subscription_expiry) {
        const expiry = new Date(mySchool.subscription_expiry);
        const diff = expiry.getTime() - now.getTime();
        const days = diff / (1000 * 60 * 60 * 24);

        if (days < 7) {
          notifs.push({
            id: 'school-expiry',
            type: 'error',
            title: 'Action Required',
            message: `Your school subscription expires in ${Math.ceil(days)} days.`,
            timestamp: now.toISOString(),
            read: false
          });
        }
      }

      const exams = examsQuery.data || [];
      if (exams.length === 0) {
        notifs.push({
          id: 'no-exams',
          type: 'info',
          title: 'Setup Recommendation',
          message: 'No exams have been created yet. Set up exams to start tracking performance.',
          timestamp: now.toISOString(),
          read: false
        });
      }
    }

    // TEACHER NOTIFICATIONS
    if (user?.role === 'Teacher') {
      notifs.push({
        id: 'teacher-welcome',
        type: 'success',
        title: 'Ready for Class',
        message: 'Remember to take student attendance for your assigned subjects today.',
        timestamp: now.toISOString(),
        read: false
      });

      const exams = examsQuery.data || [];
      if (exams.length > 0) {
        const latestExam = [...exams].sort((a, b) => b.id - a.id)[0];
        notifs.push({
          id: 'teacher-marks',
          type: 'warning',
          title: 'Marks Entry',
          message: `Check if marks for ${latestExam.exam_name} are fully entered.`,
          timestamp: now.toISOString(),
          read: false
        });
      }
    }

    // REAL, DATABASE-BACKED NOTIFICATIONS (events/notices posted by anyone
    // in the school — see notify_school_on_event). These apply to every
    // role, not just admins/teachers, since anyone can be a recipient.
    const dbNotifs: Notification[] = (dbNotificationsQuery.data || []).map(n => ({
      id: `db-${n.id}`,
      dbId: n.id,
      type: (['info', 'warning', 'error', 'success'].includes(n.type) ? n.type : 'info') as Notification['type'],
      title: n.title,
      message: n.body || '',
      timestamp: n.created_at,
      read: n.is_read,
    }));

    return [...dbNotifs, ...notifs]
      .map(n => ({ ...n, read: n.read || readIds.has(n.id) }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [user, schoolsQuery.data, examsQuery.data, dbNotificationsQuery.data, readIds]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = async (notif: Notification) => {
    if (notif.read) return;
    setReadIds(prev => new Set([...Array.from(prev), notif.id]));
    if (notif.dbId != null) {
      await supabase.from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notif.dbId);
    }
  };

  const markAllRead = async () => {
    const allIds = notifications.map(n => n.id);
    setReadIds(new Set([...Array.from(readIds), ...allIds]));
    const unreadDbIds = notifications.filter(n => !n.read && n.dbId != null).map(n => n.dbId as number);
    if (unreadDbIds.length > 0) {
      await supabase.from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', unreadDbIds);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-600 dark:text-slate-300 relative group"
      >
        <Bell size={20} className={cn("transition-transform group-hover:rotate-12", isOpen && "text-primary")} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-4 w-80 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="font-display font-bold text-slate-900 dark:text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllRead}
                    className="text-[10px] uppercase font-black text-primary hover:text-primary/80"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {notifications.map((notif) => (
                      <button
                        key={notif.id}
                        onClick={() => markRead(notif)}
                        className={cn(
                          "w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex gap-3",
                          !notif.read && "bg-blue-50/30 dark:bg-blue-900/10"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                          notif.type === 'error' ? 'bg-red-50 text-red-500' :
                          notif.type === 'warning' ? 'bg-amber-50 text-amber-500' :
                          notif.type === 'success' ? 'bg-emerald-50 text-emerald-500' :
                          'bg-blue-50 text-blue-500'
                        )}>
                          {notif.type === 'error' && <AlertTriangle size={18} />}
                          {notif.type === 'warning' && <Clock size={18} />}
                          {notif.type === 'success' && <CheckCircle2 size={18} />}
                          {notif.type === 'info' && <Info size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                            {notif.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            {notif.message}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
                            {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {!notif.read && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Bell className="text-slate-300 dark:text-slate-600" size={32} />
                    </div>
                    <p className="text-sm font-bold text-slate-400 dark:text-slate-500">No new notifications</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">You're all caught up!</p>
                  </div>
                )}
              </div>
              
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="w-full py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;