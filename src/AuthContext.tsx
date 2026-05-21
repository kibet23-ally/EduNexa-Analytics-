import React, {
  createContext, useContext, useEffect, useRef,
  useState, useCallback,
} from 'react';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { AuthContext } from './useAuth';
import type { AuthContextType } from './useAuth';
import type { User } from './types';

/* ─────────────────────────────────────────────────────────────
   STORAGE KEY CONSTANTS
   Must match the storageKey set in supabase.ts prefix + '-token-...'
   We only manage our own app-level keys here.
──────────────────────────────────────────────────────────────  */
const THEME_KEY        = 'edunexa_theme';
const USER_PROFILE_KEY = 'edunexa_user_profile';

/* ─────────────────────────────────────────────────────────────
   SAFE STORAGE HELPERS
   Corrupted JSON in localStorage causes a hard parse error that
   leaves the app permanently stuck. These helpers swallow bad data
   and wipe it so the next write starts clean.
──────────────────────────────────────────────────────────────  */
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Quota exceeded or private-mode restriction — fail silently
  }
}

function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Fail silently
  }
}

function safeParseCachedUser(): User | null {
  const raw = safeGetItem(USER_PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    // Malformed JSON — wipe it so it doesn't block future logins
    safeRemoveItem(USER_PROFILE_KEY);
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   PURGE ALL AUTH STORAGE
   Called on logout AND on detected corruption. Removes every key
   that could contain stale session or profile data.
──────────────────────────────────────────────────────────────  */
function purgeAuthStorage(): void {
  // Remove our app-level profile cache
  safeRemoveItem(USER_PROFILE_KEY);

  // Remove every localStorage key that belongs to Supabase
  // (they are prefixed with the storageKey we set: 'edunexa_supabase_auth')
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('edunexa_supabase_auth') || k.startsWith('sb-'))
      .forEach(k => safeRemoveItem(k));
  } catch {
    // localStorage.keys() can throw in some environments
  }

  // Also clear sessionStorage Supabase keys
  try {
    Object.keys(sessionStorage)
      .filter(k => k.startsWith('edunexa_supabase_auth') || k.startsWith('sb-'))
      .forEach(k => { try { sessionStorage.removeItem(k); } catch { /* noop */ } });
  } catch {
    // sessionStorage unavailable
  }
}

