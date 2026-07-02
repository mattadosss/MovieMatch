import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useMovieMatch } from '@/context/movie-match-context';
import { formatWatchProviders } from '@/lib/providers';
import { selectProfileGenreIds } from '@/lib/profile';
import { getRecommendation, getRewatchRecommendation, getSimilarRecommendation } from '@/lib/tmdb';

export default function RecommendationScreen() {
  const insets = useSafeAreaInsets();
  const {
    recommendation,
    setRecommendation,
    recommendationMode,
    profile,
    history,
    markRecommendationSeen,
    preferredProviderIds,
  } = useMovieMatch();
  const [busy, setBusy] = useState(false);

  async function loadAnother(nextHistory = history) {
    if (recommendationMode.type === 'similar') {
      setRecommendation(await getSimilarRecommendation(recommendationMode.movieId, nextHistory, preferredProviderIds));
    } else if (recommendationMode.type === 'rewatch') {
      setRecommendation(await getRewatchRecommendation(nextHistory, recommendation?.tmdb_id, preferredProviderIds));
    } else {
      const genreIds = recommendationMode.type === 'genres'
        ? recommendationMode.genreIds
        : selectProfileGenreIds(profile);
      setRecommendation(await getRecommendation(genreIds, nextHistory, preferredProviderIds));
    }
  }

  async function markSeen() {
    setBusy(true);
    try {
      const nextHistory = await markRecommendationSeen();
      if (!nextHistory) return;
      try {
        await loadAnother(nextHistory);
      } catch (cause) {
        Alert.alert(
          'Film gespeichert',
          cause instanceof Error
            ? `Der nächste Vorschlag konnte nicht geladen werden: ${cause.message}`
            : 'Der nächste Vorschlag konnte nicht geladen werden.',
        );
      }
    } catch (cause) {
      Alert.alert('Fehler', cause instanceof Error ? cause.message : 'Der Film konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  }

  async function another() {
    setBusy(true);
    try {
      await loadAnother();
    } catch (cause) {
      Alert.alert('Kein weiterer Film', cause instanceof Error ? cause.message : 'Der Vorschlag ist fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  if (!recommendation) return null;
  const providers = formatWatchProviders(recommendation.watch_providers);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.screen}>
        <Pressable style={styles.close} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        {recommendation.poster_path
          ? <Image source={`https://image.tmdb.org/t/p/w780${recommendation.poster_path}`} style={styles.poster} contentFit="cover" />
          : <View style={styles.poster} />}
        <View style={styles.gradient}>
          <Text style={styles.eyebrow}>DEIN MATCH</Text>
          <Text style={styles.title}>{recommendation.title}</Text>
          <Text style={styles.meta}>
            {[recommendation.release_year, recommendation.runtime_minutes ? `${recommendation.runtime_minutes} Min.` : null, `★ ${recommendation.vote_average.toFixed(1)}`].filter(Boolean).join('  ·  ')}
          </Text>
          <View style={styles.chips}>
            {recommendation.genre_names.slice(0, 3).map((genre) => <Text key={genre} style={styles.chip}>{genre}</Text>)}
          </View>
          <Text style={styles.overview}>{recommendation.overview || 'Für diesen Film ist keine Beschreibung verfügbar.'}</Text>
          <View style={styles.providers}>
            <Text style={styles.providerTitle}>Wo verfügbar</Text>
            {providers.length ? (
              <View style={styles.providerChips}>
                {providers.map((provider) => (
                  <Text key={`${provider.provider_id}:${provider.type}`} style={styles.providerChip}>
                    {provider.label}
                  </Text>
                ))}
              </View>
            ) : <Text style={styles.providerEmpty}>Für die Schweiz sind keine Anbieter gelistet.</Text>}
            <View style={styles.providerFooter}>
              <Text style={styles.attribution}>Streamingdaten von JustWatch</Text>
              {!!recommendation.watch_provider_link && (
                <Pressable onPress={() => Linking.openURL(recommendation.watch_provider_link!)}>
                  <Text style={styles.providerLink}>Verfügbarkeit prüfen →</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.floatingActions, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable style={styles.primary} onPress={markSeen} disabled={busy}>
          <Ionicons name="checkmark" color="white" size={20} />
          <Text style={styles.primaryText}>Als gesehen markieren</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={another} disabled={busy}>
          {busy
            ? <ActivityIndicator color={Colors.text} />
            : <><Ionicons name="shuffle" color={Colors.text} size={19} /><Text style={styles.secondaryText}>Anderen Film zeigen</Text></>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  screen: { flexGrow: 1, paddingBottom: 170, backgroundColor: Colors.background },
  close: { position: 'absolute', zIndex: 2, top: 54, right: 22, width: 44, height: 44, borderRadius: 22, backgroundColor: '#00000099', alignItems: 'center', justifyContent: 'center' },
  poster: { width: '100%', height: 490, backgroundColor: Colors.surface },
  gradient: { padding: 24, marginTop: -35, borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: Colors.background, gap: 14 },
  eyebrow: { color: Colors.red, fontSize: 12, fontWeight: '800', letterSpacing: 3 },
  title: { color: Colors.text, fontSize: 36, lineHeight: 40, fontWeight: '800', letterSpacing: -1 },
  meta: { color: Colors.muted, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { color: Colors.text, backgroundColor: Colors.surfaceLight, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, fontSize: 12 },
  overview: { color: '#CAC7C2', fontSize: 15, lineHeight: 23, marginBottom: 4 },
  providers: { padding: 16, gap: 11, borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  providerTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  providerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  providerChip: { color: Colors.text, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 12, backgroundColor: Colors.surfaceLight, fontSize: 11, fontWeight: '600' },
  providerEmpty: { color: Colors.muted, fontSize: 13 },
  providerFooter: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  attribution: { color: Colors.muted, fontSize: 10 },
  providerLink: { color: Colors.red, fontSize: 11, fontWeight: '700' },
  floatingActions: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 18, gap: 9, backgroundColor: '#0A0A0BF2', borderTopWidth: 1, borderTopColor: Colors.border },
  primary: { height: 56, borderRadius: 17, backgroundColor: Colors.red, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: 'white', fontWeight: '700', fontSize: 16 },
  secondary: { height: 54, borderRadius: 17, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: Colors.text, fontWeight: '700', fontSize: 15 },
});
