import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState({
    full_name: '',
    avatar_url: '',
    currency: '₱',
  });
  const [loading, setLoading] = useState(true);

  // Fetch profile from database
  const loadProfileFromDB = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        setProfile({
          full_name: data.full_name || '',
          avatar_url: data.avatar_url || '',
          currency: data.currency || '₱',
        });
      }
    } catch (err) {
      console.warn('Could not load profile from DB:', err.message);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          setSession(session);
          // Set fallback name from metadata
          const metadataName = session.user.user_metadata?.full_name || '';
          setProfile(prev => ({ ...prev, full_name: metadataName }));
          await loadProfileFromDB(session.user.id);
        }
      } catch (error) {
        console.error('Error getting session:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setSession(session);

      if (session?.user) {
        const metadataName = session.user.user_metadata?.full_name || '';
        setProfile(prev => ({ ...prev, full_name: metadataName }));
        await loadProfileFromDB(session.user.id);
      } else {
        setProfile({ full_name: '', avatar_url: '', currency: '₱' });
      }
    });

    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  const value = { session, profile, loading };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);