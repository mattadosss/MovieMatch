import type { User } from '@supabase/supabase-js';
import { loadWatchlistIncludingDeleted, saveWatchlist } from '@/lib/storage';
import { supabase } from '@/src/lib/supabase';
import type { WatchlistEntry } from '@/types/movie';

export async function syncWatchlist(user: User): Promise<WatchlistEntry[]> {
  const local = await loadWatchlistIncludingDeleted();
  const { data, error } = await supabase.from('user_watchlist').select('*').eq('user_id', user.id);
  if (error) throw error;
  const remote = (data ?? []) as WatchlistEntry[];
  const merged = new Map<number, WatchlistEntry>();

  for (const entry of [...remote, ...local.filter((item) => !item.user_id || item.user_id === user.id)]) {
    const current = merged.get(entry.tmdb_id);
    if (!current || Date.parse(entry.updated_at) >= Date.parse(current.updated_at)) {
      merged.set(entry.tmdb_id, { ...entry, id: current?.id ?? entry.id, user_id: user.id });
    }
  }

  const entries = [...merged.values()];
  if (entries.length) {
    const { error: upsertError } = await supabase
      .from('user_watchlist')
      .upsert(entries, { onConflict: 'id,user_id' });
    if (upsertError) throw upsertError;
  }
  await saveWatchlist(entries);
  return entries.filter((entry) => !entry.deleted_at);
}
