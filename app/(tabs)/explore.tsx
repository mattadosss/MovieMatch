import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { useMovieMatch } from '@/context/movie-match-context';
import { parseNetflixCsv } from '@/lib/csv';
import { importWatches } from '@/lib/tmdb';

export default function ImportScreen() {
  const { addHistory } = useMovieMatch();
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

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
    <ScrollView contentContainerStyle={styles.content}>
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
      <View style={styles.hint}>
        <Ionicons name="information-circle-outline" color={Colors.muted} size={21} />
        <Text style={styles.hintText}>Netflix → Konto → Profile → Daten herunterladen. Der Export kann einige Zeit dauern.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
});
