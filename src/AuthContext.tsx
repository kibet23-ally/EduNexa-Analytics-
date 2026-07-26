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

    // Retry up to 3 times to handle transient RLS errors
    let profile: AppUser | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      profile = await fetchProfile(authUser.id);
      if (profile) break;
      if (attempt < 3) {
        console.log(`[Auth] Profile retry ${attempt}/3`);
        await new Promise(r => setTimeout(r, 600 * attempt));
      }
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

    console.log('[Auth] Restoring session…');

    // getSession() reads from localStorage — synchronous in practice
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (error) {
        console.error('[Auth] getSession error:', error.message);
      }
      console.log('[Auth] Restored session:', s ? s.user.email : 'none');
      handleSession(s, 'INITIAL_SESSION');
    });

    /* ── Subscribe to all auth state changes ── */
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('[Auth] onAuthStateChange:', event, newSession?.user?.email);

        switch (event) {
          case 'INITIAL_SESSION':
            // Already handled above via getSession — skip to avoid double call
            break;

          case 'SIGNED_IN':
            await handleSession(newSession, event);
            break;

          case 'TOKEN_REFRESHED':
            console.log('[Auth] Token refreshed successfully');
            if (mountedRef.current) setSession(newSession);
            // Profile stays the same — no need to refetch
            break;

          case 'USER_UPDATED':
            console.log('[Auth] User updated');
            if (newSession?.user && mountedRef.current) {
              await loadProfile(newSession.user);
            }
            break;

          case 'SIGNED_OUT':
            console.log('[Auth] Signed out');
            if (mountedRef.current) {
              setSession(null);
              setUser(null);
              setAuthLoading(false);
              setSessionReady(true);
              // Clear stale localStorage keys on logout
purgeStaleAuthKeys();
            }
            break;

          default:
            console.log('[Auth] Unhandled event:', event);
        }
      }
    );

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      console.log('[Auth] Unsubscribed');
    };
  }, [handleSession, loadProfile, queryClient]);

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
  }, [queryClient]);

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
