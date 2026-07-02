import type { Session, User } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authRedirectUrl, supabase } from '@/src/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<boolean>;
  resendConfirmation: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    loading,
    signIn,
    signUp,
    resendConfirmation,
    signOut,
  }), [loading, resendConfirmation, session, signIn, signOut, signUp]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth muss innerhalb des AuthProviders verwendet werden.');
  return value;
}
