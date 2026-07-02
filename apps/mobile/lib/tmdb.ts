import { filterUnwatchedCandidates, randomTopCandidate } from '@/lib/candidates';
import { CsvWatch } from '@/lib/csv';
import { cacheMovieGenres, loadCachedMovieGenres } from '@/lib/storage';
import { MovieGenre, MovieSearchResult, Recommendation, WatchHistoryEntry, WatchSource } from '@/types/movie';

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

export async function getMovieGenres(): Promise<MovieGenre[]> {
  const cached = await loadCachedMovieGenres<MovieGenre[]>();
  if (cached?.length) return cached;
  const data = await request<{ genres: MovieGenre[] }>('/genre/movie/list');
  await cacheMovieGenres(data.genres);
  return data.genres;
}

function uuid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function searchMovies(query: string): Promise<MovieSearchResult[]> {
  if (!query.trim()) return [];
  const data = await request<{ results: SearchResult[] }>('/search/movie', {
    query: query.trim(),
    include_adult: 'false',
  });
  return data.results.slice(0, 12).map((item) => ({
    tmdb_id: item.id,
    title: item.title ?? 'Unbekannter Titel',
    overview: item.overview ?? '',
    genre_ids: item.genre_ids,
    vote_average: Number.isFinite(item.vote_average) ? item.vote_average : 0,
    release_year: item.release_date ? Number(item.release_date.slice(0, 4)) : null,
    poster_path: item.poster_path,
  }));
}

export async function movieToHistoryEntry(
  movie: MovieSearchResult,
  source: WatchSource = 'manual',
): Promise<WatchHistoryEntry> {
  const [genres, details] = await Promise.all([
    getMovieGenres(),
    request<{ runtime?: number }>(`/movie/${movie.tmdb_id}`),
  ]);
  const names = new Map(genres.map((genre) => [genre.id, genre.name]));
  const now = new Date().toISOString();
  return {
    id: uuid(), raw_title: movie.title, parsed_title: movie.title, watch_date: now,
    tmdb_id: movie.tmdb_id, media_type: 'movie', genre_ids: movie.genre_ids,
    genre_names: movie.genre_ids.map((id) => names.get(id) ?? 'Unbekannt'),
    runtime_minutes: details.runtime ?? null, vote_average: movie.vote_average,
    release_year: movie.release_year, poster_path: movie.poster_path,
    match_status: 'matched', created_at: now, source,
  };
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
    vote_average: null, release_year: null, poster_path: null, match_status: 'unmatched',
    created_at: created, source: 'netflix_csv',
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
    poster_path: result.poster_path, match_status: 'matched', created_at: created, source: 'netflix_csv',
  };
}

export async function importWatches(watches: CsvWatch[], onProgress: (completed: number) => void) {
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

async function toRecommendation(result: SearchResult): Promise<Recommendation> {
  const [genres, details] = await Promise.all([
    getMovieGenres(),
    request<{ runtime?: number }>(`/movie/${result.id}`),
  ]);
  const names = new Map(genres.map((genre) => [genre.id, genre.name]));
  return {
    tmdb_id: result.id, title: result.title ?? 'Unbekannter Titel', overview: result.overview ?? '',
    genre_ids: result.genre_ids, genre_names: result.genre_ids.map((id) => names.get(id) ?? 'Unbekannt'),
    runtime_minutes: details.runtime ?? null,
    vote_average: Number.isFinite(result.vote_average) ? result.vote_average : 0,
    release_year: result.release_date ? Number(result.release_date.slice(0, 4)) : null,
    poster_path: result.poster_path,
  };
}

async function choose(results: SearchResult[], history: WatchHistoryEntry[], message: string) {
  const candidate = randomTopCandidate(filterUnwatchedCandidates(results, history));
  if (!candidate) throw new Error(message);
  return toRecommendation(candidate);
}

export async function getRecommendation(genreIds: number[], history: WatchHistoryEntry[]) {
  if (!genreIds.length) throw new Error('Wähle mindestens ein Genre oder importiere zuerst deinen Verlauf.');
  const data = await request<{ results: SearchResult[] }>('/discover/movie', {
    with_genres: genreIds.slice(0, 3).join(','),
    'vote_average.gte': '6.5', 'vote_count.gte': '100', sort_by: 'popularity.desc',
  });
  return choose(data.results, history, 'Für diese Auswahl wurde kein ungesehener Film gefunden.');
}

export async function getSimilarRecommendation(movieId: number, history: WatchHistoryEntry[]) {
  const recommendations = await request<{ results: SearchResult[] }>(`/movie/${movieId}/recommendations`);
  const unseen = filterUnwatchedCandidates(recommendations.results, history);
  if (unseen.length) return toRecommendation(randomTopCandidate(unseen));
  const similar = await request<{ results: SearchResult[] }>(`/movie/${movieId}/similar`);
  return choose(similar.results, history, 'Keine passenden ungesehenen Filme gefunden.');
}

export function getRewatchRecommendation(
  history: WatchHistoryEntry[],
  excludeMovieId?: number,
): Recommendation {
  const now = Date.now();
  const minimumAgeMs = 180 * 24 * 60 * 60 * 1000;
  const oldest = history
    .filter((entry) =>
      entry.media_type === 'movie'
      && entry.tmdb_id != null
      && entry.tmdb_id !== excludeMovieId
      && entry.match_status === 'matched'
      && Number.isFinite(new Date(entry.watch_date).getTime())
      && now - new Date(entry.watch_date).getTime() >= minimumAgeMs)
    .sort((a, b) => new Date(a.watch_date).getTime() - new Date(b.watch_date).getTime())
    .slice(0, 10);
  const entry = randomTopCandidate(oldest);
  if (!entry || entry.tmdb_id == null) {
    throw new Error('Du hast noch keinen Film im Verlauf, den du seit mindestens 6 Monaten nicht mehr gesehen hast.');
  }
  return {
    tmdb_id: entry.tmdb_id,
    title: entry.parsed_title,
    overview: 'Diesen Film hast du schon lange nicht mehr gesehen – vielleicht ist heute der richtige Abend dafür.',
    genre_ids: entry.genre_ids,
    genre_names: entry.genre_names,
    runtime_minutes: entry.runtime_minutes,
    vote_average: entry.vote_average ?? 0,
    release_year: entry.release_year,
    poster_path: entry.poster_path,
  };
}
