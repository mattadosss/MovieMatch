import { Image } from 'expo-image';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { useMovieMatch } from '@/context/movie-match-context';

export default function HistoryScreen() {
  const { history } = useMovieMatch();
  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>BIBLIOTHEK</Text>
      <Text style={styles.title}>Dein Verlauf</Text>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={history.length ? styles.list : styles.emptyList}
        ListEmptyComponent={<Text style={styles.empty}>Noch ist es hier still. Importiere deine Netflix-CSV, um loszulegen.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            {item.poster_path ? <Image source={`https://image.tmdb.org/t/p/w185${item.poster_path}`} style={styles.poster} contentFit="cover" /> : <View style={styles.poster} />}
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={2}>{item.parsed_title}</Text>
              <Text style={styles.meta}>{[item.release_year, item.media_type === 'tv' ? 'Serie' : 'Film', item.runtime_minutes ? `${item.runtime_minutes} Min.` : null].filter(Boolean).join(' · ')}</Text>
              <Text style={styles.genres} numberOfLines={1}>{item.genre_names.slice(0, 3).join(', ') || 'Nicht erkannt'}</Text>
            </View>
            {item.vote_average != null && <Text style={styles.rating}>★ {item.vote_average.toFixed(1)}</Text>}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background, paddingTop: 68 },
  eyebrow: { color: Colors.red, fontSize: 13, fontWeight: '800', letterSpacing: 3, paddingHorizontal: 24 },
  title: { color: Colors.text, fontSize: 38, fontWeight: '800', paddingHorizontal: 24, marginTop: 8 },
  list: { padding: 24, gap: 13, paddingBottom: 110 },
  emptyList: { flex: 1, justifyContent: 'center', padding: 40 },
  empty: { color: Colors.muted, textAlign: 'center', lineHeight: 23 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 18, backgroundColor: Colors.surface, gap: 13 },
  poster: { width: 54, height: 78, borderRadius: 10, backgroundColor: Colors.surfaceLight },
  info: { flex: 1, gap: 5 },
  name: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: Colors.muted, fontSize: 12 },
  genres: { color: Colors.muted, fontSize: 12 },
  rating: { color: '#FFD166', fontWeight: '700', alignSelf: 'flex-start', marginTop: 4 },
});
