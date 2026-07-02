import { GenreProfileItem, WatchHistoryEntry } from '@/types/movie';

export function buildGenreProfile(history: WatchHistoryEntry[]): GenreProfileItem[] {
  const profile = new Map<number, GenreProfileItem>();
  const now = Date.now();
  for (const entry of history) {
    entry.genre_ids.forEach((genreId, index) => {
      const ageDays = Math.max(0, (now - new Date(entry.watch_date).getTime()) / 86_400_000);
      const weight = Number.isFinite(ageDays) ? 1 + Math.exp(-ageDays / 365) : 1;
      const current = profile.get(genreId) ?? {
        genre_id: genreId,
        genre_name: entry.genre_names[index] ?? 'Unbekannt',
        watch_count: 0,
        weighted_score: 0,
      };
      current.watch_count += 1;
      current.weighted_score += weight;
      profile.set(genreId, current);
    });
  }
  return [...profile.values()].sort((a, b) => b.weighted_score - a.weighted_score);
}

export function selectProfileGenreIds(profile: GenreProfileItem[], count = 2) {
  const pool = [...profile];
  const selected: number[] = [];

  while (pool.length && selected.length < count) {
    // The square root keeps favourites more likely without starving lower-ranked genres.
    const weights = pool.map((item) => Math.sqrt(Math.max(item.weighted_score, 0.01)));
    let cursor = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
    let index = 0;
    for (; index < weights.length - 1; index += 1) {
      cursor -= weights[index];
      if (cursor <= 0) break;
    }
    selected.push(pool[index].genre_id);
    pool.splice(index, 1);
  }

  return selected;
}
