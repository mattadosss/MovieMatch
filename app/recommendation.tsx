import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { useMovieMatch } from '@/context/movie-match-context';
import { getRecommendation } from '@/lib/tmdb';

export default function RecommendationScreen() {
  const { recommendation, setRecommendation, profile, history, markRecommendationSeen } = useMovieMatch();
  const [busy, setBusy] = useState(false);

  async function another() {
    setBusy(true);
    try {
      setRecommendation(await getRecommendation(profile.slice(0, 2).map((item) => item.genre_id), history));
    } finally {
      setBusy(false);
    }
  }

  if (!recommendation) return null;
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Pressable style={styles.close} onPress={() => router.back()}><Ionicons name="close" size={24} color={Colors.text} /></Pressable>
      {recommendation.poster_path
        ? <Image source={`https://image.tmdb.org/t/p/w780${recommendation.poster_path}`} style={styles.poster} contentFit="cover" />
        : <View style={styles.poster} />}
      <View style={styles.gradient}>
        <Text style={styles.eyebrow}>DEIN MATCH</Text>
        <Text style={styles.title}>{recommendation.title}</Text>
        <Text style={styles.meta}>
          {[recommendation.release_year, recommendation.runtime_minutes ? `${recommendation.runtime_minutes} Min.` : null, `★ ${recommendation.vote_average.toFixed(1)}`].filter(Boolean).join('  ·  ')}
        </Text>
        <View style={styles.chips}>{recommendation.genre_names.slice(0, 3).map((genre) => <Text key={genre} style={styles.chip}>{genre}</Text>)}</View>
        <Text style={styles.overview}>{recommendation.overview || 'Für diesen Film ist keine Beschreibung verfügbar.'}</Text>
        <Pressable style={styles.primary} onPress={markRecommendationSeen}><Ionicons name="checkmark" color="white" size={20} /><Text style={styles.primaryText}>Als gesehen markieren</Text></Pressable>
        <Pressable style={styles.secondary} onPress={another} disabled={busy}>
          {busy ? <ActivityIndicator color={Colors.text} /> : <><Ionicons name="shuffle" color={Colors.text} size={19} /><Text style={styles.secondaryText}>Anderen Film zeigen</Text></>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: Colors.background },
  close: { position: 'absolute', zIndex: 2, top: 54, right: 22, width: 44, height: 44, borderRadius: 22, backgroundColor: '#00000099', alignItems: 'center', justifyContent: 'center' },
  poster: { width: '100%', height: 490, backgroundColor: Colors.surface },
  gradient: { padding: 24, marginTop: -35, borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: Colors.background, gap: 14 },
  eyebrow: { color: Colors.red, fontSize: 12, fontWeight: '800', letterSpacing: 3 },
  title: { color: Colors.text, fontSize: 36, lineHeight: 40, fontWeight: '800', letterSpacing: -1 },
  meta: { color: Colors.muted, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { color: Colors.text, backgroundColor: Colors.surfaceLight, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, fontSize: 12 },
  overview: { color: '#CAC7C2', fontSize: 15, lineHeight: 23, marginBottom: 4 },
  primary: { height: 56, borderRadius: 17, backgroundColor: Colors.red, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: 'white', fontWeight: '700', fontSize: 16 },
  secondary: { height: 54, borderRadius: 17, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: Colors.text, fontWeight: '700', fontSize: 15 },
});
