import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

/* ─── Types ──────────────────────────────────────────────────────────────── */
export interface AppUser {
  id: string;
  email: string;
  role: string;
  school_id: number | null;
  name: string;
  auth_id?: string;
}

export interface AuthContextValue {
  // Core state
  session:        Session | null;
  user:           AppUser | null;
  isAuthenticated: boolean;
  // Loading flags
  authLoading:    boolean;   // true while restoring / checking session
  sessionReady:   boolean;   // true once initial session check is done
  profileLoading: boolean;   // true while fetching user profile
  // Actions
  signOut:        () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  session:         null,
  user:            null,
  isAuthenticated: false,
  authLoading:     true,
  sessionReady:    false,
  profileLoading:  false,
  signOut:         async () => {},
  refreshProfile:  async () => {},
});

/* ─── Storage purge helper ───────────────────────────────────────────────── */
function purgeStaleAuthKeys() {
  try {
    const keep = 'edunexa-auth';
    Object.keys(localStorage).forEach(k => {
      if (
        k !== keep &&
        (k.startsWith('sb-') || k.includes('supabase') || k.includes('auth'))
      ) {
        localStorage.removeItem(k);
        console.log('[Auth] Removed stale key:', k);
      }
    });
  } catch { /* noop */ }
}

/* ─── Profile fetcher ────────────────────────────────────────────────────── */
async function fetchProfile(userId: string): Promise<AppUser | null> {
  console.log('[Auth] Fetching profile for', userId);
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, role, school_id, name, auth_id')
      .or(`id.eq.${userId},auth_id.eq.${userId}`)
      .maybeSingle();

    if (error) {
      console.error('[Auth] Profile fetch error:', error.message);
      return null;
    }
    if (!data) {
      console.warn('[Auth] No profile row found for', userId);
      return null;
    }
    console.log('[Auth] Profile loaded:', data.email, data.role);
    return data as AppUser;
  } catch (err) {
    console.error('[Auth] Profile fetch exception:', err);
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   AUTH PROVIDER
══════════════════════════════════════════════════════════════════════════ */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const mountedRef    = useRef(true);
  const profileFetching = useRef(false);

  const [session,        setSession]        = useState<Session | null>(null);
  const [user,           setUser]           = useState<AppUser | null>(null);
  const [authLoading,    setAuthLoading]    = useState(true);   // blocks all routes
  const [sessionReady,   setSessionReady]   = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  /* ── Load profile from DB ─────────────────────────────────────────────── */
  const loadProfile = useCallback(async (authUser: User) => {
    if (profileFetching.current) return;
    profileFetching.current = true;
    if (mountedRef.current) setProfileLoading(true);

    // Try to fetch profile — 2 fast attempts max (300ms gap)
    let profile: AppUser | null = null;
    profile = await fetchProfile(authUser.id);
    if (!profile) {
      await new Promise(r => setTimeout(r, 300));
      profile = await fetchProfile(authUser.id);
    }

    if (mountedRef.current) {
      setUser(profile);
      setProfileLoading(false);
    }
    profileFetching.current = false;
  }, []);

  /* ── Handle session change ────────────────────────────────────────────── */
  const handleSession = useCallback(async (newSession: Session | null, event?: string) => {
    console.log(`[Auth] handleSession event=${event} session=${newSession ? 'present' : 'null'}`);

    if (!mountedRef.current) return;
    setSession(newSession);

    if (newSession?.user) {
      await loadProfile(newSession.user);
    } else {
      setUser(null);
    }

    if (mountedRef.current) {
      setAuthLoading(false);
      setSessionReady(true);
    }
  }, [loadProfile]);

  /* ── Bootstrap: restore session on startup ────────────────────────────── */
  useEffect(() => {
    mountedRef.current = true;
    purgeStaleAuthKeys();

    let resolved = false;

    // Safety timeout — never show spinner for more than 2 seconds
    const safetyTimer = setTimeout(() => {
      if (!resolved && mountedRef.current) {
        resolved = true;
        setAuthLoading(false);
        setSessionReady(true);
      }
    }, 2000);

    // Fast path: getSession reads from localStorage — usually <50ms
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(safetyTimer);
      handleSession(s, 'INITIAL_SESSION');
    }).catch(() => {
      if (!resolved && mountedRef.current) {
        resolved = true;
        clearTimeout(safetyTimer);
        setAuthLoading(false);
        setSessionReady(true);
      }
    });

    // Subscribe to ongoing auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        switch (event) {
          case 'INITIAL_SESSION':
            if (!resolved) {
              resolved = true;
              clearTimeout(safetyTimer);
              await handleSession(newSession, event);
            }
            break;
          case 'SIGNED_IN':
            await handleSession(newSession, event);
            break;
          case 'TOKEN_REFRESHED':
            if (mountedRef.current) setSession(newSession);
            break;
          case 'USER_UPDATED':
            if (newSession?.user && mountedRef.current) {
              await loadProfile(newSession.user);
            }
            break;
          case 'SIGNED_OUT':
            if (mountedRef.current) {
              setSession(null);
              setUser(null);
              setAuthLoading(false);
              setSessionReady(true);
              purgeStaleAuthKeys();
            }
            break;
        }
      }
    );

    return () => {
      mountedRef.current = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [handleSession, loadProfile]);

  /* ── Sign out ─────────────────────────────────────────────────────────── */
  const signOut = useCallback(async () => {
    console.log('[Auth] Signing out…');
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[Auth] Sign out error:', err);
      // Force local clear even if API fails
      setSession(null);
      setUser(null);
      purgeStaleAuthKeys();
    }
  }, []);

  /* ── Refresh profile ──────────────────────────────────────────────────── */
  const refreshProfile = useCallback(async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s?.user) await loadProfile(s.user);
  }, [loadProfile]);

  /* ── Memoized context value ───────────────────────────────────────────── */
  const value = useMemo<AuthContextValue>(() => ({
    session,
    user,
    isAuthenticated: !!session && !!user,
    authLoading,
    sessionReady,
    profileLoading,
    signOut,
    refreshProfile,
  }), [session, user, authLoading, sessionReady, profileLoading, signOut, refreshProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
