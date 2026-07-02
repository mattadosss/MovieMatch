import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { useMovieMatch } from '@/context/movie-match-context';
import { getRecommendation, getRewatchRecommendation } from '@/lib/tmdb';
import { selectProfileGenreIds } from '@/lib/profile';
import { useState } from 'react';

export default function HomeScreen() {
  const { history, profile, setRecommendation, setRecommendationMode, loading } = useMovieMatch();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const max = Math.max(...profile.map((item) => item.watch_count), 1);

  async function recommend() {
    setWorking(true);
    setError('');
    try {
      const genreIds = selectProfileGenreIds(profile);
      setRecommendation(await getRecommendation(genreIds, history));
      setRecommendationMode({ type: 'profile' });
      router.push('/recommendation');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Der Vorschlag ist fehlgeschlagen.');
    } finally {
      setWorking(false);
    }
  }

  function recommendRewatch() {
    setError('');
    try {
      setRecommendation(getRewatchRecommendation(history));
      setRecommendationMode({ type: 'rewatch' });
      router.push('/recommendation');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kein Film zum Wiederanschauen gefunden.');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>MOVIEMATCH</Text>
      <Text style={styles.title}>Was schauen wir{'\n'}heute?</Text>
      <Text style={styles.subtitle}>Ein Film, abgestimmt auf das, was du wirklich gern siehst.</Text>

      <View style={styles.card}>
        <View style={styles.cardHeading}>
          <Text style={styles.cardTitle}>Dein Filmgeschmack</Text>
          <Text style={styles.count}>{history.filter((item) => item.match_status === 'matched').length} Titel</Text>
        </View>
        {loading ? <ActivityIndicator color={Colors.red} /> : profile.length ? profile.slice(0, 5).map((genre) => (
          <View key={genre.genre_id} style={styles.genreRow}>
            <View style={styles.genreLabels}>
              <Text style={styles.genreName}>{genre.genre_name}</Text>
              <Text style={styles.genreCount}>{genre.watch_count}</Text>
            </View>
            <View style={styles.track}><View style={[styles.bar, { width: `${(genre.watch_count / max) * 100}%` }]} /></View>
          </View>
        )) : (
          <View style={styles.empty}>
            <Ionicons name="film-outline" size={34} color={Colors.muted} />
            <Text style={styles.emptyText}>Importiere deinen Netflix-Verlauf, damit ich deinen Geschmack kennenlerne.</Text>
          </View>
        )}
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed, (!profile.length || working) && styles.disabled]} onPress={recommend} disabled={!profile.length || working}>
        {working ? <ActivityIndicator color="white" /> : <><Ionicons name="play" size={18} color="white" /><Text style={styles.buttonText}>Film vorschlagen</Text></>}
      </Pressable>
      <View style={styles.modes}>
        <Pressable style={styles.mode} onPress={() => router.push('/similar' as Href)}>
          <Ionicons name="git-compare-outline" size={25} color={Colors.red} />
          <View style={styles.modeText}><Text style={styles.modeTitle}>Ähnlicher Film</Text><Text style={styles.modeSubtitle}>Ausgehend von einem Lieblingstitel</Text></View>
          <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
        </Pressable>
        <Pressable style={styles.mode} onPress={() => router.push('/genres' as Href)}>
          <Ionicons name="options-outline" size={25} color={Colors.red} />
          <View style={styles.modeText}><Text style={styles.modeTitle}>Genre selbst wählen</Text><Text style={styles.modeSubtitle}>Passend zu deiner Stimmung</Text></View>
          <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
        </Pressable>
        <Pressable style={styles.mode} onPress={recommendRewatch}>
          <Ionicons name="refresh-outline" size={25} color={Colors.red} />
          <View style={styles.modeText}><Text style={styles.modeTitle}>Lange nicht gesehen</Text><Text style={styles.modeSubtitle}>Ein früherer Favorit für heute</Text></View>
          <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
        </Pressable>
      </View>
      {!profile.length && <Pressable onPress={() => router.push('/(tabs)/explore')}><Text style={styles.link}>Jetzt Verlauf importieren →</Text></Pressable>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, backgroundColor: Colors.background, padding: 24, paddingTop: 68, gap: 18 },
  eyebrow: { color: Colors.red, fontSize: 13, fontWeight: '800', letterSpacing: 3 },
  title: { color: Colors.text, fontSize: 44, lineHeight: 48, fontWeight: '800', letterSpacing: -1.5 },
  subtitle: { color: Colors.muted, fontSize: 17, lineHeight: 25, maxWidth: 330, marginBottom: 12 },
  card: { backgroundColor: Colors.surface, borderRadius: 24, padding: 20, gap: 18, borderWidth: 1, borderColor: Colors.border },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  count: { color: Colors.muted, fontSize: 13 },
  genreRow: { gap: 7 },
  genreLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  genreName: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  genreCount: { color: Colors.muted, fontSize: 13 },
  track: { height: 7, borderRadius: 8, backgroundColor: Colors.surfaceLight, overflow: 'hidden' },
  bar: { height: '100%', backgroundColor: Colors.red, borderRadius: 8 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 22 },
  emptyText: { color: Colors.muted, textAlign: 'center', lineHeight: 21 },
  button: { minHeight: 58, backgroundColor: Colors.red, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  buttonText: { color: 'white', fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.98 }] },
  error: { color: '#FF8A95', textAlign: 'center' },
  link: { color: Colors.text, textAlign: 'center', fontWeight: '600' },
  modes: { gap: 10 },
  mode: { minHeight: 76, borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 13 },
  modeText: { flex: 1, gap: 4 }, modeTitle: { color: Colors.text, fontWeight: '700', fontSize: 15 },
  modeSubtitle: { color: Colors.muted, fontSize: 12 },
});
