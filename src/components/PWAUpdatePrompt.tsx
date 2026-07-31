import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

/**
 * Registers the service worker and shows a small branded banner whenever a
 * new deployed version is available, prompting the user to refresh. The
 * service worker itself only ever precaches static build assets (JS/CSS/
 * icons/fonts) - see vite.config.ts - so "new version available" here means
 * exactly that: new app code, never new/stale data.
 */
const PWAUpdatePrompt: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true, // register the SW as soon as the app loads - required
                      // for Chrome's install criteria to be met promptly.
    onRegisteredSW(swUrl, registration) {
      // Poll for a new service worker periodically so long-lived open tabs
      // still get offered the update prompt, not just on next full reload.
      if (registration) {
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000); // hourly is plenty for a dashboard app
      }
    },
  });

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