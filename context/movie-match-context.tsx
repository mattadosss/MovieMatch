import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadHistory, mergeHistory, saveHistory } from '@/lib/storage';
import { buildGenreProfile } from '@/lib/profile';
import { Recommendation, WatchHistoryEntry } from '@/types/movie';

type ContextValue = {
  history: WatchHistoryEntry[];
  profile: ReturnType<typeof buildGenreProfile>;
  recommendation: Recommendation | null;
  setRecommendation: (value: Recommendation | null) => void;
  addHistory: (entries: WatchHistoryEntry[]) => Promise<void>;
  markRecommendationSeen: () => Promise<void>;
  loading: boolean;
};

const MovieMatchContext = createContext<ContextValue | null>(null);

export function MovieMatchProvider({ children }: PropsWithChildren) {
  const [history, setHistory] = useState<WatchHistoryEntry[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory().then(setHistory).finally(() => setLoading(false));
  }, []);

  const addHistory = useCallback(async (entries: WatchHistoryEntry[]) => {
    const merged = await mergeHistory(entries);
    setHistory(merged);
  }, []);

  const markRecommendationSeen = useCallback(async () => {
    if (!recommendation) return;
    const now = new Date().toISOString();
    const entry: WatchHistoryEntry = {
      id: `${Date.now()}-${recommendation.tmdb_id}`, raw_title: recommendation.title,
      parsed_title: recommendation.title, watch_date: now, tmdb_id: recommendation.tmdb_id,
      media_type: 'movie', genre_ids: recommendation.genre_ids, genre_names: recommendation.genre_names,
      runtime_minutes: recommendation.runtime_minutes, vote_average: recommendation.vote_average,
      release_year: recommendation.release_year, poster_path: recommendation.poster_path,
      match_status: 'matched', created_at: now,
    };
    const next = [entry, ...history];
    await saveHistory(next);
    setHistory(next);
    setRecommendation(null);
  }, [history, recommendation]);

  const value = useMemo(() => ({
    history, profile: buildGenreProfile(history), recommendation, setRecommendation,
    addHistory, markRecommendationSeen, loading,
  }), [addHistory, history, loading, markRecommendationSeen, recommendation]);

  return <MovieMatchContext.Provider value={value}>{children}</MovieMatchContext.Provider>;
}

export function useMovieMatch() {
  const value = useContext(MovieMatchContext);
  if (!value) throw new Error('useMovieMatch muss innerhalb des Providers verwendet werden.');
  return value;
}
