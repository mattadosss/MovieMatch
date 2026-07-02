import 'expo-sqlite/localStorage/install';
import 'react-native-url-polyfill/auto';

import { createClient, processLock } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Supabase ist nicht konfiguriert. Setze EXPO_PUBLIC_SUPABASE_URL und '
    + 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in apps/mobile/.env und starte Expo neu.',
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: globalThis.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

export const authRedirectUrl =
  process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL
  ?? 'https://moviematchweb.vercel.app/auth/callback';

export async function createSessionFromUrl(url: string) {
  const [base, fragment = ''] = url.split('#', 2);
  const callbackUrl = new URL(fragment
    ? `${base}${base.includes('?') ? '&' : '?'}${fragment}`
    : base);
  const errorDescription = callbackUrl.searchParams.get('error_description');

  if (errorDescription) throw new Error(errorDescription.replaceAll('+', ' '));

  const code = callbackUrl.searchParams.get('code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  }

  const accessToken = callbackUrl.searchParams.get('access_token');
  const refreshToken = callbackUrl.searchParams.get('refresh_token');
  if (!accessToken || !refreshToken) {
    throw new Error('Der Bestätigungslink enthält keine gültige Sitzung.');
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
  return data.session;
}

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
