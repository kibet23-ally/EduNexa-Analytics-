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

  // If we already have a token in localStorage, start as NOT loading
  // so returning users never see the spinner. Only show spinner when
  // there is no cached session at all.
  const [loading, setLoading] = useState<boolean>(
    () => !localStorage.getItem('edunexa_token')
  );

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

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      // Safety net: no matter what happens, loading ends in 3 seconds
      const safetyTimer = setTimeout(() => {
        if (!cancelled) setLoading(false);
      }, 3000);

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (cancelled) return;

        if (session?.user) {
          // Update token
          setToken(session.access_token);
          localStorage.setItem('edunexa_token', session.access_token);

          // Fetch fresh profile using correct auth_id column
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('auth_id', session.user.id)
            .maybeSingle();

          if (cancelled) return;

          if (profile) {
            setUser(profile as User);
            localStorage.setItem('edunexa_user', JSON.stringify(profile));
          }
          // If profile is null, keep whatever is in localStorage
        } else {
          // No Supabase session — clear everything
          setToken(null);
          setUser(null);
          localStorage.removeItem('edunexa_token');
          localStorage.removeItem('edunexa_user');
        }
      } catch (err) {
        console.error('AuthContext restore error:', err);
        // On any error, keep localStorage values — don't lock user out
      } finally {
        clearTimeout(safetyTimer);
        if (!cancelled) setLoading(false);
      }
    };

    restoreSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'TOKEN_REFRESHED' && session) {
          setToken(session.access_token);
          localStorage.setItem('edunexa_token', session.access_token);
        }

        if (event === 'SIGNED_IN' && session) {
          setToken(session.access_token);
          localStorage.setItem('edunexa_token', session.access_token);

          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('auth_id', session.user.id)
            .maybeSingle();

          if (profile) {
            setUser(profile as User);
            localStorage.setItem('edunexa_user', JSON.stringify(profile));
          }
        }

        if (event === 'SIGNED_OUT') {
          setToken(null);
          setUser(null);
          localStorage.removeItem('edunexa_token');
          localStorage.removeItem('edunexa_user');
          document.documentElement.classList.remove('dark');
          setThemeState('light');
          localStorage.setItem('edunexa_theme', 'light');
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
      cancelled = true;
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

  // Only show spinner if loading AND no cached user
  // This means first-time visitors see a brief spinner
  // but returning users go straight to their dashboard
  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-blue-700 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white font-black text-xl">E</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="animate-spin w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24">
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
