import { CsvWatch } from '@/lib/csv';
import { Recommendation, WatchHistoryEntry } from '@/types/movie';

const BASE_URL = 'https://api.themoviedb.org/3';
const apiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Genre = { id: number; name: string };
type SearchResult = {
  id: number; title?: string; name?: string; popularity: number; genre_ids: number[];
  vote_average: number; release_date?: string; first_air_date?: string; poster_path: string | null;
  overview?: string;
};

function requireKey() {
  if (!apiKey) throw new Error('EXPO_PUBLIC_TMDB_API_KEY ist nicht konfiguriert.');
}

async function request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  requireKey();
  const query = new URLSearchParams({ api_key: apiKey!, language: 'de-DE', ...params });
  const response = await fetch(`${BASE_URL}${path}?${query}`);
  if (!response.ok) throw new Error(`TMDb-Anfrage fehlgeschlagen (${response.status}).`);
  return response.json() as Promise<T>;
}

export async function loadGenres() {
  const [movies, tv] = await Promise.all([
    request<{ genres: Genre[] }>('/genre/movie/list'),
    request<{ genres: Genre[] }>('/genre/tv/list'),
  ]);
  return { movie: movies.genres, tv: tv.genres };
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random & 3) | 8).toString(16);
  });
}

export async function enrichWatch(
  watch: CsvWatch,
  genres: Awaited<ReturnType<typeof loadGenres>>,
): Promise<WatchHistoryEntry> {
  const created = new Date().toISOString();
  let mediaType: 'movie' | 'tv' = 'movie';
  let search = await request<{ results: SearchResult[] }>('/search/movie', { query: watch.parsedTitle });
  if (!search.results.length) {
    mediaType = 'tv';
    search = await request<{ results: SearchResult[] }>('/search/tv', { query: watch.parsedTitle });
  }
  const result = [...search.results].sort((a, b) => b.popularity - a.popularity)[0];
  if (!result) return {
    id: uuid(), raw_title: watch.rawTitle, parsed_title: watch.parsedTitle, watch_date: watch.watchDate,
    tmdb_id: null, media_type: null, genre_ids: [], genre_names: [], runtime_minutes: null,
    vote_average: null, release_year: null, poster_path: null, match_status: 'unmatched', created_at: created,
  };
  const details = await request<{ runtime?: number; episode_run_time?: number[] }>(`/${mediaType}/${result.id}`);
  const genreMap = new Map(genres[mediaType].map((genre) => [genre.id, genre.name]));
  const date = result.release_date ?? result.first_air_date;
  return {
    id: uuid(), raw_title: watch.rawTitle, parsed_title: watch.parsedTitle, watch_date: watch.watchDate,
    tmdb_id: result.id, media_type: mediaType, genre_ids: result.genre_ids,
    genre_names: result.genre_ids.map((id) => genreMap.get(id) ?? 'Unbekannt'),
    runtime_minutes: details.runtime ?? details.episode_run_time?.[0] ?? null,
    vote_average: result.vote_average, release_year: date ? Number(date.slice(0, 4)) : null,
    poster_path: result.poster_path, match_status: 'matched', created_at: created,
  };
}

export async function importWatches(
  watches: CsvWatch[],
  onProgress: (completed: number) => void,
) {
  const genres = await loadGenres();
  const entries: WatchHistoryEntry[] = [];
  for (let index = 0; index < watches.length; index += 1) {
    try {
      entries.push(await enrichWatch(watches[index], genres));
    } catch (error) {
      if (error instanceof Error && error.message.includes('API_KEY')) throw error;
    }
    onProgress(index + 1);
    if (index < watches.length - 1) await wait(250);
  }
  return entries;
}

export async function getRecommendation(
  genreIds: number[],
  history: WatchHistoryEntry[],
): Promise<Recommendation> {
  if (!genreIds.length) throw new Error('Importiere zuerst deinen Wiedergabeverlauf.');
  const genres = await loadGenres();
  const data = await request<{ results: SearchResult[] }>('/discover/movie', {
    with_genres: genreIds.slice(0, 2).join(','),
    'vote_average.gte': '6.5',
    'vote_count.gte': '100',
    sort_by: 'popularity.desc',
  });
  const watchedIds = new Set(history.filter((item) => item.media_type === 'movie').map((item) => item.tmdb_id));
  const candidates = data.results.filter((item) => !watchedIds.has(item.id)).slice(0, 10);
  if (!candidates.length) throw new Error('Für dieses Profil wurde kein ungesehener Film gefunden.');
  const result = candidates[Math.floor(Math.random() * candidates.length)];
  const details = await request<{ runtime?: number }>(`/movie/${result.id}`);
  const names = new Map(genres.movie.map((genre) => [genre.id, genre.name]));
  return {
    tmdb_id: result.id, title: result.title ?? 'Unbekannter Titel', overview: result.overview ?? '',
    genre_ids: result.genre_ids, genre_names: result.genre_ids.map((id) => names.get(id) ?? 'Unbekannt'),
    runtime_minutes: details.runtime ?? null, vote_average: result.vote_average,
    release_year: result.release_date ? Number(result.release_date.slice(0, 4)) : null,
    poster_path: result.poster_path,
  };
}
