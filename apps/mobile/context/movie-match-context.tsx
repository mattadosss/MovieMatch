import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadHistory, mergeHistory, recordSeenEntry, removeHistoryEntry } from '@/lib/storage';
import { buildGenreProfile } from '@/lib/profile';
import { syncHistory } from '@/lib/sync';
import { Recommendation, RecommendationMode, WatchHistoryEntry } from '@/types/movie';
import { useAuth } from '@/context/auth-context';

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

type ContextValue = {
  history: WatchHistoryEntry[];
  profile: ReturnType<typeof buildGenreProfile>;
  recommendation: Recommendation | null;
  setRecommendation: (value: Recommendation | null) => void;
  recommendationMode: RecommendationMode;
  setRecommendationMode: (value: RecommendationMode) => void;
  addHistory: (entries: WatchHistoryEntry[]) => Promise<void>;
  removeHistory: (id: string) => Promise<void>;
  markRecommendationSeen: () => Promise<boolean>;
  syncNow: () => Promise<void>;
  syncStatus: SyncStatus;
  syncError: string;
  loading: boolean;
};

const MovieMatchContext = createContext<ContextValue | null>(null);

export function MovieMatchProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [history, setHistory] = useState<WatchHistoryEntry[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recommendationMode, setRecommendationMode] = useState<RecommendationMode>({ type: 'profile' });
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    loadHistory().then(setHistory).finally(() => setLoading(false));
  }, []);

  const syncNow = useCallback(async () => {
    if (!user) return;
    setSyncStatus('syncing');
    setSyncError('');
    try {
      setHistory(await syncHistory(user));
      setSyncStatus('success');
    } catch (cause) {
      setSyncStatus('error');
      setSyncError(cause instanceof Error ? cause.message : 'Synchronisierung fehlgeschlagen.');
      throw cause;
    }
  }, [user]);

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

  const markRecommendationSeen = useCallback(async () => {
    if (!recommendation) return false;
    const now = new Date().toISOString();
    const entry: WatchHistoryEntry = {
      id: `${Date.now()}-${recommendation.tmdb_id}`, raw_title: recommendation.title,
      parsed_title: recommendation.title, watch_date: now, tmdb_id: recommendation.tmdb_id,
      media_type: 'movie', genre_ids: recommendation.genre_ids, genre_names: recommendation.genre_names,
      runtime_minutes: recommendation.runtime_minutes, vote_average: recommendation.vote_average,
      release_year: recommendation.release_year, poster_path: recommendation.poster_path,
      match_status: 'matched', created_at: now, source: 'marked_from_suggestion',
    };
    const next = await recordSeenEntry(entry);
    setHistory(next);
    if (user) syncNow().catch(() => undefined);
    setRecommendation(null);
    return true;
  }, [recommendation, syncNow, user]);

  const value = useMemo(() => ({
    history, profile: buildGenreProfile(history), recommendation, setRecommendation,
    recommendationMode, setRecommendationMode,
    addHistory, removeHistory, markRecommendationSeen, loading,
    syncNow, syncStatus, syncError,
  }), [addHistory, history, loading, markRecommendationSeen, recommendation, recommendationMode, removeHistory, syncError, syncNow, syncStatus]);

  return <MovieMatchContext.Provider value={value}>{children}</MovieMatchContext.Provider>;
}

export function useMovieMatch() {
  const value = useContext(MovieMatchContext);
  if (!value) throw new Error('useMovieMatch muss innerhalb des Providers verwendet werden.');
  return value;
}
