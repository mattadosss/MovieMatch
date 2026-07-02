import AsyncStorage from '@react-native-async-storage/async-storage';
import { WatchHistoryEntry } from '@/types/movie';

const HISTORY_KEY = '@moviematch/watch_history_entries';
const GENRES_KEY = '@moviematch/movie_genres';
let historyWrite = Promise.resolve();

export async function loadHistory(): Promise<WatchHistoryEntry[]> {
  const value = await AsyncStorage.getItem(HISTORY_KEY);
  if (!value) return [];
  try {
    return (JSON.parse(value) as WatchHistoryEntry[]).map((entry) => ({
      ...entry,
      source: entry.source ?? 'netflix_csv',
    }));
  } catch {
    return [];
  }
}

export async function saveHistory(entries: WatchHistoryEntry[]) {
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

export async function mergeHistory(entries: WatchHistoryEntry[]) {
  let result: WatchHistoryEntry[] = [];
  historyWrite = historyWrite.catch(() => undefined).then(async () => {
    const current = await loadHistory();
    const ids = new Set(entries.flatMap((item) => item.tmdb_id == null ? [] : [`${item.media_type}:${item.tmdb_id}`]));
    const keys = new Set(entries.map((item) => `${item.raw_title}|${item.watch_date}`));
    result = [...entries, ...current.filter((item) =>
      !keys.has(`${item.raw_title}|${item.watch_date}`)
      && (item.tmdb_id == null || !ids.has(`${item.media_type}:${item.tmdb_id}`))
    )];
    await saveHistory(result);
  });
  await historyWrite;
  return result;
}

export async function removeHistoryEntry(id: string) {
  let result: WatchHistoryEntry[] = [];
  historyWrite = historyWrite.catch(() => undefined).then(async () => {
    result = (await loadHistory()).filter((entry) => entry.id !== id);
    await saveHistory(result);
  });
  await historyWrite;
  return result;
}

export async function recordSeenEntry(entry: WatchHistoryEntry) {
  let result: WatchHistoryEntry[] = [];
  historyWrite = historyWrite.catch(() => undefined).then(async () => {
    const current = await loadHistory();
    result = [
      entry,
      ...current.filter((item) =>
        item.id !== entry.id
        && (entry.tmdb_id == null || item.tmdb_id !== entry.tmdb_id || item.media_type !== entry.media_type)),
    ];
    await saveHistory(result);
  });
  await historyWrite;
  return result;
}

export async function loadCachedMovieGenres<T>() {
  const value = await AsyncStorage.getItem(GENRES_KEY);
  return value ? JSON.parse(value) as T : null;
}

export async function cacheMovieGenres<T>(genres: T) {
  await AsyncStorage.setItem(GENRES_KEY, JSON.stringify(genres));
}
