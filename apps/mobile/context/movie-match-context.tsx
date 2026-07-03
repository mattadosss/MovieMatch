import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  cleanupHistoryDuplicates,
  addWatchlistEntry,
  loadStreamingPreferences,
  loadWatchlist,
  clearHistoryEntries,
  mergeHistory,
  recordSeenEntry,
  removeHistoryEntry,
  removeWatchlistEntry,
  saveStreamingPreferences,
} from '@/lib/storage';
import { buildGenreProfile } from '@/lib/profile';
import { syncHistory } from '@/lib/sync';
import { Recommendation, RecommendationMode, WatchHistoryEntry, WatchlistEntry } from '@/types/movie';
import { useAuth } from '@/context/auth-context';
import { syncStreamingPreferences } from '@/lib/preferences';
import { syncWatchlist } from '@/lib/watchlist-sync';

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

type ContextValue = {
  history: WatchHistoryEntry[];
  watchlist: WatchlistEntry[];
  profile: ReturnType<typeof buildGenreProfile>;
  recommendation: Recommendation | null;
  setRecommendation: (value: Recommendation | null) => void;
  recommendationMode: RecommendationMode;
  setRecommendationMode: (value: RecommendationMode) => void;
  addHistory: (entries: WatchHistoryEntry[]) => Promise<void>;
  removeHistory: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  addToWatchlist: (movie: Recommendation) => Promise<void>;
  removeFromWatchlist: (tmdbId: number) => Promise<void>;
  markRecommendationSeen: () => Promise<WatchHistoryEntry[] | null>;
  syncNow: () => Promise<void>;
  syncStatus: SyncStatus;
  syncError: string;
  preferredProviderIds: number[];
  togglePreferredProvider: (providerId: number) => Promise<void>;
  loading: boolean;
};

const MovieMatchContext = createContext<ContextValue | null>(null);

export function MovieMatchProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [history, setHistory] = useState<WatchHistoryEntry[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recommendationMode, setRecommendationMode] = useState<RecommendationMode>({ type: 'profile' });
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState('');
  const [preferredProviderIds, setPreferredProviderIds] = useState<number[]>([]);
  const preferencesSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([cleanupHistoryDuplicates(), loadStreamingPreferences(), loadWatchlist()])
      .then(([entries, preferences, savedMovies]) => {
        setHistory(entries);
        setPreferredProviderIds(preferences.provider_ids);
        setWatchlist(savedMovies);
      })
      .finally(() => setLoading(false));
  }, []);

  const syncNow = useCallback(async () => {
    if (!user) return;
    setSyncStatus('syncing');
    setSyncError('');
    try {
      const [entries, preferences, savedMovies] = await Promise.all([
        syncHistory(user),
        syncStreamingPreferences(user),
        syncWatchlist(user),
      ]);
      setHistory(entries);
      setPreferredProviderIds(preferences.provider_ids);
      setWatchlist(savedMovies);
      setSyncStatus('success');
    } catch (cause) {
      setSyncStatus('error');
      setSyncError(cause instanceof Error ? cause.message : 'Synchronisierung fehlgeschlagen.');
      throw cause;
    }
  }, [user]);

  const togglePreferredProvider = useCallback(async (providerId: number) => {
    const providerIds = preferredProviderIds.includes(providerId)
      ? preferredProviderIds.filter((id) => id !== providerId)
      : [...preferredProviderIds, providerId];
    const preferences = { provider_ids: providerIds, updated_at: new Date().toISOString() };
    setPreferredProviderIds(providerIds);
    await saveStreamingPreferences(preferences);
    if (user) {
      if (preferencesSyncTimer.current) clearTimeout(preferencesSyncTimer.current);
      preferencesSyncTimer.current = setTimeout(() => {
        setSyncStatus('syncing');
        syncStreamingPreferences(user)
          .then(() => setSyncStatus('success'))
          .catch((cause) => {
            setSyncStatus('error');
            setSyncError(cause instanceof Error ? cause.message : 'Streaming-Anbieter konnten nicht synchronisiert werden.');
          });
      }, 800);
    }
  }, [preferredProviderIds, user]);

  useEffect(() => () => {
    if (preferencesSyncTimer.current) clearTimeout(preferencesSyncTimer.current);
  }, []);

  useEffect(() => {
    if (user && !loading) syncNow().catch(() => undefined);
  }, [loading, syncNow, user]);

  const addHistory = useCallback(async (entries: WatchHistoryEntry[]) => {
    const merged = await mergeHistory(entries);
    setHistory(merged);
    if (user) syncNow().catch(() => undefined);
  }, [syncNow, user]);

  const removeHistory = useCallback(async (id: string) => {
    setHistory(await removeHistoryEntry(id));
    if (user) syncNow().catch(() => undefined);
  }, [syncNow, user]);

  const clearHistory = useCallback(async () => {
    if (user) await syncHistory(user).catch(() => undefined);
    setHistory(await clearHistoryEntries(user?.id));
    if (user) setHistory(await syncHistory(user));
  }, [user]);

  const addToWatchlist = useCallback(async (movie: Recommendation) => {
    setWatchlist(await addWatchlistEntry(movie));
    if (user) syncWatchlist(user).then(setWatchlist).catch(() => undefined);
  }, [user]);

  const removeFromWatchlist = useCallback(async (tmdbId: number) => {
    setWatchlist(await removeWatchlistEntry(tmdbId));
    if (user) syncWatchlist(user).then(setWatchlist).catch(() => undefined);
  }, [user]);

  const markRecommendationSeen = useCallback(async () => {
    if (!recommendation) return null;
    const now = new Date().toISOString();
    const entry: WatchHistoryEntry = {
      id: `${Date.now()}-${recommendation.tmdb_id}`, raw_title: recommendation.title,
      parsed_title: recommendation.title, watch_date: now, tmdb_id: recommendation.tmdb_id,
      media_type: 'movie', genre_ids: recommendation.genre_ids, genre_names: recommendation.genre_names,
      runtime_minutes: recommendation.runtime_minutes, vote_average: recommendation.vote_average,
      release_year: recommendation.release_year, poster_path: recommendation.poster_path,
      watch_providers: recommendation.watch_providers,
      watch_provider_link: recommendation.watch_provider_link,
      match_status: 'matched', created_at: now, source: 'marked_from_suggestion',
    };
    const next = await recordSeenEntry(entry);
    setHistory(next);
    setWatchlist(await removeWatchlistEntry(recommendation.tmdb_id));
    if (user) syncNow().catch(() => undefined);
    return next;
  }, [recommendation, syncNow, user]);

  const value = useMemo(() => ({
    history, watchlist, profile: buildGenreProfile(history), recommendation, setRecommendation,
    recommendationMode, setRecommendationMode,
    addHistory, removeHistory, clearHistory, addToWatchlist, removeFromWatchlist, markRecommendationSeen, loading,
    syncNow, syncStatus, syncError,
    preferredProviderIds, togglePreferredProvider,
  }), [addHistory, addToWatchlist, clearHistory, history, loading, markRecommendationSeen, preferredProviderIds, recommendation, recommendationMode, removeFromWatchlist, removeHistory, syncError, syncNow, syncStatus, togglePreferredProvider, watchlist]);

  return <MovieMatchContext.Provider value={value}>{children}</MovieMatchContext.Provider>;
}

export function useMovieMatch() {
  const value = useContext(MovieMatchContext);
  if (!value) throw new Error('useMovieMatch muss innerhalb des Providers verwendet werden.');
  return value;
}
