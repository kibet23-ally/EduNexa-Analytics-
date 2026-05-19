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
    const saved =
      localStorage.getItem('edunexa_user');

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
  const [user, setUser] =
    useState<User | null>(
      loadUserFromStorage
    );

  const [token, setToken] =
    useState<string | null>(() =>
      localStorage.getItem(
        'edunexa_token'
      )
    );

  const [sessionReady, setSessionReady] =
    useState(false);

  const [theme, setThemeState] =
    useState<'light' | 'dark'>(() => {
      const saved =
        localStorage.getItem(
          'edunexa_theme'
        );

      return saved === 'dark'
        ? 'dark'
        : 'light';
    });

  // =============================
  // THEME
  // =============================

  const setTheme = (
    newTheme: 'light' | 'dark'
  ) => {
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

  // =============================
  // RESTORE SESSION
  // =============================

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        // =============================
        // NO SESSION
        // =============================

        if (!session?.user) {
          setUser(null);
          setToken(null);

          localStorage.removeItem(
            'edunexa_user'
          );

          localStorage.removeItem(
            'edunexa_token'
          );

          setSessionReady(true);

          return;
        }

        // =============================
        // SESSION EXISTS
        // =============================

        setToken(session.access_token);

        localStorage.setItem(
          'edunexa_token',
          session.access_token
        );

        // IMPORTANT FIX
        // USING id INSTEAD OF auth_id
        const { data: profile, error } =
          await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

        if (!mounted) return;

        if (error) {
          console.error(
            'Profile fetch error:',
            error
          );

          setSessionReady(true);

          return;
        }

        if (profile) {
          const normalized =
            normalizeUser(
              profile as User
            );

          setUser(normalized);

          localStorage.setItem(
            'edunexa_user',
            JSON.stringify(normalized)
          );
        }

        setSessionReady(true);
      } catch (err) {
        console.error(
          'Restore session failed:',
          err
        );

        setUser(null);
        setToken(null);

        localStorage.removeItem(
          'edunexa_user'
        );

        localStorage.removeItem(
          'edunexa_token'
        );

        setSessionReady(true);
      }
    };

    restoreSession();

    // =============================
    // AUTH LISTENER
    // =============================

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log(
          'AUTH EVENT:',
          event
        );

        // PASSWORD RESET
        if (
          event ===
          'PASSWORD_RECOVERY'
        ) {
          window.location.href =
            '/reset-password';

          return;
        }

        // =============================
        // SIGNED IN
        // =============================

        if (
          (event === 'SIGNED_IN' ||
            event ===
              'TOKEN_REFRESHED') &&
          session
        ) {
          setToken(
            session.access_token
          );

          localStorage.setItem(
            'edunexa_token',
            session.access_token
          );

          const { data: profile } =
            await supabase
              .from('users')
              .select('*')
              .eq(
                'id',
                session.user.id
              )
              .maybeSingle();

          if (
            profile &&
            mounted
          ) {
            const normalized =
              normalizeUser(
                profile as User
              );

            setUser(normalized);

            localStorage.setItem(
              'edunexa_user',
              JSON.stringify(
                normalized
              )
            );
          }

          setSessionReady(true);
        }

        // =============================
        // SIGNED OUT
        // =============================

        if (
          event === 'SIGNED_OUT'
        ) {
          setUser(null);
          setToken(null);

          localStorage.removeItem(
            'edunexa_user'
          );

          localStorage.removeItem(
            'edunexa_token'
          );

          setSessionReady(true);
        }
      }
    );

    // =============================
    // STORAGE SYNC
    // =============================

    const handleStorage = () => {
      setToken(
        localStorage.getItem(
          'edunexa_token'
        )
      );

      setUser(
        loadUserFromStorage()
      );

      const savedTheme =
        localStorage.getItem(
          'edunexa_theme'
        ) as 'light' | 'dark';

      if (savedTheme) {
        setThemeState(
          savedTheme
        );
      }
    };

    window.addEventListener(
      'storage',
      handleStorage
    );

    return () => {
      mounted = false;

      subscription.unsubscribe();

      window.removeEventListener(
        'storage',
        handleStorage
      );
    };
  }, []);

  // =============================
  // LOGIN
  // =============================

  const login = (
    newToken: string,
    newUser: User
  ) => {
    const normalized =
      normalizeUser(newUser)!;

    setToken(newToken);

    setUser(normalized);

    setSessionReady(true);

    localStorage.setItem(
      'edunexa_token',
      newToken
    );

    localStorage.setItem(
      'edunexa_user',
      JSON.stringify(normalized)
    );
  };

  // =============================
  // LOGOUT
  // =============================

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error(err);
    }

    setUser(null);
    setToken(null);

    localStorage.removeItem(
      'edunexa_user'
    );

    localStorage.removeItem(
      'edunexa_token'
    );

    window.location.href =
      '/login';
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
        isAuthenticated:
          !!token && !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};