export type MediaType = 'movie' | 'tv';

export type WatchHistoryEntry = {
  id: string;
  raw_title: string;
  parsed_title: string;
  watch_date: string;
  tmdb_id: number | null;
  media_type: MediaType | null;
  genre_ids: number[];
  genre_names: string[];
  runtime_minutes: number | null;
  vote_average: number | null;
  release_year: number | null;
  poster_path: string | null;
  match_status: 'matched' | 'unmatched';
  created_at: string;
};

export type GenreProfileItem = {
  genre_id: number;
  genre_name: string;
  watch_count: number;
  weighted_score: number;
};

export type Recommendation = {
  tmdb_id: number;
  title: string;
  overview: string;
  genre_ids: number[];
  genre_names: string[];
  runtime_minutes: number | null;
  vote_average: number;
  release_year: number | null;
  poster_path: string | null;
};
