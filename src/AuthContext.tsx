import React, { useState, useEffect } from 'react';
import { AuthContext } from './useAuth';
import { supabase } from './lib/supabase';

// User type matching your database
interface User {
  id: string;
  name?: string;
  email: string;
  role: string;
  school_id?: number | null;
  school_name?: string;
  avatar_url?: string;
  theme_preference?: string;
  notifications_enabled?: boolean;
  [key: string]: unknown;
}

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

  // Apply theme on mount
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    // Fetch latest profile from Supabase session
    const fetchLatestProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          setToken(session.access_token);
          localStorage.setItem('edunexa_token', session.access_token);

          // Fetch user profile from users table
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile) {
            setUser(profile);
            localStorage.setItem('edunexa_user', JSON.stringify(profile));
          } else {
            // Fallback: use auth metadata if no users record
            const fallbackUser: User = {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || '',
              role: session.user.user_metadata?.role || 'school_admin',
              school_id: session.user.user_metadata?.school_id || null,
            };
            setUser(fallbackUser);
            localStorage.setItem('edunexa_user', JSON.stringify(fallbackUser));
          }
        } else {
          // No active session — clear state
          setToken(null);
          setUser(null);
          localStorage.removeItem('edunexa_token');
          localStorage.removeItem('edunexa_user');
        }
      } catch (err) {
        console.error('AuthContext: fetchLatestProfile error', err);
      }
    };

    fetchLatestProfile();

    // Listen for auth state changes (token refresh, sign out, etc.)
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
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile) {
            setUser(profile);
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

    // Listen for storage changes (multi-tab support)
    const handleStorage = () => {
      const savedToken = localStorage.getItem('edunexa_token');
      const savedUser = localStorage.getItem('edunexa_user');
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

  const logout = async () => {
    await supabase.auth.signOut();
    setToken(null);
    setUser(null);
    localStorage.removeItem('edunexa_token');
    localStorage.removeItem('edunexa_user');
    document.documentElement.classList.remove('dark');
    setThemeState('light');
    localStorage.setItem('edunexa_theme', 'light');
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
