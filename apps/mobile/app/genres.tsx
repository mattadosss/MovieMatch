import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { useMovieMatch } from '@/context/movie-match-context';
import { getMovieGenres, getRecommendation } from '@/lib/tmdb';
import { MovieGenre } from '@/types/movie';

export default function GenresScreen() {
  const { history, preferredProviderIds, setRecommendation, setRecommendationMode } = useMovieMatch();
  const [genres, setGenres] = useState<MovieGenre[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMovieGenres().then(setGenres).catch((cause) =>
      setError(cause instanceof Error ? cause.message : 'Genres konnten nicht geladen werden.'))
      .finally(() => setBusy(false));
  }, []);

  function toggle(id: number) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  async function recommend() {
    setBusy(true); setError('');
    try {
      setRecommendation(await getRecommendation(selected, history, preferredProviderIds));
      setRecommendationMode({ type: 'genres', genreIds: [...selected] });
      router.replace('/recommendation');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Kein Vorschlag gefunden.'); }
    finally { setBusy(false); }
  }

  return <ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={24} color={Colors.text} /></Pressable>
    <Text style={styles.eyebrow}>GENRE-WAHL</Text><Text style={styles.title}>Worauf hast du Lust?</Text>
    <Text style={styles.subtitle}>Wähle ein oder mehrere Genres.</Text>
    {busy && !genres.length ? <ActivityIndicator color={Colors.red} /> : <View style={styles.chips}>
      {genres.map((genre) => <Pressable key={genre.id} onPress={() => toggle(genre.id)}
        style={[styles.chip, selected.includes(genre.id) && styles.chipSelected]}>
        <Text style={[styles.chipText, selected.includes(genre.id) && styles.chipTextSelected]}>{genre.name}</Text>
      </Pressable>)}
    </View>}
    {!!error && <Text style={styles.error}>{error}</Text>}
    <Pressable style={[styles.button, (!selected.length || busy) && styles.disabled]} disabled={!selected.length || busy} onPress={recommend}>
      {busy ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Film finden</Text>}
    </Pressable>
  </ScrollView>;
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, backgroundColor: Colors.background, padding: 24, paddingTop: 60, gap: 16 },
  back: { width: 44, height: 44, justifyContent: 'center' },
  eyebrow: { color: Colors.red, fontSize: 12, fontWeight: '800', letterSpacing: 3 },
  title: { color: Colors.text, fontSize: 36, fontWeight: '800' }, subtitle: { color: Colors.muted, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11 },
  chipSelected: { backgroundColor: Colors.red, borderColor: Colors.red }, chipText: { color: Colors.text, fontWeight: '600' },
  chipTextSelected: { color: 'white' }, button: { minHeight: 56, borderRadius: 17, backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 }, disabled: { opacity: 0.45 }, error: { color: '#FF8A95', textAlign: 'center' },
});
