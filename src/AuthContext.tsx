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

  // Apply theme on mount and when it changes
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const fetchLatestProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          setToken(session.access_token);
          localStorage.setItem('edunexa_token', session.access_token);

          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile) {
            setUser(profile as User);
            localStorage.setItem('edunexa_user', JSON.stringify(profile));
          } else {
            // Fallback to auth metadata
            const fallbackUser = {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || '',
              role: session.user.user_metadata?.role || 'school_admin',
              school_id: session.user.user_metadata?.school_id || null,
              password: '',
            } as unknown as User;
            setUser(fallbackUser);
            localStorage.setItem('edunexa_user', JSON.stringify(fallbackUser));
          }
        } else {
          // No active session — clear everything
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
            .eq('id', session.user.id)
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

    // Multi-tab sync
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
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('edunexa_token');
      localStorage.removeItem('edunexa_user');
      document.documentElement.classList.remove('dark');
      setThemeState('light');
      localStorage.setItem('edunexa_theme', 'light');
      window.location.href = '/login';
    }
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
