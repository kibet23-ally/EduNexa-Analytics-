import React, {
  useEffect, useRef, useState, useCallback,
} from 'react';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { AuthContext } from './useAuth';
import type { AuthContextType } from './useAuth';
import type { User } from './types';

/* ── Storage keys ── */
const THEME_KEY        = 'edunexa_theme';
const USER_PROFILE_KEY = 'edunexa_user_profile';

/* ── Safe storage helpers ── */
function safeGetItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetItem(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* quota / private mode */ }
}
function safeRemoveItem(key: string): void {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}
function safeParseCachedUser(): User | null {
  const raw = safeGetItem(USER_PROFILE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as User; }
  catch { safeRemoveItem(USER_PROFILE_KEY); return null; }
}

/* ── Purge all auth storage ── */
function purgeAuthStorage(): void {
  safeRemoveItem(USER_PROFILE_KEY);
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('edunexa_supabase_auth') || k.startsWith('sb-'))
      .forEach(k => safeRemoveItem(k));
  } catch { /* noop */ }
  try {
    Object.keys(sessionStorage)
      .filter(k => k.startsWith('edunexa_supabase_auth') || k.startsWith('sb-'))
      .forEach(k => { try { sessionStorage.removeItem(k); } catch { /* noop */ } });
  } catch { /* noop */ }
}

/* ── Fetch user profile ──────────────────────────────────────────────────────
   FIXED: removed `status` (column doesn't exist).
   Tries auth_id first, falls back to id = uid.
   Logs the actual Supabase error so future issues are visible in the console.
──────────────────────────────────────────────────────────────────────────── */
async function fetchUserProfile(authUid: string): Promise<User | null> {
  try {
    // Primary: match on auth_id column
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, school_id, avatar_url')
      .eq('auth_id', authUid)
      .maybeSingle();              // maybeSingle() returns null instead of error when 0 rows

    if (error) {
      console.error('[EduNexa] fetchUserProfile (auth_id) error:', error.message, error.details);
      // Don't return null yet — try the fallback
    }

    if (data) {
      if (!data.role) {
        console.warn('[EduNexa] User row found but role is empty:', data);
        return null;
      }
      return data as unknown as User;
    }

    // Fallback: some rows have id === auth_id, try matching on id directly
    const { data: data2, error: error2 } = await supabase
      .from('users')
      .select('id, name, email, role, school_id, avatar_url')
      .eq('id', authUid)
      .maybeSingle();

    if (error2) {
      console.error('[EduNexa] fetchUserProfile (id) error:', error2.message, error2.details);
      return null;
    }

    if (!data2) {
      console.warn('[EduNexa] No user profile found for uid:', authUid);
      return null;
    }

    if (!data2.role) {
      console.warn('[EduNexa] User row found but role is empty:', data2);
      return null;
    }

    return data2 as unknown as User;
  } catch (err) {
    console.error('[EduNexa] fetchUserProfile unexpected error:', err);
    return null;
  }
}

/* ── Auth Provider ── */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user,         setUser]         = useState<User | null>(safeParseCachedUser);
  const [token,        setToken]        = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [theme,        setThemeState]   = useState<'light' | 'dark'>(() => {
    const stored = safeGetItem(THEME_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  });

  const profileFetchInFlight = useRef(false);
  const lastLoadedUid        = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    safeSetItem(THEME_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((t: 'light' | 'dark') => setThemeState(t), []);

  const resolveSession = useCallback(async (session: Session | null): Promise<void> => {
    // Signed out
    if (!session) {
      setUser(null);
      setToken(null);
      safeRemoveItem(USER_PROFILE_KEY);
      lastLoadedUid.current = null;
      setSessionReady(true);
      return;
    }

    // Same user, token just refreshed
    if (session.user.id === lastLoadedUid.current) {
      setToken(session.access_token);
      setSessionReady(true);
      return;
    }

    // New session — fetch profile
    if (profileFetchInFlight.current) return;
    profileFetchInFlight.current = true;

    try {
      setToken(session.access_token);

      const profile = await fetchUserProfile(session.user.id);

      if (!profile) {
        // Profile missing — DO NOT sign out or wipe session.
        // Just leave sessionReady=true with user=null so the
        // ProtectedRoute redirects to /login cleanly without
        // destroying a potentially valid session on a transient DB error.
        console.warn('[EduNexa] Could not load user profile — redirecting to login.');
        setUser(null);
        setToken(null);
        lastLoadedUid.current = null;
        return;
      }

      safeSetItem(USER_PROFILE_KEY, JSON.stringify(profile));
      lastLoadedUid.current = session.user.id;
      setUser(profile);
    } finally {
      profileFetchInFlight.current = false;
      setSessionReady(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Eagerly restore session on mount
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;

        if (error) {
          console.warn('[EduNexa] getSession error:', error.message);
          purgeAuthStorage();
          setUser(null); setToken(null); setSessionReady(true);
          return;
        }

        await resolveSession(data.session);
      } catch (err) {
        if (cancelled) return;
        console.error('[EduNexa] getSession unexpected error:', err);
        setUser(null); setToken(null); setSessionReady(true);
      }
    })();

    // Auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (cancelled) return;

        if (event === 'TOKEN_REFRESHED' && session) {
          setToken(session.access_token);
          return;
        }
        if (event === 'SIGNED_OUT') {
          setUser(null); setToken(null);
          safeRemoveItem(USER_PROFILE_KEY);
          lastLoadedUid.current = null;
          setSessionReady(true);
          return;
        }

        await resolveSession(session);
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [resolveSession]);

  const login = useCallback(async (_token: string, userProfile: User) => {
    safeSetItem(USER_PROFILE_KEY, JSON.stringify(userProfile));
    setUser(userProfile);
  }, []);

  const logout = useCallback(async () => {
    try { await supabase.auth.signOut(); }
    catch (err) { console.warn('[EduNexa] signOut error:', err); }
    purgeAuthStorage();
    setUser(null);
    setToken(null);
    lastLoadedUid.current = null;
  }, []);

  const value: AuthContextType = {
    user,
    token,
    theme,
    sessionReady,
    login,
    logout,
    setTheme,
    isAuthenticated: !!user && !!token,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};