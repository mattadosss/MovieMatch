export type ProviderType = "flatrate" | "free" | "ads" | "rent" | "buy";
export type ProviderAvailability = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  type: ProviderType;
};
export type Provider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number;
};
export type HistoryEntry = {
  id: string;
  user_id?: string;
  raw_title: string;
  parsed_title: string;
  watch_date: string;
  tmdb_id: number | null;
  media_type: "movie" | "tv" | null;
  genre_ids: number[];
  genre_names: string[];
  runtime_minutes: number | null;
  vote_average: number | null;
  release_year: number | null;
  poster_path: string | null;
  watch_providers: ProviderAvailability[];
  watch_provider_link: string | null;
  match_status: "matched" | "unmatched";
  source: "netflix_csv" | "manual" | "marked_from_suggestion";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
export type Movie = {
  id: number;
  title: string;
  overview: string;
  genre_ids: number[];
  vote_average: number;
  release_date?: string;
  poster_path: string | null;
};
export type Recommendation = Movie & {
  genre_names: string[];
  runtime_minutes: number | null;
  watch_providers: ProviderAvailability[];
  watch_provider_link: string | null;
};
