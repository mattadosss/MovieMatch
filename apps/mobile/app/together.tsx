import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/auth-context';
import { useMovieMatch } from '@/context/movie-match-context';
import { getPartnerWatchHistory, partnerHistoryEntries } from '@/lib/partner';
import { selectProfileGenreIds } from '@/lib/profile';
import { getRecommendation } from '@/lib/tmdb';

export default function TogetherScreen() {
  const { user, username } = useAuth();
  const {
    history,
    profile,
    preferredProviderIds,
    setRecommendation,
    setRecommendationMode,
  } = useMovieMatch();
  const [partnerUsername, setPartnerUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!user) {
      router.push('/auth');
      return;
    }
    if (!username) {
      setError('Lege zuerst in deinem Profil einen eigenen Benutzernamen fest.');
      return;
    }
    if (!profile.length) {
      setError('Importiere zuerst deinen eigenen Verlauf.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const partner = await getPartnerWatchHistory(partnerUsername);
      const combinedHistory = [...history, ...partnerHistoryEntries(partner.watched_tmdb_ids)];
      setRecommendation(await getRecommendation(
        selectProfileGenreIds(profile),
        combinedHistory,
        preferredProviderIds,
      ));
      setRecommendationMode({
        type: 'together',
        partnerUsername: partner.username,
        partnerMovieIds: partner.watched_tmdb_ids,
      });
      router.replace('/recommendation');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gemeinsamer Vorschlag fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable style={styles.close} onPress={() => router.back()}>
        <Ionicons name="close" size={25} color={Colors.text} />
      </Pressable>
      <View style={styles.content}>
        <View style={styles.icon}><Ionicons name="people" color={Colors.red} size={34} /></View>
        <Text style={styles.eyebrow}>ZUSAMMEN SCHAUEN</Text>
        <Text style={styles.title}>Was kennt ihr beide noch nicht?</Text>
        <Text style={styles.subtitle}>
          Gib den Benutzernamen der anderen Person ein. MovieMatch schließt die Verläufe von euch beiden aus.
        </Text>
        <TextInput
          value={partnerUsername}
          onChangeText={setPartnerUsername}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Benutzername"
          placeholderTextColor={Colors.muted}
          style={styles.input}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable disabled={busy || !partnerUsername.trim()} onPress={submit} style={[styles.button, (busy || !partnerUsername.trim()) && styles.disabled]}>
          {busy ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Gemeinsamen Film finden</Text>}
        </Pressable>
        {!user && <Text style={styles.hint}>Für diesen Modus musst du angemeldet sein.</Text>}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: 24, justifyContent: 'center', gap: 17 },
  close: { position: 'absolute', zIndex: 2, top: 54, right: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: '#2B1116' },
  eyebrow: { color: Colors.red, fontSize: 12, fontWeight: '800', letterSpacing: 3 },
  title: { color: Colors.text, fontSize: 38, lineHeight: 43, fontWeight: '800', letterSpacing: -1 },
  subtitle: { color: Colors.muted, fontSize: 15, lineHeight: 23 },
  input: { height: 56, paddingHorizontal: 17, borderRadius: 17, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, color: Colors.text, fontSize: 16 },
  button: { height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: Colors.red },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  error: { color: '#FF8A95', textAlign: 'center', lineHeight: 21 },
  hint: { color: Colors.muted, textAlign: 'center', fontSize: 12 },
});
