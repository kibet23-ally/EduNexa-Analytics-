import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Shows a full-screen branded "No Internet Connection" message whenever the
 * browser goes offline, and disappears automatically the instant connectivity
 * returns. This is purely a UI overlay - it does NOT cache any app data, does
 * NOT enable any offline mode, and does NOT let the app continue functioning
 * without a network connection. Every page still requires a live connection
 * to Supabase to load or save anything.
 */
const OfflineScreen: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-slate-50 dark:bg-slate-950 px-6 text-center">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-[#1e3a5f] flex items-center justify-center">
          <span className="text-white font-black text-lg">E</span>
        </div>
        <span className="text-2xl font-black text-[#1e3a5f] dark:text-white">EduNexa</span>
      </div>

      <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
        <WifiOff className="text-red-500" size={30} />
      </div>

      <div className="space-y-1.5 max-w-sm">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">No Internet Connection</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Please reconnect to continue using EduNexa Analytics.
        </p>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="mt-2 px-5 py-2.5 rounded-lg text-sm font-bold bg-[#1e3a5f] text-white hover:bg-[#16304d] transition-colors"
      >
        Try Again
      </button>
    </div>
  );
};

export default OfflineScreen;