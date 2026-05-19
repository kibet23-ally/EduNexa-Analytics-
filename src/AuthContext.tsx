import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './lib/supabase'; // ✅ FIXED PATH (IMPORTANT)

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  school_id: number | null;
}

interface AuthContextType {
  user: User | null;
  sessionReady: boolean;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  sessionReady: false,
  loading: true,
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [loading, setLoading] = useState(true);

  /**
   * Normalize user object (VERY IMPORTANT)
   */
  const normalizeUser = (profile: any): User => {
    return {
      id: profile?.id || '',
      name: profile?.name || '',
      email: profile?.email || '',
      role: (profile?.role || '').toLowerCase(),
      school_id: profile?.school_id ? Number(profile.school_id) : null,
    };
  };

  /**
   * Fetch user profile from DB
   */
  const fetchProfile = async (authUser: any) => {
    if (!authUser?.id) return null;

    const { data, error } = await supabase
      .from('users') // change to 'profiles' if that's your table
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (error || !data) {
      console.error('Profile fetch error:', error?.message);
      return null;
    }

    return normalizeUser(data);
  };

  /**
   * INIT AUTH
   */
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        if (mounted) {
          setUser(null);
          setSessionReady(true);
          setLoading(false);
        }
        return;
      }

      const profile = await fetchProfile(session.user);

      if (mounted) {
        setUser(profile);
        setSessionReady(true);
        setLoading(false);
      }
    };

    init();

    /**
     * LISTENER (IMPORTANT FOR LIVE SESSION UPDATES)
     */
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session?.user) {
          setUser(null);
          setSessionReady(true);
          return;
        }

        const profile = await fetchProfile(session.user);
        setUser(profile);
        setSessionReady(true);
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  /**
   * LOGOUT (FULL RESET FIX)
   */
  const logout = async () => {
    setLoading(true);

    await supabase.auth.signOut();

    setUser(null);
    setSessionReady(false);
    setLoading(false);

    // optional cleanup for cached data systems
    // queryClient?.clear?.();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionReady,
        loading,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);