/* ─────────────────────────────────────────────────────────────
   FETCH USER PROFILE
   Looks up the `users` table by Supabase auth UID.
   Returns null (does NOT throw) on any error so callers can
   fall through to the unauthenticated state cleanly.
──────────────────────────────────────────────────────────────  */
async function fetchUserProfile(authUid: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, school_id, status, avatar_url')
      .eq('auth_id', authUid)
      .single();

    if (error || !data) return null;

    // Validate minimum required fields before trusting the row
    if (!data.role) return null;

    return data as User;
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   AUTH PROVIDER
──────────────────────────────────────────────────────────────  */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [user,         setUser]         = useState<User | null>(safeParseCachedUser);
  const [token,        setToken]        = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [theme,        setThemeState]   = useState<'light' | 'dark'>(() => {
    const stored = safeGetItem(THEME_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  });

  // Guard against running the profile fetch concurrently on rapid
  // INITIAL_SESSION + SIGNED_IN double-fires from onAuthStateChange
  const profileFetchInFlight = useRef(false);
  // Track the auth UID of the last successfully loaded profile so we
  // don't re-fetch when the token silently refreshes (same user, new token)
  const lastLoadedUid = useRef<string | null>(null);

  // ── Theme sync ─────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    safeSetItem(THEME_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((t: 'light' | 'dark') => setThemeState(t), []);

  /* ── Core: resolve a Supabase session into app state ─────────────────────
     This is the single path through which any session event (initial load,
     sign-in, token refresh) updates the app's user/token/sessionReady state.
     It is intentionally idempotent: calling it twice with the same uid is a
     no-op after the first call.
  ──────────────────────────────────────────────────────────────────────────── */
  const resolveSession = useCallback(async (
    session: Session | null
  ): Promise<void> => {
    // ── Case 1: No session — user is signed out ──
    if (!session) {
      setUser(null);
      setToken(null);
      safeRemoveItem(USER_PROFILE_KEY);
      lastLoadedUid.current = null;
      setSessionReady(true);   // ready = true even when logged out; means "we know the answer"
      return;
    }

    // ── Case 2: Same user, token just refreshed — update token only ──
    if (session.user.id === lastLoadedUid.current) {
      setToken(session.access_token);
      setSessionReady(true);
      return;
    }

    // ── Case 3: New user session — fetch full profile ──
    if (profileFetchInFlight.current) return;   // already in flight from a double-fire
    profileFetchInFlight.current = true;

    try {
      setToken(session.access_token);

      const profile = await fetchUserProfile(session.user.id);

      if (!profile) {
        // Session exists in Supabase but no matching row in `users`.
        // Could be a newly created auth user with no profile yet, or a
        // corrupted state. Wipe auth storage so next load starts fresh.
        console.warn('[EduNexa] Auth session found but no user profile — clearing session.');
        purgeAuthStorage();
        await supabase.auth.signOut();
        setUser(null);
        setToken(null);
        lastLoadedUid.current = null;
        return;
      }

      // Cache profile so the next hard-refresh shows the user instantly
      // while the async getSession() call completes in the background
      safeSetItem(USER_PROFILE_KEY, JSON.stringify(profile));
      lastLoadedUid.current = session.user.id;
      setUser(profile);
    } finally {
      profileFetchInFlight.current = false;
      setSessionReady(true);
    }
  }, []);

  /* ── onAuthStateChange listener ──────────────────────────────────────────
     Registered ONCE. The cleanup function returned from useEffect ensures
     the subscription is torn down if AuthProvider ever unmounts (e.g. HMR),
     preventing duplicate listeners across hot reloads.
  ──────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;

    // ── Step 1: Eagerly get the current session on mount ──────────────────
    // getSession() reads from storage synchronously (fast path) and validates
    // the token. We do this before the listener fires to avoid a flash of the
    // unauthenticated state on hard refresh.
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (cancelled) return;

        if (error) {
          // Supabase returned an error trying to load/refresh the session.
          // Treat this as corruption: wipe everything and start clean.
          console.warn('[EduNexa] getSession error — purging auth storage:', error.message);
          purgeAuthStorage();
          setUser(null);
          setToken(null);
          setSessionReady(true);
          return;
        }

        await resolveSession(data.session);
      } catch (err) {
        if (cancelled) return;
        console.error('[EduNexa] Unexpected error in getSession:', err);
        purgeAuthStorage();
        setUser(null);
        setToken(null);
        setSessionReady(true);
      }
    })();

    // ── Step 2: Subscribe to ongoing auth events ──────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (cancelled) return;

        // TOKEN_REFRESHED — same user, just update the token, skip profile re-fetch
        if (event === 'TOKEN_REFRESHED' && session) {
          setToken(session.access_token);
          return;
        }

        // SIGNED_OUT — clear everything
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setToken(null);
          safeRemoveItem(USER_PROFILE_KEY);
          lastLoadedUid.current = null;
          setSessionReady(true);
          return;
        }

        // SIGNED_IN / INITIAL_SESSION / USER_UPDATED / PASSWORD_RECOVERY
        await resolveSession(session);
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [resolveSession]);

  /* ── login() ─────────────────────────────────────────────────────────────
     Called by the Login page immediately after supabase.auth.signInWithPassword
     succeeds. We trust the session from Supabase directly rather than
     accepting an externally provided token, which prevents token injection.
  ──────────────────────────────────────────────────────────────────────────── */
  const login = useCallback(async (_token: string, userProfile: User) => {
    // The onAuthStateChange SIGNED_IN event will fire and call resolveSession,
    // which handles the full profile fetch. However, the Login page already has
    // the profile from its own fetch, so we can set it directly here for an
    // instant UI response without waiting for the listener.
    safeSetItem(USER_PROFILE_KEY, JSON.stringify(userProfile));
    setUser(userProfile);
    // token is set by resolveSession via onAuthStateChange — no manual override needed
  }, []);

  /* ── logout() ────────────────────────────────────────────────────────────
     Fully clears the Supabase session, all auth keys in localStorage /
     sessionStorage, and the in-memory React state atomically.
  ──────────────────────────────────────────────────────────────────────────── */
  const logout = useCallback(async () => {
    // 1. Tell Supabase to invalidate the session server-side
    try {
      await supabase.auth.signOut();
    } catch (err) {
      // Even if signOut fails (e.g. network down), we still clear local state
      console.warn('[EduNexa] signOut error (clearing local state anyway):', err);
    }

    // 2. Wipe every piece of auth state from storage
    purgeAuthStorage();

    // 3. Reset React state
    setUser(null);
    setToken(null);
    lastLoadedUid.current = null;
    // sessionReady stays true — we know the answer (logged out)
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