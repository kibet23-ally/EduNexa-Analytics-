import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase'; // ✅ FIXED PATH

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

  const normalizeUser = (profile: any): User => ({
    id: profile?.id || '',
    name: profile?.name || '',
    email: profile?.email || '',
    role: (profile?.role || '').toLowerCase(),
    school_id: profile?.school_id ? Number(profile.school_id) : null,
  });

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
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

        const { data } = await supabase
          .from('users') // ⚠️ CHANGE THIS IF YOUR TABLE IS DIFFERENT
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (mounted) {
          setUser(data ? normalizeUser(data) : null);
          setSessionReady(true);
          setLoading(false);
        }

      } catch (err) {
        console.error('Auth crash:', err);

        if (mounted) {
          setUser(null);
          setSessionReady(true);
          setLoading(false);
        }
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          if (!session?.user) {
            setUser(null);
            setSessionReady(true);
            return;
          }

          const { data } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          setUser(data ? normalizeUser(data) : null);
          setSessionReady(true);

        } catch (err) {
          console.error('Auth listener error:', err);
          setUser(null);
          setSessionReady(true);
        }
      }
    );

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.(); // ✅ SAFE
    };
  }, []);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSessionReady(false);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, sessionReady, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);