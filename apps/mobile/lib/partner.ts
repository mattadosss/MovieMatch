import { supabase } from '@/src/lib/supabase';
import type { WatchHistoryEntry } from '@/types/movie';

export async function getPartnerWatchHistory(username: string) {
  const normalized = username.trim().toLowerCase();
  if (!normalized) throw new Error('Gib einen Benutzernamen ein.');
  const { data, error } = await supabase.rpc('get_partner_watch_history', {
    partner_username: normalized,
  });
  if (error) throw new Error(error.message.replace(/^.*?:\s*/, ''));
  const result = (data as { username: string; watched_tmdb_ids: number[] }[] | null)?.[0];
  if (!result) throw new Error('Benutzername nicht gefunden.');
  return result;
}

export function partnerHistoryEntries(movieIds: number[]): WatchHistoryEntry[] {
  const now = new Date().toISOString();
  return movieIds.map((tmdbId) => ({
    id: `partner-${tmdbId}`,
    raw_title: '',
    parsed_title: '',
    watch_date: now,
    tmdb_id: tmdbId,
    media_type: 'movie',
    genre_ids: [],
    genre_names: [],
    runtime_minutes: null,
    vote_average: null,
    release_year: null,
    poster_path: null,
    match_status: 'matched',
    source: 'manual',
    created_at: now,
  }));
}
