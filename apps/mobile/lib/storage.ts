import AsyncStorage from '@react-native-async-storage/async-storage';
import { WatchHistoryEntry } from '@/types/movie';

const HISTORY_KEY = '@moviematch/watch_history_entries';
const GENRES_KEY = '@moviematch/movie_genres';
let historyWrite = Promise.resolve();

export async function loadHistory(): Promise<WatchHistoryEntry[]> {
  return (await loadHistoryIncludingDeleted()).filter((entry) => !entry.deleted_at);
}

export async function loadHistoryIncludingDeleted(): Promise<WatchHistoryEntry[]> {
  const value = await AsyncStorage.getItem(HISTORY_KEY);
  if (!value) return [];
  try {
    return (JSON.parse(value) as WatchHistoryEntry[]).map((entry) => ({
      ...entry,
      source: entry.source ?? 'netflix_csv',
      updated_at: entry.updated_at ?? entry.created_at,
      deleted_at: entry.deleted_at ?? null,
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
    const current = await loadHistoryIncludingDeleted();
    const now = new Date().toISOString();
    const normalized = entries.map((entry) => ({
      ...entry,
      updated_at: entry.updated_at ?? entry.created_at ?? now,
      deleted_at: null,
    }));
    const ids = new Set(normalized.flatMap((item) => item.tmdb_id == null ? [] : [`${item.media_type}:${item.tmdb_id}`]));
    const keys = new Set(normalized.map((item) => `${item.raw_title}|${item.watch_date}`));
    const all = [...normalized, ...current.filter((item) =>
      !keys.has(`${item.raw_title}|${item.watch_date}`)
      && (item.tmdb_id == null || !ids.has(`${item.media_type}:${item.tmdb_id}`))
    )];
    await saveHistory(all);
    result = all.filter((item) => !item.deleted_at);
  });
  await historyWrite;
  return result;
}

export async function removeHistoryEntry(id: string) {
  let result: WatchHistoryEntry[] = [];
  historyWrite = historyWrite.catch(() => undefined).then(async () => {
    const now = new Date().toISOString();
    const all = (await loadHistoryIncludingDeleted()).map((entry) =>
      entry.id === id ? { ...entry, updated_at: now, deleted_at: now } : entry);
    await saveHistory(all);
    result = all.filter((entry) => !entry.deleted_at);
  });
  await historyWrite;
  return result;
}

export async function recordSeenEntry(entry: WatchHistoryEntry) {
  let result: WatchHistoryEntry[] = [];
  historyWrite = historyWrite.catch(() => undefined).then(async () => {
    const current = await loadHistoryIncludingDeleted();
    const normalized = {
      ...entry,
      updated_at: entry.updated_at ?? entry.created_at,
      deleted_at: null,
    };
    const all = [
      normalized,
      ...current.filter((item) =>
        item.id !== entry.id
        && (entry.tmdb_id == null || item.tmdb_id !== entry.tmdb_id || item.media_type !== entry.media_type)),
    ];
    await saveHistory(all);
    result = all.filter((item) => !item.deleted_at);
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
