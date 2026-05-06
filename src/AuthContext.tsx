import React, { useState, useEffect } from 'react';
import { AuthContext } from './useAuth';
import { User } from './types';
import { supabase } from './lib/supabase';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('edunexa_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      localStorage.removeItem('edunexa_user');
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('edunexa_token')
  );

  // ── NEW: loading state so the app waits for session restore ──
  // Without this, components render before the profile is fetched
  // on refresh, causing skeleton loaders to hang indefinitely.
  const [loading, setLoading] = useState(true);

  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('edunexa_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    localStorage.setItem('edunexa_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // ── Profile fetch helper ─────────────────────────────────────
  // FIX: was using .eq('id', ...) — correct column is auth_id
  const fetchAndSetProfile = async (authUserId: string, accessToken: string) => {
    setToken(accessToken);
    localStorage.setItem('edunexa_token', accessToken);

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authUserId)   // ← FIXED: was .eq('id', ...)
      .maybeSingle();

    if (profile) {
      setUser(profile as User);
      localStorage.setItem('edunexa_user', JSON.stringify(profile));
    } else {
      // Profile not in users table — keep localStorage user as fallback
      // (covers edge case where user exists in auth but not yet in users table)
      const saved = localStorage.getItem('edunexa_user');
      if (!saved) {
        setToken(null);
        setUser(null);
      }
    }
  };

  useEffect(() => {
    // On mount: restore session from Supabase (handles page refresh)
    const restoreSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await fetchAndSetProfile(session.user.id, session.access_token);
        } else {
          // No active session — clear everything
          setToken(null);
          setUser(null);
          localStorage.removeItem('edunexa_token');
          localStorage.removeItem('edunexa_user');
        }
      } catch (err) {
        console.error('AuthContext: session restore error', err);
      } finally {
        // Always mark loading done so the app renders
        setLoading(false);
      }
    };

    restoreSession();

    // Listen for auth state changes (token refresh, sign in/out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'TOKEN_REFRESHED' && session) {
          setToken(session.access_token);
          localStorage.setItem('edunexa_token', session.access_token);
        }

        if (event === 'SIGNED_IN' && session) {
          await fetchAndSetProfile(session.user.id, session.access_token);
          setLoading(false);
        }

        if (event === 'SIGNED_OUT') {
          setToken(null);
          setUser(null);
          localStorage.removeItem('edunexa_token');
          localStorage.removeItem('edunexa_user');
          document.documentElement.classList.remove('dark');
          setThemeState('light');
          localStorage.setItem('edunexa_theme', 'light');
          setLoading(false);
        }
      }
    );

    // Sync across browser tabs
    const handleStorage = () => {
      const savedToken = localStorage.getItem('edunexa_token');
      const savedUser  = localStorage.getItem('edunexa_user');
      const savedTheme = localStorage.getItem('edunexa_theme') as 'light' | 'dark';
      setToken(savedToken);
      try {
        setUser(savedUser ? JSON.parse(savedUser) : null);
      } catch {
        setUser(null);
      }
      if (savedTheme) setThemeState(savedTheme);
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('edunexa_token', newToken);
    localStorage.setItem('edunexa_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('edunexa_token');
    localStorage.removeItem('edunexa_user');
    localStorage.removeItem('sb-zclwokyzsqzitqwmugtt-auth-token');
    document.documentElement.classList.remove('dark');
    setThemeState('light');
    localStorage.setItem('edunexa_theme', 'light');
    supabase.auth.signOut().catch(() => {});
    window.location.replace('/login');
  };

  // ── Block render until session is restored ───────────────────
  // This prevents the skeleton flash on refresh.
  // Shows a minimal spinner while Supabase restores the session.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white font-black text-xl">E</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="animate-spin w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span className="text-slate-400 text-sm font-medium">Loading EduNexa…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        theme,
        login,
        logout,
        setTheme,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
