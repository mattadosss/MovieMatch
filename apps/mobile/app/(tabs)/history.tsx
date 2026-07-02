import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo, useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, ListRenderItem, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { useMovieMatch } from '@/context/movie-match-context';
import { WatchHistoryEntry } from '@/types/movie';
import { formatWatchProviders } from '@/lib/providers';

const HistoryRow = memo(function HistoryRow({
  item,
  onDelete,
}: {
  item: WatchHistoryEntry;
  onDelete: (id: string, title: string) => void;
}) {
  const providers = formatWatchProviders(item.watch_providers);
  return (
    <View style={styles.row}>
      {item.poster_path
        ? <Image source={`https://image.tmdb.org/t/p/w185${item.poster_path}`} style={styles.poster} contentFit="cover" />
        : <View style={styles.poster} />}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{item.parsed_title}</Text>
        <Text style={styles.meta}>{[
          item.release_year,
          item.media_type === 'tv' ? 'Serie' : 'Film',
          item.runtime_minutes ? `${item.runtime_minutes} Min.` : null,
        ].filter(Boolean).join(' · ')}</Text>
        <Text style={styles.genres} numberOfLines={1}>{item.genre_names.slice(0, 3).join(', ') || 'Nicht erkannt'}</Text>
        {!!providers.length && (
          <Text style={styles.providers} numberOfLines={1}>
            {providers.slice(0, 3).map((provider) => provider.label).join(', ')}
          </Text>
        )}
      </View>
      {item.vote_average != null && <Text style={styles.rating}>★ {item.vote_average.toFixed(1)}</Text>}
      <Pressable
        style={styles.deleteButton}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`${item.parsed_title} löschen`}
        onPress={() => onDelete(item.id, item.parsed_title)}>
        <Ionicons name="trash-outline" size={19} color="#FF8A95" />
      </Pressable>
    </View>
  );
});

export default function HistoryScreen() {
  const { history, removeHistory } = useMovieMatch();
  const [query, setQuery] = useState('');
  const hasProviderData = history.some((item) => item.watch_providers?.length);
  const filteredHistory = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('de');
    if (!needle) return history;
    return history.filter((item) =>
      item.parsed_title.toLocaleLowerCase('de').includes(needle)
      || item.genre_names.some((genre) => genre.toLocaleLowerCase('de').includes(needle)));
  }, [history, query]);

  const confirmDelete = useCallback((id: string, title: string) => {
    Alert.alert(
      'Aus Verlauf löschen?',
      `„${title}“ wird dauerhaft aus deinem lokalen Verlauf entfernt.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => removeHistory(id).catch((cause) =>
            Alert.alert('Fehler', cause instanceof Error ? cause.message : 'Der Eintrag konnte nicht gelöscht werden.')),
        },
      ],
    );
  }, [removeHistory]);

  const renderItem = useCallback<ListRenderItem<WatchHistoryEntry>>(
    ({ item }) => <HistoryRow item={item} onDelete={confirmDelete} />,
    [confirmDelete],
  );

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>BIBLIOTHEK</Text>
      <Text style={styles.title}>Dein Verlauf</Text>
      <View style={styles.search}>
        <Ionicons name="search" size={19} color={Colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Titel oder Genre suchen"
          placeholderTextColor={Colors.muted}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {!!query && <Pressable onPress={() => setQuery('')} hitSlop={10}>
          <Ionicons name="close-circle" size={19} color={Colors.muted} />
        </Pressable>}
      </View>
      <FlatList
        data={filteredHistory}
        keyExtractor={(item) => item.id}
        keyboardDismissMode="on-drag"
        contentContainerStyle={filteredHistory.length ? styles.list : styles.emptyList}
        ListEmptyComponent={<Text style={styles.empty}>{history.length
          ? 'Keine passenden Einträge gefunden.'
          : 'Noch ist es hier still. Importiere deine Netflix-CSV, um loszulegen.'}</Text>}
        ListFooterComponent={hasProviderData
          ? <Text style={styles.attribution}>Streamingdaten von JustWatch</Text>
          : null}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background, paddingTop: 68 },
  eyebrow: { color: Colors.red, fontSize: 13, fontWeight: '800', letterSpacing: 3, paddingHorizontal: 24 },
  title: { color: Colors.text, fontSize: 38, fontWeight: '800', paddingHorizontal: 24, marginTop: 8 },
  search: { height: 50, marginHorizontal: 24, marginTop: 18, paddingHorizontal: 15, borderRadius: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, height: '100%', color: Colors.text, fontSize: 15 },
  list: { padding: 24, gap: 13, paddingBottom: 110 },
  emptyList: { flex: 1, justifyContent: 'center', padding: 40 },
  empty: { color: Colors.muted, textAlign: 'center', lineHeight: 23 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 18, backgroundColor: Colors.surface, gap: 10 },
  poster: { width: 54, height: 78, borderRadius: 10, backgroundColor: Colors.surfaceLight },
  info: { flex: 1, gap: 5 },
  name: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: Colors.muted, fontSize: 12 },
  genres: { color: Colors.muted, fontSize: 12 },
  providers: { color: Colors.success, fontSize: 11 },
  attribution: { color: Colors.muted, fontSize: 10, textAlign: 'center', marginTop: 10 },
  rating: { color: '#FFD166', fontWeight: '700', alignSelf: 'flex-start', marginTop: 4, fontSize: 12 },
  deleteButton: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
