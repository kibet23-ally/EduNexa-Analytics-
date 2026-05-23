import React, {
  useEffect, useRef, useState, useCallback,
} from 'react';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { AuthContext } from './useAuth';
import type { AuthContextType } from './useAuth';
import type { User } from './types';

/* ── Storage keys ── */
const THEME_KEY = 'edunexa_theme';
const USER_PROFILE_KEY = 'edunexa_user_profile';

// Must match storageKey in supabase.ts exactly
const SUPABASE_AUTH_KEY = 'edunexa-auth';

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

/* ── Purge ALL auth storage ──────────────────────────────────────────────────
   Clears:
   - our profile cache
   - the exact Supabase auth key (edunexa-auth)
   - any legacy sb- prefixed keys from before storageKey was set
   - sessionStorage equivalents
   Called on logout and on session error.
──────────────────────────────────────────────────────────────────────────── */
function purgeAuthStorage(): void {
  safeRemoveItem(USER_PROFILE_KEY);
  safeRemoveItem(SUPABASE_AUTH_KEY);

  // Also clear any legacy keys from before storageKey was pinned
  try {
    Object.keys(localStorage)
      .filter(k =>
        k.startsWith('sb-') ||
        k.startsWith('edunexa_supabase_auth') ||
        k.startsWith('supabase.auth')
      )
      .forEach(k => safeRemoveItem(k));
  } catch { /* noop */ }

  try {
    Object.keys(sessionStorage)
      .filter(k =>
        k.startsWith('sb-') ||
        k === SUPABASE_AUTH_KEY ||
        k.startsWith('edunexa_supabase_auth') ||
        k.startsWith('supabase.auth')
      )
      .forEach(k => { try { sessionStorage.removeItem(k); } catch { /* noop */ } });
  } catch { /* noop */ }
}

