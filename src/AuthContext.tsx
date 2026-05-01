useEffect(() => {
  fetchLatestProfile();

// Auto-refresh session on mobile
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' && session) {
    setToken(session.access_token);
    localStorage.setItem('edunexa_token', session.access_token);
  }
  if (event === 'SIGNED_OUT') {
    setToken(null);
    setUser(null);
    localStorage.removeItem('edunexa_token');
    localStorage.removeItem('edunexa_user');
  }
});

const handleStorage = () => {
    if (session?.user) {
      setToken(session.access_token);
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      if (profile) {
        setUser(profile);
        localStorage.setItem('edunexa_user', JSON.stringify(profile));
        localStorage.setItem('edunexa_token', session.access_token);
      }
    } else {
      // Session expired — clear everything and redirect to login
      setToken(null);
      setUser(null);
      localStorage.removeItem('edunexa_token');
      localStorage.removeItem('edunexa_user');
    }
  };

  fetchLatestProfile();

  // Listen for auth state changes including token refresh
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        setToken(session.access_token);
        localStorage.setItem('edunexa_token', session.access_token);
      }
      if (event === 'SIGNED_OUT') {
        setToken(null);
        setUser(null);
        localStorage.removeItem('edunexa_token');
        localStorage.removeItem('edunexa_user');
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);