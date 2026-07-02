import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { useMovieMatch } from '@/context/movie-match-context';
import { getSimilarRecommendation, searchMovies } from '@/lib/tmdb';
import { MovieSearchResult } from '@/types/movie';

export default function SimilarScreen() {
  const { history, preferredProviderIds, setRecommendation, setRecommendationMode } = useMovieMatch();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const timer = setTimeout(() => {
      searchMovies(query).then(setResults).catch((cause) =>
        setError(cause instanceof Error ? cause.message : 'Suche fehlgeschlagen.'));
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  async function select(movie: MovieSearchResult) {
    setBusy(true); setError('');
    try {
      setRecommendation(await getSimilarRecommendation(movie.tmdb_id, history, preferredProviderIds));
      setRecommendationMode({ type: 'similar', movieId: movie.tmdb_id });
      router.replace('/recommendation');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kein Vorschlag gefunden.');
    } finally { setBusy(false); }
  }

  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={24} color={Colors.text} /></Pressable>
    <Text style={styles.eyebrow}>ÄHNLICHER FILM</Text>
    <Text style={styles.title}>Was hat dir zuletzt gefallen?</Text>
    <TextInput value={query} onChangeText={setQuery} placeholder="Filmtitel suchen …"
      placeholderTextColor={Colors.muted} autoFocus style={styles.input} />
    {busy && <ActivityIndicator color={Colors.red} />}
    {!!error && <Text style={styles.error}>{error}</Text>}
    {results.map((movie) => <Pressable key={movie.tmdb_id} style={styles.row} onPress={() => select(movie)} disabled={busy}>
      {movie.poster_path ? <Image source={`https://image.tmdb.org/t/p/w185${movie.poster_path}`} style={styles.poster} /> : <View style={styles.poster} />}
      <View style={styles.info}><Text style={styles.name}>{movie.title}</Text><Text style={styles.meta}>{movie.release_year ?? 'Jahr unbekannt'} · ★ {(movie.vote_average ?? 0).toFixed(1)}</Text></View>
      <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
    </Pressable>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, backgroundColor: Colors.background, padding: 24, paddingTop: 60, gap: 14 },
  back: { width: 44, height: 44, justifyContent: 'center' },
  eyebrow: { color: Colors.red, fontSize: 12, fontWeight: '800', letterSpacing: 3 },
  title: { color: Colors.text, fontSize: 34, lineHeight: 40, fontWeight: '800' },
  input: { height: 56, borderRadius: 17, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, color: Colors.text, paddingHorizontal: 18, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: Colors.surface, borderRadius: 16, padding: 10 },
  poster: { width: 48, height: 70, borderRadius: 8, backgroundColor: Colors.surfaceLight },
  info: { flex: 1, gap: 5 }, name: { color: Colors.text, fontWeight: '700', fontSize: 15 },
  meta: { color: Colors.muted, fontSize: 12 }, error: { color: '#FF8A95', textAlign: 'center' },
});
