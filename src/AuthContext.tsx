import React, { useState, useEffect } from 'react';
import { User } from './types';
import { AuthContext } from './useAuth';
import { supabase } from './lib/supabase';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('edunexa_user');
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      console.error("AuthContext: Failed to parse saved user from localStorage", e);
      localStorage.removeItem('edunexa_user');
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('edunexa_token'));
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('edunexa_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light';
  });

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    localStorage.setItem('edunexa_theme', newTheme);
    
    // Only apply dark class if authenticated and theme is dark
    if (token && newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    const fetchLatestProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // If we have a real Supabase session, keep it in sync
      if (session?.user) {
        setToken(session.access_token);
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profile) {
          setUser(profile);
          localStorage.setItem('edunexa_user', JSON.stringify(profile));
          localStorage.setItem('edunexa_token', session.access_token);
        }
      } else if (token?.startsWith('DB_SESSION_') && user) {
        // If we are using a table-based session, we don't need to do anything here
        // as the state is already initialized from localStorage
        console.log("AuthContext: Using active table-based session for", user.email);
      }
    };
    
    fetchLatestProfile();

    const handleStorage = () => {
      const savedToken = localStorage.getItem('edunexa_token');
      const savedUser = localStorage.getItem('edunexa_user');
      const savedTheme = localStorage.getItem('edunexa_theme') as 'light' | 'dark';
      setToken(savedToken);
      try {
        setUser(savedUser ? JSON.parse(savedUser) : null);
      } catch (e) {
        console.error("AuthContext: Failed to parse storage user event", e);
        setUser(null);
      }
      if (savedTheme) setThemeState(savedTheme);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useEffect(() => {
    // Re-apply theme logic whenever token or theme state changes
    // This ensures that when the user logs out or theme switches, it's globally reflected
    if (token && theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [token, theme]);

  return (
    <AuthContext.Provider value={{ user, token, theme, login, logout, setTheme, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};
