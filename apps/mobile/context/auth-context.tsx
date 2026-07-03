import type { Session, User } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authRedirectUrl, supabase } from '@/src/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  username: string | null;
  profileLoading: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<boolean>;
  resendConfirmation: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        setSession(data.session);
      })
      .catch((error) => console.warn('Supabase-Session konnte nicht geladen werden.', error))
      .finally(() => setLoading(false));

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const user = session?.user;
    if (!user?.email) {
      setUsername(null);
      return;
    }
    setProfileLoading(true);
    async function loadProfile() {
      try {
        const { data, error } = await supabase.from('profiles')
          .upsert({ user_id: user!.id, email: user!.email! }, { onConflict: 'user_id' })
          .select('username')
          .single();
        if (error) throw error;
        setUsername(data.username);
      } catch (error) {
        console.warn('Profil konnte nicht geladen werden.', error);
      } finally {
        setProfileLoading(false);
      }
    }
    void loadProfile();
  }, [session]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: authRedirectUrl },
    });
    if (error) throw error;
    return data.session == null;
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: authRedirectUrl },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const updateUsername = useCallback(async (value: string) => {
    if (!session?.user) throw new Error('Du musst angemeldet sein.');
    const normalized = value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(normalized)) {
      throw new Error('Der Benutzername braucht 3–24 Zeichen und darf nur Buchstaben, Zahlen und _ enthalten.');
    }
    const { error } = await supabase.from('profiles')
      .update({ username: normalized, updated_at: new Date().toISOString() })
      .eq('user_id', session.user.id);
    if (error?.code === '23505') throw new Error('Dieser Benutzername ist bereits vergeben.');
    if (error) throw error;
    setUsername(normalized);
  }, [session]);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    username,
    profileLoading,
    loading,
    signIn,
    signUp,
    resendConfirmation,
    signOut,
    updateUsername,
  }), [loading, profileLoading, resendConfirmation, session, signIn, signOut, signUp, updateUsername, username]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth muss innerhalb des AuthProviders verwendet werden.');
  return value;
}
