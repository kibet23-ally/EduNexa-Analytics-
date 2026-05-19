import React, { useState, useEffect } from 'react';
import { AuthContext } from './useAuth';
import { User } from './types';
import { supabase } from './lib/supabase';

function normalizeUser(raw: User | null): User | null {
  if (!raw) return null;

  return {
    ...raw,
    school_id:
      raw.school_id != null
        ? Number(raw.school_id)
        : raw.school_id,
  };
}

function loadUserFromStorage(): User | null {
  try {
    const saved = localStorage.getItem('edunexa_user');

    return saved
      ? normalizeUser(JSON.parse(saved))
      : null;
  } catch {
    localStorage.removeItem('edunexa_user');
    return null;
  }
}

export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(
    loadUserFromStorage
  );

  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('edunexa_token')
  );

  // IMPORTANT:
  // sessionReady should ONLY mean:
  // "Supabase auth check finished"
  const [sessionReady, setSessionReady] =
    useState(false);

  const [theme, setThemeState] = useState<
    'light' | 'dark'
  >(() => {
    const saved =
      localStorage.getItem('edunexa_theme');

    return saved === 'dark' ? 'dark' : 'light';
  });

  // =========================================
  // THEME
  // =========================================

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);

    localStorage.setItem(
      'edunexa_theme',
      newTheme
    );

    document.documentElement.classList.toggle(
      'dark',
      newTheme === 'dark'
    );
  };

  useEffect(() => {
    document.documentElement.classList.toggle(
      'dark',
      theme === 'dark'
    );
  }, [theme]);

  // =========================================
  // AUTH
  // =========================================

  useEffect(() => {
    let cancelled = false;

    const clearAuthStorage = () => {
      localStorage.removeItem('edunexa_token');
      localStorage.removeItem('edunexa_user');
      localStorage.removeItem(
        'sb-zclwokyzsqzitqwmugtt-auth-token'
      );
    };

    const restoreSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (cancelled) return;

        // =========================================
        // INVALID SESSION
        // =========================================

        if (error) {
          console.error(
            'Supabase session error:',
            error
          );

          await supabase.auth.signOut();

          clearAuthStorage();

          setUser(null);
          setToken(null);

          return;
        }

        // =========================================
        // ACTIVE SESSION
        // =========================================

        if (session?.user) {
          setToken(session.access_token);

          localStorage.setItem(
            'edunexa_token',
            session.access_token
          );

          const { data: profile, error: profileError } =
            await supabase
              .from('users')
              .select('*')
              .eq('auth_id', session.user.id)
              .maybeSingle();

          if (cancelled) return;

          if (profileError) {
            console.error(
              'Profile fetch error:',
              profileError
            );
          }

          if (profile) {
            const normalized = normalizeUser(
              profile as User
            )!;

            setUser(normalized);

            localStorage.setItem(
              'edunexa_user',
              JSON.stringify(normalized)
            );
          } else {
            // No matching profile
            setUser(null);
          }
        }

        // =========================================
        // NO SESSION
        // =========================================

        else {
          setToken(null);
          setUser(null);

          clearAuthStorage();
        }
      } catch (err) {
        console.error(
          'Auth restore fatal error:',
          err
        );

        await supabase.auth.signOut();

        clearAuthStorage();

        setToken(null);
        setUser(null);
      } finally {
        // =========================================
        // CRITICAL FIX
        // NEVER leave sessionReady false forever
        // =========================================

        if (!cancelled) {
          setSessionReady(true);
        }
      }
    };

    restoreSession();

    // =========================================
    // AUTH STATE LISTENER
    // =========================================

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;

        console.log(
          'Auth state changed:',
          event
        );

        // =========================================
        // PASSWORD RESET
        // =========================================

        if (event === 'PASSWORD_RECOVERY') {
          window.location.href =
            '/reset-password';

          return;
        }

        // =========================================
        // SIGNED IN / TOKEN REFRESH
        // =========================================

        if (
          (event === 'SIGNED_IN' ||
            event === 'TOKEN_REFRESHED') &&
          session
        ) {
          setToken(session.access_token);

          localStorage.setItem(
            'edunexa_token',
            session.access_token
          );

          const { data: profile, error } =
            await supabase
              .from('users')
              .select('*')
              .eq('auth_id', session.user.id)
              .maybeSingle();

          if (error) {
            console.error(
              'Profile fetch error:',
              error
            );
          }

          if (profile && !cancelled) {
            const normalized = normalizeUser(
              profile as User
            )!;

            setUser(normalized);

            localStorage.setItem(
              'edunexa_user',
              JSON.stringify(normalized)
            );
          }

          // IMPORTANT
          setSessionReady(true);
        }

        // =========================================
        // SIGNED OUT
        // =========================================

        if (event === 'SIGNED_OUT') {
          setToken(null);
          setUser(null);

          clearAuthStorage();

          document.documentElement.classList.remove(
            'dark'
          );

          setThemeState('light');

          localStorage.setItem(
            'edunexa_theme',
            'light'
          );

          // =========================================
          // CRITICAL FIX
          // DO NOT SET FALSE
          // =========================================

          setSessionReady(true);

          window.location.replace('/login');
        }
      }
    );

    // =========================================
    // STORAGE SYNC
    // =========================================

    const handleStorage = () => {
      setToken(
        localStorage.getItem('edunexa_token')
      );

      setUser(loadUserFromStorage());

      const t = localStorage.getItem(
        'edunexa_theme'
      ) as 'light' | 'dark';

      if (t) {
        setThemeState(t);
      }
    };

    window.addEventListener(
      'storage',
      handleStorage
    );

    return () => {
      cancelled = true;

      subscription.unsubscribe();

      window.removeEventListener(
        'storage',
        handleStorage
      );
    };
  }, []);

  // =========================================
  // LOGIN
  // =========================================

  const login = (
    newToken: string,
    newUser: User
  ) => {
    const normalized =
      normalizeUser(newUser)!;

    setToken(newToken);
    setUser(normalized);

    localStorage.setItem(
      'edunexa_token',
      newToken
    );

    localStorage.setItem(
      'edunexa_user',
      JSON.stringify(normalized)
    );

    setSessionReady(true);
  };

  // =========================================
  // LOGOUT
  // =========================================

  const logout = async () => {
    setToken(null);
    setUser(null);

    localStorage.removeItem('edunexa_token');
    localStorage.removeItem('edunexa_user');
    localStorage.removeItem(
      'sb-zclwokyzsqzitqwmugtt-auth-token'
    );

    document.documentElement.classList.remove(
      'dark'
    );

    setThemeState('light');

    localStorage.setItem(
      'edunexa_theme',
      'light'
    );

    // IMPORTANT FIX
    setSessionReady(true);

    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error(err);
    }

    window.location.replace('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        theme,
        sessionReady,
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