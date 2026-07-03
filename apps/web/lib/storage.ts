import type { User } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import type { HistoryEntry, Recommendation, WatchlistEntry } from "./types";

const HISTORY = "moviematch:web:history";
const PROVIDERS = "moviematch:web:providers";
const WATCHLIST = "moviematch:web:watchlist";

export function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY) ?? "[]") as HistoryEntry[]; } catch { return []; }
}
export function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(HISTORY, JSON.stringify(entries));
}
export function loadProviderIds(): number[] {
  try { return JSON.parse(localStorage.getItem(PROVIDERS) ?? "[]") as number[]; } catch { return []; }
}
export function saveProviderIds(ids: number[]) {
  localStorage.setItem(PROVIDERS, JSON.stringify(ids));
}
export function loadWatchlist(): WatchlistEntry[] {
  try {
    return (JSON.parse(localStorage.getItem(WATCHLIST) ?? "[]") as WatchlistEntry[])
      .filter((entry) => !entry.deleted_at);
  } catch { return []; }
}
function loadWatchlistIncludingDeleted(): WatchlistEntry[] {
  try { return JSON.parse(localStorage.getItem(WATCHLIST) ?? "[]") as WatchlistEntry[]; } catch { return []; }
}
export function saveWatchlist(entries: WatchlistEntry[]) {
  localStorage.setItem(WATCHLIST, JSON.stringify(entries));
}
export function recommendationToWatchlist(movie: Recommendation): WatchlistEntry {
  const now = new Date().toISOString();
  const { id: tmdb_id, release_date, ...details } = movie;
  return {
    ...details,
    id: crypto.randomUUID(),
    tmdb_id,
    release_year: release_date ? Number(release_date.slice(0, 4)) : null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

export async function syncHistory(user: User) {
  const local = loadHistory();
  const { data, error } = await getSupabase().from("watch_history_entries").select("*").eq("user_id", user.id);
  if (error) throw error;
  const remote = (data ?? []) as HistoryEntry[];
  const merged = new Map<string, HistoryEntry>();
  for (const entry of [...remote, ...local.filter((item) => !item.user_id || item.user_id === user.id)]) {
    const current = merged.get(entry.id);
    if (!current || Date.parse(entry.updated_at) >= Date.parse(current.updated_at)) {
      merged.set(entry.id, { ...entry, user_id: user.id });
    }
  }
  const entries = [...merged.values()];
  if (entries.length) {
    const { error: upsertError } = await getSupabase().from("watch_history_entries")
      .upsert(entries, { onConflict: "id,user_id" });
    if (upsertError) throw upsertError;
  }
  saveHistory(entries);
  return entries;
}

export async function syncProviders(user: User, localIds: number[]) {
  const { data, error } = await getSupabase().from("user_streaming_preferences")
    .select("provider_ids,updated_at").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  const localUpdated = localStorage.getItem(`${PROVIDERS}:updated`) ?? new Date(0).toISOString();
  const remote = data as { provider_ids: number[]; updated_at: string } | null;
  const ids = remote && Date.parse(remote.updated_at) > Date.parse(localUpdated)
    ? remote.provider_ids : localIds;
  const updatedAt = remote && ids === remote.provider_ids ? remote.updated_at : localUpdated;
  const { error: upsertError } = await getSupabase().from("user_streaming_preferences")
    .upsert({ user_id: user.id, provider_ids: ids, updated_at: updatedAt });
  if (upsertError) throw upsertError;
  saveProviderIds(ids);
  return ids;
}

export async function syncWatchlist(user: User) {
  const local = loadWatchlistIncludingDeleted();
  const { data, error } = await getSupabase().from("user_watchlist").select("*").eq("user_id", user.id);
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
    const { error: upsertError } = await getSupabase().from("user_watchlist")
      .upsert(entries, { onConflict: "id,user_id" });
    if (upsertError) throw upsertError;
  }
  saveWatchlist(entries);
  return entries.filter((entry) => !entry.deleted_at);
}
