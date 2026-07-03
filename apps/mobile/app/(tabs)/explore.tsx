import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { useMovieMatch } from '@/context/movie-match-context';
import { parseNetflixCsv } from '@/lib/csv';
import { importWatches, movieToHistoryEntry, searchMovies } from '@/lib/tmdb';
import { MovieSearchResult } from '@/types/movie';

export default function ImportScreen() {
  const { addHistory } = useMovieMatch();
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const timer = setTimeout(() => {
      setSearching(true);
      searchMovies(query).then(setResults).catch((cause) =>
        setMessage(cause instanceof Error ? cause.message : 'Suche fehlgeschlagen.'))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  async function addManual(movie: MovieSearchResult) {
    setBusy(true); setMessage('');
    try {
      await addHistory([await movieToHistoryEntry(movie)]);
      setMessage(`„${movie.title}“ wurde zum Verlauf hinzugefügt.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Film konnte nicht hinzugefügt werden.');
    } finally { setBusy(false); }
  }

  async function pickAndImport() {
    setMessage('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values'], copyToCacheDirectory: true, multiple: false,
      });
      if (result.canceled) return;
      setBusy(true);
      const text = await new File(result.assets[0].uri).text();
      const watches = parseNetflixCsv(text, 50);
      setProgress({ done: 0, total: watches.length });
      const entries = await importWatches(watches, (done) => setProgress({ done, total: watches.length }));
      await addHistory(entries);
      const matched = entries.filter((item) => item.match_status === 'matched').length;
      setMessage(`${matched} von ${watches.length} Titeln erfolgreich erkannt.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Import fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  const percent = progress.total ? progress.done / progress.total : 0;
  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 72 : 0}>
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}>
      <Text style={styles.eyebrow}>DEINE DATEN</Text>
      <Text style={styles.title}>Netflix-Verlauf{'\n'}importieren</Text>
      <Text style={styles.subtitle}>Deine Daten bleiben auf diesem Gerät. Nur Filmtitel werden zur Zuordnung an TMDb gesendet.</Text>
      <View style={styles.upload}>
        <View style={styles.icon}><Ionicons name="document-text-outline" size={34} color={Colors.red} /></View>
        <Text style={styles.uploadTitle}>NetflixViewingHistory.csv</Text>
        <Text style={styles.uploadText}>Wir verarbeiten maximal die 50 neuesten Einträge.</Text>
        <Pressable style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]} onPress={pickAndImport} disabled={busy}>
          {busy ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>CSV-Datei auswählen</Text>}
        </Pressable>
      </View>
      {busy && <View style={styles.progressCard}>
        <View style={styles.progressLabels}><Text style={styles.progressTitle}>Titel werden erkannt …</Text><Text style={styles.progressNumber}>{progress.done}/{progress.total}</Text></View>
        <View style={styles.track}><View style={[styles.bar, { width: `${percent * 100}%` }]} /></View>
      </View>}
      {!!message && <Text style={[styles.message, message.includes('erfolgreich') && { color: Colors.success }]}>{message}</Text>}
      <View style={styles.manual}>
        <Text style={styles.sectionTitle}>Film manuell hinzufügen</Text>
        <Text style={styles.uploadText}>Für Filme von Prime Video, Disney+, Kino und anderen Quellen.</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="Filmtitel suchen …"
          placeholderTextColor={Colors.muted} style={styles.input} />
        {searching && <ActivityIndicator color={Colors.red} />}
        {results.map((movie) => <Pressable key={movie.tmdb_id} style={styles.result} onPress={() => addManual(movie)} disabled={busy}>
          {movie.poster_path ? <Image source={`https://image.tmdb.org/t/p/w185${movie.poster_path}`} style={styles.poster} /> : <View style={styles.poster} />}
          <View style={styles.resultInfo}><Text style={styles.resultTitle}>{movie.title}</Text><Text style={styles.resultMeta}>{movie.release_year ?? 'Jahr unbekannt'} · ★ {(movie.vote_average ?? 0).toFixed(1)}</Text></View>
          <Ionicons name="add-circle-outline" color={Colors.red} size={25} />
        </Pressable>)}
      </View>
      <View style={styles.hint}>
        <Ionicons name="information-circle-outline" color={Colors.muted} size={21} />
        <Text style={styles.hintText}>Netflix → Konto → Profile → Daten herunterladen. Der Export kann einige Zeit dauern.</Text>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1, backgroundColor: Colors.background },
  content: { flexGrow: 1, backgroundColor: Colors.background, padding: 24, paddingTop: 68, gap: 18 },
  eyebrow: { color: Colors.red, fontSize: 13, fontWeight: '800', letterSpacing: 3 },
  title: { color: Colors.text, fontSize: 38, lineHeight: 43, fontWeight: '800', letterSpacing: -1 },
  subtitle: { color: Colors.muted, fontSize: 16, lineHeight: 24, marginBottom: 12 },
  upload: { alignItems: 'center', borderRadius: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: '#48484E', backgroundColor: Colors.surface, padding: 28, gap: 13 },
  icon: { height: 68, width: 68, borderRadius: 22, backgroundColor: '#32151A', alignItems: 'center', justifyContent: 'center' },
  uploadTitle: { color: Colors.text, fontWeight: '700', fontSize: 17 },
  uploadText: { color: Colors.muted, textAlign: 'center', lineHeight: 20 },
  button: { backgroundColor: Colors.red, paddingHorizontal: 24, minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 15 },
  progressCard: { padding: 18, backgroundColor: Colors.surface, borderRadius: 18, gap: 12 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressTitle: { color: Colors.text, fontWeight: '600' },
  progressNumber: { color: Colors.muted },
  track: { height: 7, borderRadius: 8, backgroundColor: Colors.surfaceLight, overflow: 'hidden' },
  bar: { height: '100%', backgroundColor: Colors.red },
  message: { color: '#FF8A95', textAlign: 'center', lineHeight: 21 },
  hint: { flexDirection: 'row', gap: 10, marginTop: 10 },
  hintText: { color: Colors.muted, lineHeight: 20, flex: 1, fontSize: 13 },
  manual: { backgroundColor: Colors.surface, borderRadius: 24, borderWidth: 1, borderColor: Colors.border, padding: 18, gap: 12 },
  sectionTitle: { color: Colors.text, fontSize: 19, fontWeight: '700' },
  input: { height: 52, borderRadius: 15, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, color: Colors.text, paddingHorizontal: 16, fontSize: 15 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  poster: { width: 42, height: 61, borderRadius: 7, backgroundColor: Colors.surfaceLight },
  resultInfo: { flex: 1, gap: 4 }, resultTitle: { color: Colors.text, fontWeight: '700' },
  resultMeta: { color: Colors.muted, fontSize: 12 },
});
