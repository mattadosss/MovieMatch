import AsyncStorage from '@react-native-async-storage/async-storage';
import { Recommendation, StreamingPreferences, WatchHistoryEntry, WatchlistEntry, WatchProvider } from '@/types/movie';

const HISTORY_KEY = '@moviematch/watch_history_entries';
const GENRES_KEY = '@moviematch/movie_genres';
const STREAMING_PREFERENCES_KEY = '@moviematch/streaming_preferences';
const WATCH_PROVIDERS_KEY = '@moviematch/watch_providers_ch';
const WATCHLIST_KEY = '@moviematch/watchlist';
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

export function deduplicateHistoryEntries(entries: WatchHistoryEntry[]) {
  const now = new Date().toISOString();
  const newestByKey = new Map<string, WatchHistoryEntry>();

  for (const entry of entries.filter((item) => !item.deleted_at)) {
    const key = entry.tmdb_id != null
      ? `${entry.media_type}:${entry.tmdb_id}`
      : `${entry.raw_title.trim().toLocaleLowerCase('de')}|${entry.watch_date}`;
    const current = newestByKey.get(key);
    if (!current || Date.parse(entry.watch_date) > Date.parse(current.watch_date)) {
      newestByKey.set(key, entry);
    }
  }

  const keepIds = new Set([...newestByKey.values()].map((entry) => entry.id));
  return entries.map((entry) =>
    !entry.deleted_at && !keepIds.has(entry.id)
      ? { ...entry, updated_at: now, deleted_at: now }
      : entry);
}

export async function cleanupHistoryDuplicates() {
  let result: WatchHistoryEntry[] = [];
  historyWrite = historyWrite.catch(() => undefined).then(async () => {
    const all = deduplicateHistoryEntries(await loadHistoryIncludingDeleted());
    await saveHistory(all);
    result = all.filter((entry) => !entry.deleted_at);
  });
  await historyWrite;
  return result;
}

export async function mergeHistory(entries: WatchHistoryEntry[]) {
  let result: WatchHistoryEntry[] = [];
  historyWrite = historyWrite.catch(() => undefined).then(async () => {
    const current = await loadHistoryIncludingDeleted();
    const now = new Date().toISOString();
    const normalized = deduplicateHistoryEntries(entries.map((entry) => ({
      ...entry,
      updated_at: entry.updated_at ?? entry.created_at ?? now,
      deleted_at: null,
    }))).filter((entry) => !entry.deleted_at);
    const ids = new Set(normalized.flatMap((item) => item.tmdb_id == null ? [] : [`${item.media_type}:${item.tmdb_id}`]));
    const keys = new Set(normalized.map((item) => `${item.raw_title}|${item.watch_date}`));
    const all = deduplicateHistoryEntries([...normalized, ...current.filter((item) =>
      !keys.has(`${item.raw_title}|${item.watch_date}`)
      && (item.tmdb_id == null || !ids.has(`${item.media_type}:${item.tmdb_id}`))
    )]);
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

export async function clearHistoryEntries(userId?: string) {
  let result: WatchHistoryEntry[] = [];
  historyWrite = historyWrite.catch(() => undefined).then(async () => {
    const now = new Date().toISOString();
    const all = (await loadHistoryIncludingDeleted()).map((entry) => {
      const belongsToUser = userId
        ? !entry.user_id || entry.user_id === userId
        : !entry.user_id;
      return belongsToUser && !entry.deleted_at
        ? { ...entry, updated_at: now, deleted_at: now }
        : entry;
    });
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

export async function loadStreamingPreferences(): Promise<StreamingPreferences> {
  const value = await AsyncStorage.getItem(STREAMING_PREFERENCES_KEY);
  if (!value) return { provider_ids: [], updated_at: new Date(0).toISOString() };
  try {
    const preferences = JSON.parse(value) as StreamingPreferences;
    return {
      provider_ids: Array.isArray(preferences.provider_ids) ? preferences.provider_ids : [],
      updated_at: preferences.updated_at ?? new Date(0).toISOString(),
    };
  } catch {
    return { provider_ids: [], updated_at: new Date(0).toISOString() };
  }
}

export async function saveStreamingPreferences(preferences: StreamingPreferences) {
  await AsyncStorage.setItem(STREAMING_PREFERENCES_KEY, JSON.stringify(preferences));
}

export async function loadCachedWatchProviders(maxAgeMs: number): Promise<WatchProvider[] | null> {
  const value = await AsyncStorage.getItem(WATCH_PROVIDERS_KEY);
  if (!value) return null;
  try {
    const cached = JSON.parse(value) as { providers: WatchProvider[]; cached_at: string };
    if (Date.now() - Date.parse(cached.cached_at) > maxAgeMs) return null;
    return cached.providers;
  } catch {
    return null;
  }
}

export async function cacheWatchProviders(providers: WatchProvider[]) {
  await AsyncStorage.setItem(WATCH_PROVIDERS_KEY, JSON.stringify({
    providers,
    cached_at: new Date().toISOString(),
  }));
}

export async function loadWatchlistIncludingDeleted(): Promise<WatchlistEntry[]> {
  const value = await AsyncStorage.getItem(WATCHLIST_KEY);
  if (!value) return [];
  try {
    return (JSON.parse(value) as WatchlistEntry[]).map((entry) => ({
      ...entry,
      updated_at: entry.updated_at ?? entry.created_at,
      deleted_at: entry.deleted_at ?? null,
    }));
  } catch {
    return [];
  }
}

export async function loadWatchlist() {
  return (await loadWatchlistIncludingDeleted()).filter((entry) => !entry.deleted_at);
}

export async function saveWatchlist(entries: WatchlistEntry[]) {
  await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(entries));
}

export async function addWatchlistEntry(movie: Recommendation) {
  const current = await loadWatchlistIncludingDeleted();
  const now = new Date().toISOString();
  const existing = current.find((entry) => entry.tmdb_id === movie.tmdb_id);
  const entry: WatchlistEntry = {
    ...movie,
    id: existing?.id ?? `tmdb-${movie.tmdb_id}`,
    user_id: existing?.user_id,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    deleted_at: null,
  };
  const next = [entry, ...current.filter((item) => item.tmdb_id !== movie.tmdb_id)];
  await saveWatchlist(next);
  return next.filter((item) => !item.deleted_at);
}

export async function removeWatchlistEntry(tmdbId: number) {
  const now = new Date().toISOString();
  const next = (await loadWatchlistIncludingDeleted()).map((entry) =>
    entry.tmdb_id === tmdbId ? { ...entry, updated_at: now, deleted_at: now } : entry);
  await saveWatchlist(next);
  return next.filter((entry) => !entry.deleted_at);
}
