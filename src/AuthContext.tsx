import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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
   * NORMALIZE USER (VERY IMPORTANT)
   * fixes role + school_id inconsistencies
   */
  const normalizeUser = (profile: any): User => {
    return {
      id: profile?.id,
      name: profile?.name || '',
      email: profile?.email || '',
      role: (profile?.role || '').toLowerCase(), // 🔥 normalize role
      school_id: profile?.school_id ? Number(profile.school_id) : null, // 🔥 normalize school_id
    };
  };

  /**
   * FETCH PROFILE FROM DB
   */
  const fetchProfile = async (authUser: any) => {
    if (!authUser?.id) return null;

    const { data, error } = await supabase
      .from('users') // or 'profiles' depending on your schema
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
   * INIT SESSION
   */
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
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

    initAuth();

    /**
     * LISTEN TO AUTH CHANGES
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
   * LOGOUT (FIXED)
   */
  const logout = async () => {
    setLoading(true);

    await supabase.auth.signOut();

    // 🔥 HARD RESET EVERYTHING
    setUser(null);
    setSessionReady(false);
    setLoading(false);

    // optional: clear cached queries if using react-query
    // queryClient.clear?.();
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