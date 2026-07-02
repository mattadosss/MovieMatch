import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/auth-context';

type Mode = 'login' | 'signup';

export default function AuthScreen() {
  const { resendConfirmation, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [canResend, setCanResend] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    setMessage('');
    setCanResend(false);
    try {
      if (mode === 'login') {
        await signIn(email, password);
        router.replace('/(tabs)/profile');
      } else {
        const needsConfirmation = await signUp(email, password);
        if (needsConfirmation) {
          setMessage('Konto erstellt. Bitte bestätige deine E-Mail und melde dich danach an.');
          setCanResend(true);
          setMode('login');
          setPassword('');
        } else {
          router.replace('/(tabs)/profile');
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Anmeldung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError('');
    try {
      await resendConfirmation(email);
      setMessage('Eine neue Bestätigungsmail wurde gesendet.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Die E-Mail konnte nicht erneut gesendet werden.');
    } finally {
      setBusy(false);
    }
  }

  const valid = email.trim().includes('@') && password.length >= 6;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.close} hitSlop={12}>
          <Ionicons name="close" color={Colors.text} size={26} />
        </Pressable>
        <Text style={styles.eyebrow}>MOVIEMATCH-KONTO</Text>
        <Text style={styles.title}>{mode === 'login' ? 'Willkommen zurück.' : 'Konto erstellen.'}</Text>
        <Text style={styles.subtitle}>
          Synchronisiere deinen Filmverlauf zwischen deinen Geräten – oder nutze MovieMatch weiter lokal.
        </Text>

        <View style={styles.card}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="E-Mail"
            placeholderTextColor={Colors.muted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Passwort (mindestens 6 Zeichen)"
            placeholderTextColor={Colors.muted}
            autoCapitalize="none"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            secureTextEntry
            style={styles.input}
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          {!!message && <Text style={styles.success}>{message}</Text>}
          {canResend && (
            <Pressable disabled={busy} onPress={resend}>
              <Text style={styles.switchText}>Bestätigung erneut senden</Text>
            </Pressable>
          )}
          <Pressable
            disabled={!valid || busy}
            onPress={submit}
            style={({ pressed }) => [styles.primary, (!valid || busy) && styles.disabled, pressed && styles.pressed]}>
            {busy
              ? <ActivityIndicator color="white" />
              : <Text style={styles.primaryText}>{mode === 'login' ? 'Anmelden' : 'Konto erstellen'}</Text>}
          </Pressable>
          <Pressable onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage(''); setCanResend(false); }}>
            <Text style={styles.switchText}>
              {mode === 'login' ? 'Noch kein Konto? Jetzt registrieren' : 'Bereits registriert? Anmelden'}
            </Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.replace('/(tabs)')} style={styles.guest}>
          <Text style={styles.guestText}>Als Gast fortfahren</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { flexGrow: 1, padding: 24, paddingTop: 68, justifyContent: 'center', gap: 18 },
  close: { position: 'absolute', right: 24, top: 60, width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: Colors.red, fontSize: 13, fontWeight: '800', letterSpacing: 3 },
  title: { color: Colors.text, fontSize: 40, lineHeight: 46, fontWeight: '800', letterSpacing: -1.2 },
  subtitle: { color: Colors.muted, fontSize: 16, lineHeight: 24, marginBottom: 8 },
  card: { padding: 20, gap: 14, borderRadius: 24, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  input: { height: 54, paddingHorizontal: 16, borderRadius: 16, color: Colors.text, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, fontSize: 15 },
  primary: { height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: Colors.red, marginTop: 4 },
  primaryText: { color: 'white', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.98 }] },
  switchText: { color: Colors.text, textAlign: 'center', paddingVertical: 8, fontWeight: '600' },
  error: { color: '#FF8A95', textAlign: 'center', lineHeight: 20 },
  success: { color: Colors.success, textAlign: 'center', lineHeight: 20 },
  guest: { alignSelf: 'center', padding: 12 },
  guestText: { color: Colors.muted, fontWeight: '600' },
});
