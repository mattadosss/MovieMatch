import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/auth-context';
import { useMovieMatch } from '@/context/movie-match-context';
import { getMovieWatchProviders } from '@/lib/tmdb';
import type { WatchProvider } from '@/types/movie';

export default function ProfileScreen() {
  const { user, username, profileLoading, loading, signOut, updateUsername } = useAuth();
  const {
    clearHistory,
    preferredProviderIds,
    syncNow,
    syncStatus,
    syncError,
    togglePreferredProvider,
  } = useMovieMatch();
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [providers, setProviders] = useState<WatchProvider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState('');
  const [providerQuery, setProviderQuery] = useState('');
  const [clearBusy, setClearBusy] = useState(false);
  const [clearError, setClearError] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameBusy, setUsernameBusy] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState('');

  useEffect(() => {
    setUsernameInput(username ?? '');
  }, [username]);

  useEffect(() => {
    if (!user) return;
    setProvidersLoading(true);
    setProvidersError('');
    getMovieWatchProviders()
      .then(setProviders)
      .catch((cause) => setProvidersError(
        cause instanceof Error ? cause.message : 'Streaming-Anbieter konnten nicht geladen werden.',
      ))
      .finally(() => setProvidersLoading(false));
  }, [user]);

  const sortedProviders = useMemo(() => providers
    .filter((provider) => provider.provider_name.toLocaleLowerCase('de')
      .includes(providerQuery.trim().toLocaleLowerCase('de')))
    .sort((a, b) => {
      const aSelected = preferredProviderIds.includes(a.provider_id);
      const bSelected = preferredProviderIds.includes(b.provider_id);
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      return a.display_priority - b.display_priority;
    }), [preferredProviderIds, providerQuery, providers]);
  const visibleProviders = providerQuery.trim()
    ? sortedProviders
    : sortedProviders.slice(0, 25);

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

  async function saveUsername() {
    setUsernameBusy(true);
    setUsernameMessage('');
    try {
      await updateUsername(usernameInput);
      setUsernameMessage('Benutzername gespeichert.');
    } catch (cause) {
      setUsernameMessage(cause instanceof Error ? cause.message : 'Benutzername konnte nicht gespeichert werden.');
    } finally {
      setUsernameBusy(false);
    }
  }

  function confirmClearHistory() {
    Alert.alert(
      'Gesamten Verlauf löschen?',
      'Alle Filme werden lokal und aus deinem synchronisierten Supabase-Verlauf gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Alles löschen',
          style: 'destructive',
          onPress: async () => {
            setClearBusy(true);
            setClearError('');
            try {
              await clearHistory();
              Alert.alert('Verlauf gelöscht', 'Dein gesamter Filmverlauf wurde gelöscht.');
            } catch (cause) {
              setClearError(cause instanceof Error ? cause.message : 'Der Verlauf konnte nicht vollständig gelöscht werden.');
            } finally {
              setClearBusy(false);
            }
          },
        },
      ],
    );
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
              <Ionicons name="at-outline" color={Colors.red} size={26} />
              <View style={styles.rowText}>
                <Text style={styles.cardTitle}>Dein Benutzername</Text>
                <Text style={styles.description}>Andere können dich damit für gemeinsame Filmvorschläge finden.</Text>
              </View>
            </View>
            <TextInput
              value={usernameInput}
              onChangeText={setUsernameInput}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={24}
              placeholder="z. B. movie_fan"
              placeholderTextColor={Colors.muted}
              style={styles.usernameInput}
            />
            {!!usernameMessage && (
              <Text style={usernameMessage.includes('gespeichert') ? styles.success : styles.error}>
                {usernameMessage}
              </Text>
            )}
            <Pressable
              disabled={usernameBusy || profileLoading || usernameInput.trim().toLowerCase() === username}
              onPress={saveUsername}
              style={[styles.primary, (usernameBusy || profileLoading || usernameInput.trim().toLowerCase() === username) && styles.disabled]}>
              {usernameBusy || profileLoading
                ? <ActivityIndicator color="white" />
                : <Text style={styles.primaryText}>{username ? 'Benutzername ändern' : 'Benutzername festlegen'}</Text>}
            </Pressable>
          </View>

          <View style={styles.dangerCard}>
            <View style={styles.row}>
              <Ionicons name="trash-outline" color="#FF8A95" size={25} />
              <View style={styles.rowText}>
                <Text style={styles.cardTitle}>Verlauf zurücksetzen</Text>
                <Text style={styles.description}>Löscht alle Filme auf diesem Gerät und in deinem Cloud-Konto.</Text>
              </View>
            </View>
            {!!clearError && <Text style={styles.error}>{clearError}</Text>}
            <Pressable disabled={clearBusy} onPress={confirmClearHistory} style={styles.dangerButton}>
              {clearBusy
                ? <ActivityIndicator color="#FF8A95" />
                : <Text style={styles.dangerButtonText}>Gesamten Verlauf löschen</Text>}
            </Pressable>
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

          <View style={styles.card}>
            <View style={styles.row}>
              <Ionicons name="tv-outline" color={Colors.red} size={26} />
              <View style={styles.rowText}>
                <Text style={styles.cardTitle}>Deine Streaming-Anbieter</Text>
                <Text style={styles.description}>
                  Bevorzugte Dienste werden bei Filmvorschlägen zuerst berücksichtigt.
                </Text>
              </View>
            </View>
            <View style={styles.search}>
              <Ionicons name="search" color={Colors.muted} size={18} />
              <TextInput
                value={providerQuery}
                onChangeText={setProviderQuery}
                placeholder="Anbieter suchen"
                placeholderTextColor={Colors.muted}
                autoCorrect={false}
                style={styles.searchInput}
              />
              {!!providerQuery && (
                <Pressable onPress={() => setProviderQuery('')} hitSlop={10}>
                  <Ionicons name="close-circle" color={Colors.muted} size={19} />
                </Pressable>
              )}
            </View>
            {providersLoading && <ActivityIndicator color={Colors.red} />}
            {!!providersError && <Text style={styles.error}>{providersError}</Text>}
            <View style={styles.providerGrid}>
              {visibleProviders.map((provider) => {
                const selected = preferredProviderIds.includes(provider.provider_id);
                return (
                  <Pressable
                    key={provider.provider_id}
                    onPress={() => togglePreferredProvider(provider.provider_id)}
                    style={({ pressed }) => [
                      styles.provider,
                      selected && styles.providerSelected,
                      pressed && styles.pressed,
                    ]}>
                    {provider.logo_path
                      ? <Image source={`https://image.tmdb.org/t/p/w92${provider.logo_path}`} style={styles.providerLogo} />
                      : <View style={styles.providerLogo} />}
                    <Text style={styles.providerName} numberOfLines={2}>{provider.provider_name}</Text>
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      color={selected ? Colors.success : Colors.muted}
                      size={20}
                    />
                  </Pressable>
                );
              })}
            </View>
            {!providersLoading && !sortedProviders.length && (
              <Text style={styles.description}>Kein Anbieter gefunden.</Text>
            )}
            {!providerQuery && sortedProviders.length > visibleProviders.length && (
              <Text style={styles.description}>Weitere Anbieter findest du über die Suche.</Text>
            )}
            <Text style={styles.attribution}>Streamingdaten von JustWatch · Region Schweiz</Text>
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
  providerGrid: { gap: 8 },
  provider: { minHeight: 58, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  providerSelected: { borderColor: Colors.red, backgroundColor: '#271217' },
  providerLogo: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.surfaceLight },
  providerName: { flex: 1, color: Colors.text, fontSize: 13, fontWeight: '600' },
  attribution: { color: Colors.muted, fontSize: 10, textAlign: 'center' },
  search: { height: 48, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 15, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  searchInput: { flex: 1, height: '100%', color: Colors.text, fontSize: 14 },
  usernameInput: { height: 52, paddingHorizontal: 15, borderRadius: 15, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, color: Colors.text, fontSize: 15 },
  disabled: { opacity: 0.45 },
  dangerCard: { padding: 20, gap: 16, borderRadius: 24, backgroundColor: Colors.surface, borderWidth: 1, borderColor: '#57252B' },
  dangerButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: '#8B3540', backgroundColor: '#281216' },
  dangerButtonText: { color: '#FF8A95', fontSize: 14, fontWeight: '700' },
});