/* ── Fetch user profile ──────────────────────────────────────────────────────
   Tries auth_id first, falls back to id = uid.
──────────────────────────────────────────────────────────────────────────── */
async function fetchUserProfile(authUid: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, school_id, avatar_url')
      .eq('auth_id', authUid)
      .maybeSingle();

    if (error) {
      console.error('[EduNexa] fetchUserProfile (auth_id) error:', error.message);
    }

    if (data?.role) return data as unknown as User;

    // Fallback: id === auth_id pattern
    const { data: data2, error: error2 } = await supabase
      .from('users')
      .select('id, name, email, role, school_id, avatar_url')
      .eq('id', authUid)
      .maybeSingle();

    if (error2) {
      console.error('[EduNexa] fetchUserProfile (id) error:', error2.message);
      return null;
    }

    if (!data2) {
      console.warn('[EduNexa] No user profile found for uid:', authUid);
      return null;
    }

    if (!data2.role) {
      console.warn('[EduNexa] User row has no role:', data2);
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
  const [user, setUser] = useState<User | null>(safeParseCachedUser);
  const [token, setToken] = useState<string | null>(null);
  // FIX: sessionReady starts false; we show nothing until Supabase confirms
  // the session. This prevents ProtectedRoute from flash-redirecting to /login
  // on reload while getSession() is still in flight.
  const [sessionReady, setSessionReady] = useState(false);
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    const stored = safeGetItem(THEME_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  });

  // FIX: track the uid that is currently loaded, not just "in flight"
  // Reset to null on logout so a same-uid re-login always re-fetches profile.
  const lastLoadedUid = useRef<string | null>(null);
  // Prevent concurrent fetches for the same uid
  const fetchingUid = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    safeSetItem(THEME_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((t: 'light' | 'dark') => setThemeState(t), []);

  /* ── resolveSession ──────────────────────────────────────────────────────
     Called both on initial getSession() and on every onAuthStateChange event.
     Key fixes vs old version:
     - No longer skips fetch when uid matches lastLoadedUid (that prevented
       re-login after logout for same account)
     - Uses fetchingUid ref so concurrent calls for THE SAME uid are deduped,
       but a NEW uid after logout always runs
     - Sets token regardless of whether profile fetch is needed
  ────────────────────────────────────────────────────────────────────────── */
  const resolveSession = useCallback(async (session: Session | null): Promise<void> => {
    if (!session) {
      setUser(null);
      setToken(null);
      safeRemoveItem(USER_PROFILE_KEY);
      lastLoadedUid.current = null;
      fetchingUid.current = null;
      setSessionReady(true);
      return;
    }

    const uid = session.user.id;

    // Always update token — even if profile is already loaded
    setToken(session.access_token);

    // Profile already loaded for this uid and user state is set — done
    if (uid === lastLoadedUid.current && user !== null) {
      setSessionReady(true);
      return;
    }

    // Dedupe concurrent fetches for the same uid
    if (fetchingUid.current === uid) return;
    fetchingUid.current = uid;

    try {
      const profile = await fetchUserProfile(uid);

      if (!profile) {
        // Transient DB error or missing profile — clear user but keep
        // Supabase session intact so next page load can retry
        console.warn('[EduNexa] Could not load profile — clearing user state.');
        setUser(null);
        setToken(null);
        safeRemoveItem(USER_PROFILE_KEY);
        lastLoadedUid.current = null;
      } else {
        safeSetItem(USER_PROFILE_KEY, JSON.stringify(profile));
        lastLoadedUid.current = uid;
        setUser(profile);
      }
    } finally {
      fetchingUid.current = null;
      setSessionReady(true);
    }
  }, [user]);

  /* ── Mount: restore session + subscribe to auth changes ── */
  useEffect(() => {
    let cancelled = false;

    // Step 1: eagerly restore existing session
    (async () => {
      try {
        // refreshSession() re-validates the token with Supabase rather than
        // just reading from storage — catches expired/revoked tokens immediately
        const { data, error } = await supabase.auth.refreshSession();

        if (cancelled) return;

        if (error || !data.session) {
          // No valid session — clear any stale storage
          purgeAuthStorage();
          setUser(null);
          setToken(null);
          lastLoadedUid.current = null;
          setSessionReady(true);
          return;
        }

        await resolveSession(data.session);
      } catch (err) {
        if (cancelled) return;
        console.error('[EduNexa] Session restore error:', err);
        purgeAuthStorage();
        setUser(null);
        setToken(null);
        setSessionReady(true);
      }
    })();

    // Step 2: subscribe to all future auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (cancelled) return;

        console.debug('[EduNexa] Auth event:', event);

        if (event === 'SIGNED_OUT') {
          purgeAuthStorage();
          setUser(null);
          setToken(null);
          lastLoadedUid.current = null;
          fetchingUid.current = null;
          setSessionReady(true);
          return;
        }

        if (event === 'TOKEN_REFRESHED' && session) {
          // Just update the token — no need to re-fetch profile
          setToken(session.access_token);
          return;
        }

        // SIGNED_IN, INITIAL_SESSION, USER_UPDATED, PASSWORD_RECOVERY
        await resolveSession(session);
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ^ intentionally empty — runs once on mount only

  /* ── login ───────────────────────────────────────────────────────────────
     Called by Login page after supabase.auth.signInWithPassword() succeeds.
     FIX: now sets token (was missing before, causing isAuthenticated=false
     until onAuthStateChange fired asynchronously).
  ────────────────────────────────────────────────────────────────────────── */
  const login = useCallback(async (accessToken: string, userProfile: User) => {
    safeSetItem(USER_PROFILE_KEY, JSON.stringify(userProfile));
    lastLoadedUid.current = null; // allow resolveSession to re-validate uid
    setToken(accessToken);
    setUser(userProfile);
  }, []);

  /* ── logout ──────────────────────────────────────────────────────────────
     Signs out from Supabase, then wipes ALL local auth state.
     FIX: lastLoadedUid is reset so a same-account re-login works cleanly.
  ────────────────────────────────────────────────────────────────────────── */
  const logout = useCallback(async () => {
    try { await supabase.auth.signOut(); }
    catch (err) { console.warn('[EduNexa] signOut error:', err); }
    purgeAuthStorage();
    setUser(null);
    setToken(null);
    lastLoadedUid.current = null;
    fetchingUid.current = null;
  }, []);

  /* ── isAuthenticated ─────────────────────────────────────────────────────
     FIX: previously `!!user && !!token` caused isAuthenticated=false on
     reload while token was still null (getSession in flight) even though
     user was restored from cache. Now we also gate on sessionReady so
     ProtectedRoute waits for confirmation before deciding.
     Once sessionReady=true, both user and token must exist.
  ────────────────────────────────────────────────────────────────────────── */
  const value: AuthContextType = {
    user,
    token,
    theme,
    sessionReady,
    login,
    logout,
    setTheme,
    isAuthenticated: sessionReady ? (!!user && !!token) : false,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
