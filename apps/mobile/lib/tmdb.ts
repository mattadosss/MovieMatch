import { filterUnwatchedCandidates, randomTopCandidate } from '@/lib/candidates';
import { CsvWatch } from '@/lib/csv';
import { supabase } from '@/src/lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';
import {
  cacheMovieGenres,
  cacheWatchProviders,
  loadCachedMovieGenres,
  loadCachedWatchProviders,
} from '@/lib/storage';
import {
  MediaType,
  MovieGenre,
  MovieSearchResult,
  Recommendation,
  WatchHistoryEntry,
  WatchProvider,
  WatchProviderAvailability,
  WatchProviderType,
  WatchSource,
} from '@/types/movie';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Genre = { id: number; name: string };
type SearchResult = {
  id: number; title?: string; name?: string; popularity: number; genre_ids: number[];
  vote_average: number; release_date?: string; first_air_date?: string; poster_path: string | null;
  overview?: string;
};
type Provider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
};
type ProviderRegion = {
  link?: string;
  flatrate?: Provider[];
  free?: Provider[];
  ads?: Provider[];
  rent?: Provider[];
  buy?: Provider[];
};

async function invokeTmdb<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (!error) return data as T;

  if (error instanceof FunctionsHttpError) {
    let response: { error?: string } | null = null;
    try {
      response = await error.context.json() as { error?: string };
    } catch {}
    if (response?.error) throw new Error(response.error);
  }
  throw new Error(`TMDb-Proxy ist nicht erreichbar: ${error.message}`);
}

async function request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const search = path.match(/^\/search\/(movie|tv)$/);
  if (search) {
    return invokeTmdb<T>('search-movies', {
      query: params.query,
      mediaType: search[1],
    });
  }

  const genres = path.match(/^\/genre\/(movie|tv)\/list$/);
  if (genres) {
    return invokeTmdb<T>('movie-details', {
      operation: 'genres',
      mediaType: genres[1],
    });
  }

  if (path === '/watch/providers/movie') {
    return invokeTmdb<T>('movie-details', {
      operation: 'watch-provider-list',
      region: params.watch_region ?? 'CH',
    });
  }

  if (path === '/discover/movie') {
    return invokeTmdb<T>('movie-details', {
      operation: 'discover',
      params,
    });
  }

  const related = path.match(/^\/movie\/(\d+)\/(recommendations|similar)$/);
  if (related) {
    return invokeTmdb<T>('movie-details', {
      operation: related[2],
      id: Number(related[1]),
    });
  }

  const providers = path.match(/^\/(movie|tv)\/(\d+)\/watch\/providers$/);
  if (providers) {
    return invokeTmdb<T>('movie-details', {
      operation: 'watch-providers',
      mediaType: providers[1],
      id: Number(providers[2]),
    });
  }

  const details = path.match(/^\/(movie|tv)\/(\d+)$/);
  if (details) {
    return invokeTmdb<T>('movie-details', {
      operation: 'details',
      mediaType: details[1],
      id: Number(details[2]),
    });
  }

  throw new Error(`Nicht unterstützte TMDb-Operation: ${path}`);
}

