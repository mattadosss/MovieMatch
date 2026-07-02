import { WatchHistoryEntry } from '@/types/movie';

export function filterUnwatchedCandidates<T extends { id: number }>(
  candidates: T[],
  history: WatchHistoryEntry[],
) {
  const watched = new Set(
    history.filter((entry) => entry.media_type === 'movie' && entry.tmdb_id != null)
      .map((entry) => entry.tmdb_id),
  );
  return candidates.filter((candidate) => !watched.has(candidate.id));
}

export function randomTopCandidate<T>(candidates: T[], limit = 10) {
  const top = candidates.slice(0, limit);
  return top[Math.floor(Math.random() * top.length)];
}
