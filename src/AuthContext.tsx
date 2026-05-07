import React, { useState, useEffect } from 'react';
import { AuthContext } from './useAuth';
import { User } from './types';
import { supabase } from './lib/supabase';

/** Always parse school_id as a number so bigint RLS comparisons work */
function normalizeUser(raw: User | null): User | null {
  if (!raw) return null;
  return {
    ...raw,
    school_id: raw.school_id !== undefined && raw.school_id !== null
      ? Number(raw.school_id)
      : raw.school_id,
  };
}

function loadUserFromStorage(): User | null {
  try {
    const saved = localStorage.getItem('edunexa_user');
    return saved ? normalizeUser(JSON.parse(saved)) : null;
  } catch {
    localStorage.removeItem('edunexa_user');
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user,  setUser]  = useState<User | null>(loadUserFromStorage);
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('edunexa_token')
  );
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('edunexa_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    localStorage.setItem('edunexa_theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        if (session?.user) {
          setToken(session.access_token);
          localStorage.setItem('edunexa_token', session.access_token);

          // FIX: use auth_id not id
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('auth_id', session.user.id)
            .maybeSingle();

          if (cancelled) return;

          if (profile) {
            const normalized = normalizeUser(profile as User)!;
            setUser(normalized);
            localStorage.setItem('edunexa_user', JSON.stringify(normalized));
          }
          // No profile → keep cached user, don't lock them out
        } else {
          // No session — clear state
          setToken(null);
          setUser(null);
          localStorage.removeItem('edunexa_token');
          localStorage.removeItem('edunexa_user');
        }
      } catch (err) {
        console.error('AuthContext restore error:', err);
        // Keep cached data on error — don't lock the user out
      }
    };

    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;

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

          if (profile && !cancelled) {
            const normalized = normalizeUser(profile as User)!;
            setUser(normalized);
            localStorage.setItem('edunexa_user', JSON.stringify(normalized));
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

    // Sync across tabs
    const handleStorage = () => {
      setToken(localStorage.getItem('edunexa_token'));
      setUser(loadUserFromStorage());
      const t = localStorage.getItem('edunexa_theme') as 'light' | 'dark';
      if (t) setThemeState(t);
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const login = (newToken: string, newUser: User) => {
    const normalized = normalizeUser(newUser)!;
    setToken(newToken);
    setUser(normalized);
    localStorage.setItem('edunexa_token', newToken);
    localStorage.setItem('edunexa_user', JSON.stringify(normalized));
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