export async function getTrendingMovies() {
  return invokeTmdb<{ results: SearchResult[] }>('trending', {
    mediaType: 'movie',
    timeWindow: 'week',
  });
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

export async function getWatchProviders(mediaType: MediaType, id: number, region = 'CH') {
  const data = await request<{ results: Record<string, ProviderRegion> }>(
    `/${mediaType}/${id}/watch/providers`,
  );
  const availability = data.results[region];
  if (!availability) return { providers: [] as WatchProviderAvailability[], link: null };

  const types: WatchProviderType[] = ['flatrate', 'free', 'ads', 'rent', 'buy'];
  const providers = types.flatMap((type) =>
    (availability[type] ?? []).map((provider) => ({ ...provider, type })));

  return { providers, link: availability.link ?? null };
}

export async function getMovieWatchProviders(region = 'CH'): Promise<WatchProvider[]> {
  const cached = await loadCachedWatchProviders(7 * 24 * 60 * 60 * 1000);
  if (cached?.length) return cached;
  const data = await request<{ results: WatchProvider[] }>('/watch/providers/movie', {
    watch_region: region,
  });
  const providers = data.results.sort((a, b) => a.display_priority - b.display_priority);
  await cacheWatchProviders(providers);
  return providers;
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
  const [genres, details, availability] = await Promise.all([
    getMovieGenres(),
    request<{ runtime?: number }>(`/movie/${movie.tmdb_id}`),
    getWatchProviders('movie', movie.tmdb_id),
  ]);
  const names = new Map(genres.map((genre) => [genre.id, genre.name]));
  const now = new Date().toISOString();
  return {
    id: uuid(), raw_title: movie.title, parsed_title: movie.title, watch_date: now,
    tmdb_id: movie.tmdb_id, media_type: 'movie', genre_ids: movie.genre_ids,
    genre_names: movie.genre_ids.map((id) => names.get(id) ?? 'Unbekannt'),
    runtime_minutes: details.runtime ?? null, vote_average: movie.vote_average,
    release_year: movie.release_year, poster_path: movie.poster_path,
    watch_providers: availability.providers, watch_provider_link: availability.link,
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
  const [details, availability] = await Promise.all([
    request<{ runtime?: number; episode_run_time?: number[] }>(`/${mediaType}/${result.id}`),
    getWatchProviders(mediaType, result.id),
  ]);
  const genreMap = new Map(genres[mediaType].map((genre) => [genre.id, genre.name]));
  const date = result.release_date ?? result.first_air_date;
  return {
    id: uuid(), raw_title: watch.rawTitle, parsed_title: watch.parsedTitle, watch_date: watch.watchDate,
    tmdb_id: result.id, media_type: mediaType, genre_ids: result.genre_ids,
    genre_names: result.genre_ids.map((id) => genreMap.get(id) ?? 'Unbekannt'),
    runtime_minutes: details.runtime ?? details.episode_run_time?.[0] ?? null,
    vote_average: result.vote_average, release_year: date ? Number(date.slice(0, 4)) : null,
    poster_path: result.poster_path, match_status: 'matched', created_at: created, source: 'netflix_csv',
    watch_providers: availability.providers, watch_provider_link: availability.link,
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
  const [genres, details, availability] = await Promise.all([
    getMovieGenres(),
    request<{ runtime?: number }>(`/movie/${result.id}`),
    getWatchProviders('movie', result.id),
  ]);
  const names = new Map(genres.map((genre) => [genre.id, genre.name]));
  return {
    tmdb_id: result.id, title: result.title ?? 'Unbekannter Titel', overview: result.overview ?? '',
    genre_ids: result.genre_ids, genre_names: result.genre_ids.map((id) => names.get(id) ?? 'Unbekannt'),
    runtime_minutes: details.runtime ?? null,
    vote_average: Number.isFinite(result.vote_average) ? result.vote_average : 0,
    release_year: result.release_date ? Number(result.release_date.slice(0, 4)) : null,
    poster_path: result.poster_path,
    watch_providers: availability.providers,
    watch_provider_link: availability.link,
  };
}

async function prioritizePreferredProviders(
  results: SearchResult[],
  preferredProviderIds: number[],
) {
  if (!preferredProviderIds.length) return results;
  const preferred = new Set(preferredProviderIds);
  const checked = await Promise.all(results.slice(0, 5).map(async (result) => ({
    result,
    availability: await getWatchProviders('movie', result.id).catch(() => null),
  })));
  const matches = checked
    .filter(({ availability }) => availability?.providers.some((provider) =>
      preferred.has(provider.provider_id)
      && ['flatrate', 'free', 'ads'].includes(provider.type)))
    .map(({ result }) => result);
  return matches.length ? matches : results;
}

async function choose(
  results: SearchResult[],
  history: WatchHistoryEntry[],
  message: string,
  preferredProviderIds: number[] = [],
) {
  const unseen = filterUnwatchedCandidates(results, history);
  const prioritized = await prioritizePreferredProviders(unseen, preferredProviderIds);
  const candidate = randomTopCandidate(prioritized);
  if (!candidate) throw new Error(message);
  return toRecommendation(candidate);
}

export async function getRecommendation(
  genreIds: number[],
  history: WatchHistoryEntry[],
  preferredProviderIds: number[] = [],
) {
  if (!genreIds.length) throw new Error('Wähle mindestens ein Genre oder importiere zuerst deinen Verlauf.');
  const baseParams = {
    with_genres: genreIds.slice(0, 3).join(','),
    'vote_average.gte': '6.5', 'vote_count.gte': '100', sort_by: 'popularity.desc',
  };
  if (preferredProviderIds.length) {
    const preferred = await request<{ results: SearchResult[] }>('/discover/movie', {
      ...baseParams,
      watch_region: 'CH',
      with_watch_providers: preferredProviderIds.join('|'),
      with_watch_monetization_types: 'flatrate|free|ads',
    });
    if (filterUnwatchedCandidates(preferred.results, history).length) {
      return choose(preferred.results, history, 'Für diese Auswahl wurde kein ungesehener Film gefunden.');
    }
  }
  const data = await request<{ results: SearchResult[] }>('/discover/movie', baseParams);
  return choose(data.results, history, 'Für diese Auswahl wurde kein ungesehener Film gefunden.');
}

export async function getSimilarRecommendation(
  movieId: number,
  history: WatchHistoryEntry[],
  preferredProviderIds: number[] = [],
) {
  const recommendations = await request<{ results: SearchResult[] }>(`/movie/${movieId}/recommendations`);
  const unseen = filterUnwatchedCandidates(recommendations.results, history);
  if (unseen.length) {
    const prioritized = await prioritizePreferredProviders(unseen, preferredProviderIds);
    return toRecommendation(randomTopCandidate(prioritized));
  }
  const similar = await request<{ results: SearchResult[] }>(`/movie/${movieId}/similar`);
  return choose(similar.results, history, 'Keine passenden ungesehenen Filme gefunden.', preferredProviderIds);
}

export async function getRewatchRecommendation(
  history: WatchHistoryEntry[],
  excludeMovieId?: number,
  preferredProviderIds: number[] = [],
): Promise<Recommendation> {
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
  let candidates = oldest;
  if (preferredProviderIds.length) {
    const preferred = new Set(preferredProviderIds);
    const checked = await Promise.all(oldest.map(async (item) => ({
      item,
      availability: item.watch_providers?.length
        ? { providers: item.watch_providers }
        : await getWatchProviders('movie', item.tmdb_id!).catch(() => null),
    })));
    const matches = checked
      .filter(({ availability }) => availability?.providers.some((provider) =>
        preferred.has(provider.provider_id)
        && ['flatrate', 'free', 'ads'].includes(provider.type)))
      .map(({ item }) => item);
    if (matches.length) candidates = matches;
  }
  const entry = randomTopCandidate(candidates);
  if (!entry || entry.tmdb_id == null) {
    throw new Error('Du hast noch keinen Film im Verlauf, den du seit mindestens 6 Monaten nicht mehr gesehen hast.');
  }
  const availability = entry.watch_providers?.length
    ? { providers: entry.watch_providers, link: entry.watch_provider_link ?? null }
    : await getWatchProviders('movie', entry.tmdb_id);
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
    watch_providers: availability.providers,
    watch_provider_link: availability.link,
  };
}
