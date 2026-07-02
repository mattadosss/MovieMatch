import type { User } from '@supabase/supabase-js';
import { loadHistoryIncludingDeleted, saveHistory } from '@/lib/storage';
import { supabase } from '@/src/lib/supabase';
import type { WatchHistoryEntry } from '@/types/movie';

const TABLE = 'watch_history_entries';

type CloudHistoryEntry = Omit<WatchHistoryEntry, 'user_id' | 'updated_at' | 'deleted_at'> & {
  user_id: string;
  updated_at: string;
  deleted_at: string | null;
};

function timestamp(entry: WatchHistoryEntry) {
  return Date.parse(entry.updated_at ?? entry.created_at) || 0;
}

function toCloud(entry: WatchHistoryEntry, userId: string): CloudHistoryEntry {
  return {
    ...entry,
    user_id: userId,
    updated_at: entry.updated_at ?? entry.created_at,
    deleted_at: entry.deleted_at ?? null,
  };
}

export async function syncHistory(user: User): Promise<WatchHistoryEntry[]> {
  const local = await loadHistoryIncludingDeleted();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', user.id);

  if (error) throw error;

  const remote = (data ?? []) as CloudHistoryEntry[];
  const localForUser = local.filter((entry) => !entry.user_id || entry.user_id === user.id);
  const otherUsersLocal = local.filter((entry) => entry.user_id && entry.user_id !== user.id);
  const localById = new Map(localForUser.map((entry) => [entry.id, entry]));
  const remoteById = new Map(remote.map((entry) => [entry.id, entry]));
  const mergedForUser: WatchHistoryEntry[] = [];
  const pushToCloud: CloudHistoryEntry[] = [];

  for (const id of new Set([...localById.keys(), ...remoteById.keys()])) {
    const localEntry = localById.get(id);
    const remoteEntry = remoteById.get(id);

    if (!localEntry && remoteEntry) {
      mergedForUser.push(remoteEntry);
      continue;
    }

    if (localEntry && (!remoteEntry || timestamp(localEntry) > timestamp(remoteEntry))) {
      const cloudEntry = toCloud(localEntry, user.id);
      mergedForUser.push(cloudEntry);
      pushToCloud.push(cloudEntry);
      continue;
    }

    if (remoteEntry) mergedForUser.push(remoteEntry);
  }

  if (pushToCloud.length) {
    const { error: upsertError } = await supabase
      .from(TABLE)
      .upsert(pushToCloud, { onConflict: 'id,user_id' });
    if (upsertError) throw upsertError;
  }

  const allLocal = [...mergedForUser, ...otherUsersLocal];
  await saveHistory(allLocal);
  return mergedForUser.filter((entry) => !entry.deleted_at);
}
