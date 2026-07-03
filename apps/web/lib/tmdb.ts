import { FunctionsHttpError } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import type { HistoryEntry, Movie, Provider, ProviderAvailability, Recommendation } from "./types";

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke(name, { body });
  if (!error) return data as T;
  if (error instanceof FunctionsHttpError) {
    const payload = await error.context.json().catch(() => null) as { error?: string } | null;
    if (payload?.error) throw new Error(payload.error);
  }
  throw new Error(error.message);
}

export async function searchMovies(query: string) {
  const data = await invoke<{ results: Movie[] }>("search-movies", { query, mediaType: "movie" });
  return data.results.slice(0, 12);
}

export async function getGenres() {
  return invoke<{ genres: { id: number; name: string }[] }>("movie-details", {
    operation: "genres", mediaType: "movie",
  });
}

export async function getProviders() {
  const data = await invoke<{ results: Provider[] }>("movie-details", {
    operation: "watch-provider-list", region: "CH",
  });
  return data.results.sort((a, b) => a.display_priority - b.display_priority);
}

async function availability(id: number) {
  const data = await invoke<{ results: Record<string, {
    link?: string;
    flatrate?: Omit<ProviderAvailability, "type">[];
    free?: Omit<ProviderAvailability, "type">[];
    ads?: Omit<ProviderAvailability, "type">[];
    rent?: Omit<ProviderAvailability, "type">[];
    buy?: Omit<ProviderAvailability, "type">[];
  }> }>("movie-details", { operation: "watch-providers", mediaType: "movie", id });
  const result = data.results.CH;
  const types = ["flatrate", "free", "ads", "rent", "buy"] as const;
  return {
    providers: result ? types.flatMap((type) => (result[type] ?? []).map((p) => ({ ...p, type }))) : [],
    link: result?.link ?? null,
  };
}

export async function enrichMovie(movie: Movie, source: HistoryEntry["source"]): Promise<HistoryEntry> {
  const [details, genres, available] = await Promise.all([
    invoke<{ runtime?: number }>("movie-details", { operation: "details", mediaType: "movie", id: movie.id }),
    getGenres(),
    availability(movie.id),
  ]);
  const names = new Map(genres.genres.map((genre) => [genre.id, genre.name]));
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), raw_title: movie.title, parsed_title: movie.title, watch_date: now,
    tmdb_id: movie.id, media_type: "movie", genre_ids: movie.genre_ids,
    genre_names: movie.genre_ids.map((id) => names.get(id) ?? "Unbekannt"),
    runtime_minutes: details.runtime ?? null, vote_average: movie.vote_average,
    release_year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
    poster_path: movie.poster_path, watch_providers: available.providers,
    watch_provider_link: available.link, match_status: "matched", source,
    created_at: now, updated_at: now, deleted_at: null,
  };
}

export async function recommend(history: HistoryEntry[], genreIds: number[], providerIds: number[]) {
  const params: Record<string, string> = {
    with_genres: genreIds.slice(0, 3).join(","),
    "vote_average.gte": "6.5", "vote_count.gte": "100", sort_by: "popularity.desc",
  };
  if (providerIds.length) {
    params.watch_region = "CH";
    params.with_watch_providers = providerIds.join("|");
    params.with_watch_monetization_types = "flatrate|free|ads";
  }
  let data = await invoke<{ results: Movie[] }>("movie-details", { operation: "discover", params });
  let candidates = data.results.filter((movie) => !history.some((item) => item.tmdb_id === movie.id));
  if (!candidates.length && providerIds.length) {
    delete params.watch_region;
    delete params.with_watch_providers;
    delete params.with_watch_monetization_types;
    data = await invoke<{ results: Movie[] }>("movie-details", { operation: "discover", params });
    candidates = data.results.filter((movie) => !history.some((item) => item.tmdb_id === movie.id));
  }
  if (!candidates.length) throw new Error("Kein ungesehener Film gefunden.");
  const movie = candidates[Math.floor(Math.random() * Math.min(candidates.length, 10))];
  const entry = await enrichMovie(movie, "marked_from_suggestion");
  return {
    ...movie, genre_names: entry.genre_names, runtime_minutes: entry.runtime_minutes,
    watch_providers: entry.watch_providers, watch_provider_link: entry.watch_provider_link,
  } satisfies Recommendation;
}

async function prioritizeProviders(movies: Movie[], providerIds: number[]) {
  if (!providerIds.length) return movies;
  const preferred = new Set(providerIds);
  const checked = await Promise.all(movies.slice(0, 5).map(async (movie) => ({
    movie,
    available: await availability(movie.id).catch(() => null),
  })));
  const matches = checked
    .filter(({ available }) => available?.providers.some((provider) =>
      preferred.has(provider.provider_id) && ["flatrate", "free", "ads"].includes(provider.type)))
    .map(({ movie }) => movie);
  return matches.length ? matches : movies;
}

export async function recommendSimilar(
  movieId: number,
  history: HistoryEntry[],
  providerIds: number[],
) {
  const watched = new Set(history.filter((entry) => !entry.deleted_at).map((entry) => entry.tmdb_id));
  const load = async (operation: "recommendations" | "similar") => {
    const data = await invoke<{ results: Movie[] }>("movie-details", { operation, id: movieId });
    return data.results.filter((movie) => !watched.has(movie.id));
  };
  let candidates = await load("recommendations");
  if (!candidates.length) candidates = await load("similar");
  candidates = await prioritizeProviders(candidates, providerIds);
  if (!candidates.length) throw new Error("Keine passenden ungesehenen Filme gefunden.");
  const movie = candidates[Math.floor(Math.random() * Math.min(candidates.length, 10))];
  const entry = await enrichMovie(movie, "marked_from_suggestion");
  return {
    ...movie,
    genre_names: entry.genre_names,
    runtime_minutes: entry.runtime_minutes,
    watch_providers: entry.watch_providers,
    watch_provider_link: entry.watch_provider_link,
  } satisfies Recommendation;
}

export async function recommendRewatch(
  history: HistoryEntry[],
  excludeMovieId: number | undefined,
  providerIds: number[],
) {
  const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
  let candidates = history
    .filter((entry) =>
      !entry.deleted_at
      && entry.media_type === "movie"
      && entry.tmdb_id != null
      && entry.tmdb_id !== excludeMovieId
      && Date.parse(entry.watch_date) <= cutoff)
    .sort((a, b) => Date.parse(a.watch_date) - Date.parse(b.watch_date))
    .slice(0, 10);
  if (providerIds.length) {
    const preferred = new Set(providerIds);
    const matches = candidates.filter((entry) => entry.watch_providers.some((provider) =>
      preferred.has(provider.provider_id) && ["flatrate", "free", "ads"].includes(provider.type)));
    if (matches.length) candidates = matches;
  }
  const entry = candidates[Math.floor(Math.random() * candidates.length)];
  if (!entry?.tmdb_id) {
    throw new Error("Du hast noch keinen Film, den du seit mindestens sechs Monaten nicht gesehen hast.");
  }
  return {
    id: entry.tmdb_id,
    title: entry.parsed_title,
    overview: "Diesen Film hast du schon lange nicht mehr gesehen – vielleicht ist heute der richtige Abend dafür.",
    genre_ids: entry.genre_ids,
    genre_names: entry.genre_names,
    runtime_minutes: entry.runtime_minutes,
    vote_average: entry.vote_average ?? 0,
    release_date: entry.release_year ? `${entry.release_year}` : undefined,
    poster_path: entry.poster_path,
    watch_providers: entry.watch_providers,
    watch_provider_link: entry.watch_provider_link,
  } satisfies Recommendation;
}
