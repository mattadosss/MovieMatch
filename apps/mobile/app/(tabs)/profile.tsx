import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/auth-context';
import { useMovieMatch } from '@/context/movie-match-context';

export default function ProfileScreen() {
  const { user, loading, signOut } = useAuth();
  const { syncNow, syncStatus, syncError } = useMovieMatch();
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  async function logout() {
    setLogoutBusy(true);
    setLogoutError('');
    try {
      await signOut();
    } catch (cause) {
      setLogoutError(cause instanceof Error ? cause.message : 'Abmeldung fehlgeschlagen.');
    } finally {
      setLogoutBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>KONTO & SYNC</Text>
      <Text style={styles.title}>Dein Profil</Text>

      {loading ? (
        <ActivityIndicator color={Colors.red} style={styles.loader} />
      ) : user ? (
        <>
          <View style={styles.account}>
            <View style={styles.avatar}><Ionicons name="person" color={Colors.text} size={28} /></View>
            <View style={styles.accountText}>
              <Text style={styles.label}>ANGEMELDET ALS</Text>
              <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.row}>
              <Ionicons name="cloud-done-outline" color={Colors.red} size={26} />
              <View style={styles.rowText}>
                <Text style={styles.cardTitle}>Cloud-Synchronisierung</Text>
                <Text style={styles.description}>
                  Lokale Änderungen werden automatisch synchronisiert, sobald du online bist.
                </Text>
              </View>
            </View>
            {!!syncError && <Text style={styles.error}>{syncError}</Text>}
            {syncStatus === 'success' && <Text style={styles.success}>Alles ist synchronisiert.</Text>}
            <Pressable
              disabled={syncStatus === 'syncing'}
              onPress={() => syncNow().catch(() => undefined)}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
              {syncStatus === 'syncing'
                ? <ActivityIndicator color="white" />
                : <><Ionicons name="sync" color="white" size={18} /><Text style={styles.primaryText}>Jetzt synchronisieren</Text></>}
            </Pressable>
          </View>

          {!!logoutError && <Text style={styles.error}>{logoutError}</Text>}
          <Pressable disabled={logoutBusy} onPress={logout} style={styles.logout}>
            {logoutBusy ? <ActivityIndicator color="#FF8A95" /> : <Text style={styles.logoutText}>Abmelden</Text>}
          </Pressable>
        </>
      ) : (
        <View style={styles.card}>
          <View style={styles.guestIcon}><Ionicons name="person-outline" color={Colors.muted} size={35} /></View>
          <Text style={styles.cardTitle}>Du nutzt MovieMatch als Gast</Text>
          <Text style={styles.guestDescription}>
            Deine Daten bleiben lokal auf diesem Gerät. Melde dich an, um sie sicher zwischen Geräten zu synchronisieren.
          </Text>
          <Pressable onPress={() => router.push('/auth')} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>Anmelden oder registrieren</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, paddingTop: 68, paddingBottom: 110, gap: 18, backgroundColor: Colors.background },
  eyebrow: { color: Colors.red, fontSize: 13, fontWeight: '800', letterSpacing: 3 },
  title: { color: Colors.text, fontSize: 38, fontWeight: '800', letterSpacing: -1 },
  loader: { marginTop: 60 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  avatar: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: Colors.surfaceLight },
  accountText: { flex: 1, gap: 5 },
  label: { color: Colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  email: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  card: { padding: 20, gap: 16, borderRadius: 24, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  rowText: { flex: 1, gap: 6 },
  cardTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  description: { color: Colors.muted, lineHeight: 20, fontSize: 13 },
  guestDescription: { color: Colors.muted, lineHeight: 22, textAlign: 'center' },
  guestIcon: { alignSelf: 'center', width: 70, height: 70, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: Colors.surfaceLight },
  primary: { minHeight: 52, paddingHorizontal: 18, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: Colors.red },
  primaryText: { color: 'white', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  success: { color: Colors.success, textAlign: 'center' },
  error: { color: '#FF8A95', textAlign: 'center', lineHeight: 20 },
  logout: { alignSelf: 'center', padding: 14 },
  logoutText: { color: '#FF8A95', fontWeight: '700' },
});
