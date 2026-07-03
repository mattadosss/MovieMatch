import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { useMovieMatch } from '@/context/movie-match-context';
import type { WatchlistEntry } from '@/types/movie';

export default function WatchlistScreen() {
  const {
    watchlist,
    removeFromWatchlist,
    setRecommendation,
    setRecommendationMode,
  } = useMovieMatch();

  function openMovie(entry: WatchlistEntry) {
    setRecommendation(entry);
    setRecommendationMode({ type: 'profile' });
    router.push('/recommendation');
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>SPÄTER ANSEHEN</Text>
      <Text style={styles.title}>Deine Watchlist</Text>
      <FlatList
        data={watchlist}
        keyExtractor={(item) => item.id}
        contentContainerStyle={watchlist.length ? styles.list : styles.emptyList}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="bookmark-outline" color={Colors.muted} size={38} />
            <Text style={styles.emptyText}>Speichere Filmvorschläge, die du später ansehen möchtest.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => openMovie(item)}>
            {item.poster_path
              ? <Image source={`https://image.tmdb.org/t/p/w185${item.poster_path}`} style={styles.poster} />
              : <View style={styles.poster} />}
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.meta}>
                {[item.release_year, item.genre_names.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}
              </Text>
              <Text style={styles.providers} numberOfLines={1}>
                {item.watch_providers?.slice(0, 3).map((provider) => provider.provider_name).join(', ')
                  || 'Keine Anbieter gelistet'}
              </Text>
            </View>
            <Pressable
              hitSlop={10}
              onPress={(event) => {
                event.stopPropagation();
                removeFromWatchlist(item.tmdb_id);
              }}>
              <Ionicons name="bookmark" color={Colors.red} size={23} />
            </Pressable>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 68, backgroundColor: Colors.background },
  eyebrow: { paddingHorizontal: 24, color: Colors.red, fontSize: 13, fontWeight: '800', letterSpacing: 3 },
  title: { paddingHorizontal: 24, marginTop: 8, color: Colors.text, fontSize: 38, fontWeight: '800', letterSpacing: -1 },
  list: { padding: 24, paddingBottom: 110, gap: 12 },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: 40 },
  empty: { alignItems: 'center', gap: 14 },
  emptyText: { maxWidth: 280, color: Colors.muted, textAlign: 'center', lineHeight: 22 },
  row: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, backgroundColor: Colors.surface },
  poster: { width: 54, height: 78, borderRadius: 10, backgroundColor: Colors.surfaceLight },
  info: { flex: 1, gap: 5 },
  name: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: Colors.muted, fontSize: 12 },
  providers: { color: '#FF9AA4', fontSize: 11 },
});
