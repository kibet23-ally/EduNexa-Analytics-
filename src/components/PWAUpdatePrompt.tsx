import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

/**
 * Registers the service worker and shows a small branded banner whenever a
 * new deployed version is available, prompting the user to refresh. The
 * service worker itself only ever precaches static build assets (JS/CSS/
 * icons/fonts) - see vite.config.ts - so "new version available" here means
 * exactly that: new app code, never new/stale data.
 *
 * Update checks are deliberately aggressive - a school admin leaving a tab
 * open for a while shouldn't be stuck on stale code any longer than
 * necessary. Every one of these calls the same cheap registration.update()
 * (a small HTTP request for sw.js, most often a 304), so firing it from
 * several triggers costs very little:
 *  - immediately on load
 *  - on every in-app route change (this component lives inside
 *    BrowserRouter specifically so useLocation() can drive this)
 *  - whenever the tab/window regains visibility OR focus (some browsers
 *    fire one but not the other in certain embedding contexts)
 *  - whenever the network comes back online
 *  - every 5 minutes regardless, for a tab left open and idle
 */
const PWAUpdatePrompt: React.FC = () => {
  const location = useLocation();
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true, // register the SW as soon as the app loads - required
                      // for Chrome's install criteria to be met promptly.
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      registrationRef.current = registration;
      registration.update().catch(() => {});
    },
  });

  useEffect(() => {
    const checkNow = () => registrationRef.current?.update().catch(() => {});

    const onVisibility = () => { if (document.visibilityState === 'visible') checkNow(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', checkNow);
    window.addEventListener('online', checkNow);

    const intervalId = setInterval(checkNow, 5 * 60 * 1000); // every 5 minutes

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', checkNow);
      window.removeEventListener('online', checkNow);
      clearInterval(intervalId);
    };
  }, []);

  // Re-check on every in-app navigation - cheap, and catches a deploy that
  // landed while the user was actively clicking around rather than idle.
  useEffect(() => {
    registrationRef.current?.update().catch(() => {});
  }, [location.pathname]);

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9998] max-w-sm w-[calc(100%-2rem)] sm:w-auto">
      <div className="flex items-start gap-3 bg-slate-900 text-white rounded-xl shadow-2xl p-4 border border-slate-700">
        <div className="w-8 h-8 rounded-lg bg-[#1e3a5f] flex items-center justify-center shrink-0">
          <RefreshCw size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">A new version is available</p>
          <p className="text-xs text-slate-400 mt-0.5">Refresh to update EduNexa Analytics.</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => updateServiceWorker(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Refresh Now
            </button>
            <button
              onClick={() => setNeedRefresh(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              Later
            </button>
          </div>
        </div>
        <button
          onClick={() => setNeedRefresh(false)}
          className="text-slate-500 hover:text-white shrink-0"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default PWAUpdatePrompt;
